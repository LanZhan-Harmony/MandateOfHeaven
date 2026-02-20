<script setup lang="ts">
import ImageButton from "@/components/ImageButton.vue";
import PageNavButton from "@/components/PageNavButton.vue";
import router from "@/router";
import { useMediaStore } from "@/stores/media";
import { usePlayerStore } from "@/stores/player";
import {
  getEndingType,
  getStoryletFromVideo,
  getVideosFromStorylet,
  hasValueChanges,
  useSaveStore,
} from "@/stores/save";
import type { anchorType } from "@/types/anchorType";
import type { storylineType } from "@/types/storylineType";
import { convertToChapterId, convertToStoryletId, convertToVideoId } from "@/utils/converter";
import { debounce } from "@/utils/debounce";
import { DragZoomController } from "@/utils/dragZoomController";
import { useHead } from "@unhead/vue";
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t, tm } = useI18n();
const mediaStore = useMediaStore();
const saveStore = useSaveStore();
const playerStore = usePlayerStore();
const { chapterUnlocked, chapterProgress, chapterCurrentVideo } = storeToRefs(saveStore);
const storylines = computed(() => tm("storylines") as storylineType[]);

// ========== 章节数值定义 ==========
const CHAPTER_VALUES: Record<string, { max: number; min: number; default: number }>[] = [
  // 第0章
  {
    老皇帝的认可度: { max: 3, min: 0, default: 0 },
    司空正的愧疚: { max: 1, min: 0, default: 0 },
  },
  // 第1章
  {
    老皇帝的认可度: { max: 5, min: -2, default: 0 },
    司空正的愧疚: { max: 4, min: -3, default: 0 },
  },
  // 第2章
  {
    祖坤好感度: { max: 8, min: -1, default: 0 },
  },
  // 第3章
  {
    军心: { max: 3, min: 0, default: 0 },
  },
  // 第4章 - 无数值
  {},
  // 第5章
  {
    军心: { max: 5, min: 0, default: 0 },
  },
  // 第6章 - 无数值
  {},
  // 第7章 - 无数值
  {},
];

// ========== 页面状态 ==========
const chapterIndex = ref(0);
const showHelp = ref(false);
const storylineBgStyle = computed(() => `url(/storylines/${chapterIndex.value}-背景.jpg)`);

// ========== 响应式引用 ==========
const boundingBoxRef = ref<HTMLElement | null>(null);
const storylineRef = ref<HTMLElement | null>(null);
const nodesRef = ref<HTMLElement | null>(null);
const backgroundRef = ref<HTMLElement | null>(null);

// ========== 节点数据数组 ==========
const nodesWithPreview = reactive<anchorType[]>([]);
const nodesWithoutPreview = reactive<anchorType[]>([]);
const otherAnchors = reactive<anchorType[]>([]);

// ========== 拖拽控制器 ==========
let dragController: DragZoomController | null = null;
const isMapReady = ref(false);
const isDragging = ref(false);

// ========== 高亮线条样式（常量）==========
const HIGHLIGHT_STYLE =
  "fill:none;fill-rule:nonzero;stroke:#918375;stroke-width:2px;filter:drop-shadow(0 0 5px #edb26b);";
const GRADIENT_DEFS = `
  <defs>
    <linearGradient id="possibleTimelineLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#918375FF"/>
      <stop offset="90%" stop-color="#91837500"/>
    </linearGradient>
  </defs>
`;
const GRADIENT_STYLE =
  "fill:none;fill-rule:nonzero;stroke:url(#possibleTimelineLineGradient);stroke-width:2px;filter:drop-shadow(0 0 5px #edb26b);";

// ========== SVG 解析器（复用）==========
const domParser = new DOMParser();

/**
 * 加载并渲染故事线地图
 */
async function loadStoryline(chapterId: number) {
  if (Number.isNaN(chapterId)) return;

  isMapReady.value = false;
  await cleanup();

  if (!boundingBoxRef.value || !storylineRef.value || !nodesRef.value || !backgroundRef.value) {
    throw new Error("refs not ready");
  }

  // 加载 SVG 内容
  const svgUrl = `/storylines/${chapterId}-流程.svg`;
  const response = await fetch(svgUrl);
  if (!response.ok) {
    console.error(`Failed to fetch ${svgUrl}: ${response.status} ${response.statusText}`);
    return;
  }
  const svgText = await response.text();
  const svgDoc = domParser.parseFromString(svgText, "image/svg+xml");

  // 优化渲染
  optimizeSvgRendering(svgDoc);

  // 添加渐变定义
  svgDoc.documentElement.appendChild(domParser.parseFromString(GRADIENT_DEFS, "image/svg+xml").documentElement);

  // ========== 解析圆形/椭圆锚点 ==========
  svgDoc.querySelectorAll("circle, ellipse").forEach((element) => {
    const parentId = element.parentElement?.id;
    if (!parentId) {
      console.debug("Malformed anchor id:", element.parentElement || element);
      element.parentElement?.removeChild(element);
      return;
    }

    switch (element.getAttribute("fill")) {
      case "#FF0000": {
        // 红色 = 结局锚点（小圆点，无预览图）
        const videoId = convertToVideoId(parentId);
        const anchor: anchorType = {
          x: parseFloat(element.getAttribute("cx") || "0"),
          y: parseFloat(element.getAttribute("cy") || "0"),
          id: videoId,
          title: "",
          imageUrl: "",
          icon: "bronze",
          disabled: true,
          keyNode: hasValueChanges(videoId),
        };
        if (playerStore.watchedVideos.includes(videoId)) {
          nodesWithoutPreview.push(anchor);
        }
        break;
      }
      case "#00FFAA": {
        // 青色 = 章节入口跳转点
        const targetChapter = convertToChapterId(parentId);
        const isLocked = !saveStore.chapterUnlocked[targetChapter];
        const anchor: anchorType = {
          x: parseFloat(element.getAttribute("cx") || "0"),
          y: parseFloat(element.getAttribute("cy") || "0"),
          id: parentId,
          title: "",
          imageUrl: "",
          icon: "chapter-in",
          keyNode: false,
          disabled: isLocked,
        };
        if (!isLocked) otherAnchors.push(anchor);
        break;
      }
      case "#FF00EA": {
        // 粉色 = 章节出口跳转点
        const targetChapter = convertToChapterId(parentId);
        const isLocked = !saveStore.chapterUnlocked[targetChapter];
        const anchor: anchorType = {
          x: parseFloat(element.getAttribute("cx") || "0"),
          y: parseFloat(element.getAttribute("cy") || "0"),
          id: parentId,
          title: "",
          imageUrl: "",
          icon: "chapter-out",
          keyNode: false,
          disabled: isLocked,
        };
        if (!isLocked) otherAnchors.push(anchor);
        break;
      }
      default:
        break;
    }
    element.parentElement?.removeChild(element);
  });

  // ========== 解析文本标签（带预览图节点）==========
  svgDoc.querySelectorAll("text").forEach((element) => {
    let textNode: SVGTextElement | ChildNode = element;
    const firstChild = element.firstChild;
    if (firstChild) {
      textNode = firstChild;
    }

    const videoId = convertToVideoId(textNode.textContent ?? "");
    const storyletId = convertToStoryletId(textNode.textContent ?? "");
    const endingType = getEndingType(storyletId);

    const anchor: anchorType = {
      x: parseFloat((textNode as Element).getAttribute?.("x") || "0"),
      y: parseFloat((textNode as Element).getAttribute?.("y") || "0"),
      id: videoId,
      title: storylines.value.find((n) => n.id === storyletId)?.title ?? t(`nodes.${storyletId}.title`),
      imageUrl: getThumbnailUrl(storyletId),
      icon: endingType || "bronze",
      disabled: !saveStore.rewindableVideos.includes(videoId),
      keyNode: hasValueChanges(videoId),
    };

    if (playerStore.watchedVideos.includes(videoId)) {
      if (endingType === "bronze") {
        otherAnchors.push(anchor);
      } else {
        nodesWithPreview.push(anchor);
      }
    }

    element.parentElement?.removeChild(element);
  });

  // 预加载节点缩略图
  preloadImages(nodesWithPreview.map((n) => n.imageUrl));

  // ========== 处理路径线条 ==========
  svgDoc.querySelectorAll("path").forEach((pathElement) => {
    const pathId = (pathElement.getAttribute("serif:id") || pathElement.id)
      .toLowerCase()
      .split(",", 2)
      .map(convertToVideoId);

    if (pathId.length < 2) {
      console.debug("Malformed line id:", pathElement);
      return;
    }

    const bothOnTimeline = pathId.reduce(
      (acc: boolean, id: string) => acc && saveStore.videosOnCurrentTimeline.includes(id),
      true,
    );
    const bothWatched = pathId.reduce(
      (acc: boolean, id: string) => acc && playerStore.watchedVideos.includes(id),
      true,
    );
    const firstOnTimeline = saveStore.videosOnCurrentTimeline.includes(pathId[0]!);

    if (bothOnTimeline) {
      pathElement.setAttribute("style", HIGHLIGHT_STYLE);
      pathElement.removeAttribute("serif:id");
    } else if (bothWatched) {
      pathElement.removeAttribute("serif:id");
    } else if (firstOnTimeline) {
      pathElement.setAttribute("style", GRADIENT_STYLE);
      pathElement.removeAttribute("serif:id");
    } else {
      pathElement.parentElement?.removeChild(pathElement);
    }
  });

  // 将处理后的 SVG 插入背景容器
  backgroundRef.value.innerHTML = svgDoc.documentElement.outerHTML;

  // 初始化拖拽和缩放控制器
  dragController = new DragZoomController(storylineRef.value, boundingBoxRef.value);
  dragController.addEventListener("dragstart", handleDragStart);
  dragController.addEventListener("dragend", handleDragEnd);

  // 移动到当前视频位置
  await moveToCurrentVideo();

  isMapReady.value = true;
  await nextTick();
}

function optimizeSvgRendering(svgDoc: Document) {
  const el = svgDoc.documentElement;
  el.setAttribute("buffered-rendering", "static");
  el.setAttribute("color-rendering", "optimizeSpeed");
  el.setAttribute("shape-rendering", "optimizeSpeed");
  el.setAttribute("text-rendering", "optimizeSpeed");
  el.setAttribute("image-rendering", "optimizeSpeed");
}

/**
 * 简单的图片预加载
 */
function preloadImages(urls: string[]) {
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
}

async function cleanup() {
  isMapReady.value = false;
  await nextTick();
  // 等待过渡动画
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (dragController) {
    dragController.removeEventListener("dragstart", handleDragStart);
    dragController.removeEventListener("dragend", handleDragEnd);
    dragController.stop();
    dragController = null;
  }

  nodesWithPreview.splice(0, nodesWithPreview.length);
  nodesWithoutPreview.splice(0, nodesWithoutPreview.length);
  otherAnchors.splice(0, otherAnchors.length);
}

// ========== 拖拽事件处理 ==========
async function handleDragStart() {
  isDragging.value = true;
}

async function handleDragEnd() {
  await debounce(async () => {
    isDragging.value = false;
  }, 100);
}

// ========== 锚点 hover 音效 ==========
async function handleAnchorHover() {
  if (isDragging.value) return;
  await mediaStore.setEffectAudioAsync("音效11");
}

/**
 * ========== 点击锚点处理 ==========
 */
async function handleAnchorClick(anchorId: string) {
  if (isDragging.value) return;

  // 播放点击音效
  await mediaStore.setEffectAudioAsync("音效3");

  await cleanup();

  if (anchorId.startsWith("chapter")) {
    // 章节跳转：更新当前章节索引并重新加载
    const targetChapterId = convertToChapterId(anchorId);
    chapterIndex.value = targetChapterId;
  } else {
    // 视频节点跳转：回溯并导航到播放器
    await saveStore.rewindSave(anchorId);
    await router.push("/player");
  }
}

/**
 * 查找锚点数据
 */
async function findAnchor(videoId: string): Promise<anchorType | undefined> {
  let anchor = nodesWithPreview.find((a) => a.id === videoId);
  anchor ||= nodesWithoutPreview.find((a) => a.id === videoId);
  anchor ||= otherAnchors.find((a) => a.id === videoId);
  return anchor;
}

/**
 * 移动视图到指定视频位置
 */
async function moveTo(videoId: string) {
  let anchor = await findAnchor(videoId);

  if (!anchor) {
    const storyletId = getStoryletFromVideo(videoId);
    if (!storyletId) {
      console.error("Failed to get storyletId from videoId", videoId);
      return;
    }
    const relatedVideos = getVideosFromStorylet(storyletId) || [];
    for (const vid of relatedVideos) {
      anchor = await findAnchor(vid);
      if (anchor) break;
    }
  }

  if (anchor) {
    dragController?.setCenter(anchor.x, anchor.y);
  } else {
    console.debug("No anchor found for videoId", videoId);
  }
}

/**
 * 移动到当前正在播放/观看的视频位置
 */
async function moveToCurrentVideo() {
  let videoId = chapterCurrentVideo.value[chapterIndex.value];
  videoId ||= nodesWithPreview[0]?.id ?? null;

  if (!videoId) {
    console.debug("No storylet to move to");
    return;
  }

  await moveTo(videoId);
}

function getThumbnailUrl(storyletId: string): string {
  const chapter = convertToChapterId(storyletId);
  return `/chapters/node_thumbnails/${chapter}/${storyletId}.webp`;
}

/**
 * 获取锚点图标（EndingAnchor）
 */
function getAnchorIcon(icon: string): string {
  switch (icon) {
    case "bronze":
      return "/common/images/failure.webp";
    case "silver":
      return "/common/images/银色.webp";
    case "gold":
      return "/common/images/金色.webp";
    case "chapter-in":
    case "chapter-out":
      return "/common/images/chapter_jump.webp";
    default:
      return "/common/images/角标.svg";
  }
}

function getAnchorIconHighlight(icon: string): string {
  switch (icon) {
    case "bronze":
      return "/common/images/failure.webp";
    case "silver":
      return "/common/images/银色.webp";
    case "gold":
      return "/common/images/金色.webp";
    case "chapter-in":
    case "chapter-out":
      return "/common/images/chapter_jump_highlighted.webp";
    default:
      return "/common/images/角标.svg";
  }
}

function getAnchorTransform(icon: string): string {
  switch (icon) {
    case "bronze":
      return "translate(-50%, -50%)";
    case "chapter-in":
      return "translate(-90%, -50%)";
    case "chapter-out":
      return "translate(-10%, -50%)";
    default:
      return "translate(-50%, -50%)";
  }
}

function getEndingIcon(icon: string): string | null {
  const map: Record<string, string> = {
    normal: "/common/images/角标.svg",
    silver: "/common/images/银色.webp",
    gold: "/common/images/金色.webp",
  };
  return map[icon] || null;
}

// ========== 生命周期 ==========

// 章节切换时重新加载
watch(
  () => chapterIndex.value,
  async (newVal, oldVal) => {
    if (newVal !== oldVal) {
      await loadStoryline(newVal);
    }
  },
);

onMounted(async () => {
  await loadStoryline(chapterIndex.value);
});

onUnmounted(() => {
  cleanup();
});
</script>
<template>
  <div class="game ui-font">
    <!-- 顶部导航 -->
    <PageNavButton path="/chapters" />

    <!-- 故事线地图 -->
    <div ref="boundingBoxRef" class="bounding-box">
      <div ref="storylineRef" :class="['storyline', { hidden: !isMapReady }]">
        <div ref="nodesRef" class="nodes">
          <!-- 带预览图的节点（StoryletAnchorWithPreview）-->
          <div
            v-for="anchor in nodesWithPreview"
            :key="anchor.id"
            :class="['btn-storylet', { disabled: anchor.disabled }]"
            :style="{ left: anchor.x + 'px', top: anchor.y + 'px' }"
            @click.passive="!anchor.disabled && handleAnchorClick(anchor.id)"
            @pointerenter.passive="handleAnchorHover">
            <img v-if="getEndingIcon(anchor.icon)" :src="getEndingIcon(anchor.icon)!" class="ending-icon" />
            <div class="preview">
              <img :src="anchor.imageUrl" class="preview" />
              <img v-if="anchor.keyNode" src="/common/images/祥云.webp" class="key-icon" />
            </div>
            <div class="title">{{ anchor.disabled ? "" : anchor.title }}</div>
          </div>

          <!-- 不带预览图的节点（StoryletAnchorWithoutPreview）-->
          <div
            v-for="anchor in nodesWithoutPreview"
            :key="anchor.id"
            :class="['storylet-anchor-small', { disabled: anchor.disabled }]"
            :style="{ left: anchor.x + 'px', top: anchor.y + 'px' }"
            @pointerenter.passive="handleAnchorHover">
            <img src="/common/images/点.svg" />
          </div>

          <!-- 其他锚点 - 结局/章节跳转（EndingAnchor）-->
          <div
            v-for="anchor in otherAnchors"
            :key="anchor.id"
            :class="['storylet-anchor', { disabled: anchor.disabled }]"
            :style="{
              left: anchor.x + 'px',
              top: anchor.y + 'px',
              transform: getAnchorTransform(anchor.icon),
            }"
            @click.passive="!anchor.disabled && handleAnchorClick(anchor.id)"
            @pointerenter.passive="handleAnchorHover">
            <ImageButton
              :default-icon="getAnchorIcon(anchor.icon)"
              :highlight-icon="getAnchorIconHighlight(anchor.icon)"
              :side-length="48"
              :mobile-side-length="32"
              :invert="anchor.icon === 'chapter-out'" />
          </div>
        </div>
        <div ref="backgroundRef" class="background"></div>
      </div>
      <!-- 加载指示器 -->
      <div :class="['loading vertical', { hidden: isMapReady }]">
        <span>Loading...</span>
      </div>
    </div>

    <!-- 覆盖层（渐变 + 控件）-->
    <div class="overlay">
      <!-- 右上角数值展示 -->
      <div class="value-display">
        <div class="storyline-value-display">
          <table>
            <tbody>
              <tr v-if="Object.keys(CHAPTER_VALUES[chapterIndex] ?? {}).length > 0">
                {{
                  $t("storyline.valueToPayAttentionTo")
                }}：
              </tr>
              <tr v-for="(_value, name) in CHAPTER_VALUES[chapterIndex]" :key="name">
                <td class="value">{{ $t(`values.${String(name)}`) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 底部控制栏 -->
      <div class="controls vertical">
        <div class="buttons horizontal">
          <ImageButton
            default-icon="/common/images/旗帜.webp"
            highlight-icon="/common/images/旗帜高亮.webp"
            :side-length="32"
            :mobile-side-length="24"
            @click="moveToCurrentVideo" />
          <ImageButton
            default-icon="/common/images/问号.webp"
            highlight-icon="/common/images/问号高亮.webp"
            :side-length="32"
            :mobile-side-length="24"
            @click="showHelp = true" />
          <div class="separator"></div>
          <div class="progress">
            <span class="small">{{ $t("storyline.currentProgress") }}</span>
            <span>{{ ((chapterProgress[chapterIndex] || 0) * 100).toFixed(0) }}%</span>
          </div>
        </div>
        <div class="progress-bar">
          <div class="bar-bg">
            <div class="bar-fill" :style="{ width: (chapterProgress[chapterIndex] || 0) * 100 + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- 帮助面板 -->
      <div v-if="showHelp" class="help">
        <div class="about vertical">
          <div class="nav horizontal">
            <h1>{{ $t("storyline.valueToPayAttentionTo") }}</h1>
            <div class="separator"></div>
            <ImageButton
              default-icon="/common/images/箭头按钮.webp"
              highlight-icon="/common/images/箭头按钮高亮.webp"
              :side-length="32"
              :mobile-side-length="24"
              @click="showHelp = false" />
          </div>
          <div class="content-frame">
            <img src="/common/images/说明页面.webp" aria-label="Help" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
/* ========== 整体布局 ========== */
.game {
  position: relative;
  width: 100%;
  height: 100%;
}

/* ========== 故事线地图容器（StorylineMap） ========== */
.bounding-box {
  clip-path: content-box;
  contain: paint;
  width: 100%;
  height: 100%;
  position: absolute;
  overflow: hidden;
}

.bounding-box > * {
  transition:
    opacity 0.3s,
    visibility 0.3s;
}

.bounding-box > .hidden {
  visibility: hidden;
  opacity: 0;
}

.bounding-box > .storyline {
  z-index: -1;
  will-change: transform;
  width: auto;
  height: auto;
  position: absolute;
  top: 0;
  left: 0;
}

.bounding-box > .storyline > * {
  background-position: 0 0;
  background-repeat: no-repeat;
  background-size: contain;
}

.bounding-box > .storyline > .nodes {
  z-index: 2;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.bounding-box > .storyline > .background {
  background-image: v-bind(storylineBgStyle);
  z-index: 1;
}

.bounding-box .loading {
  z-index: 990;
  justify-content: center;
  align-items: center;
  display: flex;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.bounding-box .loading > * {
  font-size: 3em;
}

/* ========== 带预览图节点（StoryletAnchorWithPreview）========== */
.btn-storylet {
  z-index: 2;
  position: absolute;
  transform: translate(-50%, -50%);
  cursor: pointer;
}

.btn-storylet.disabled {
  cursor: not-allowed;
}

.btn-storylet .ending-icon {
  width: 56px;
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(30%, -30%);
}

.btn-storylet div.preview {
  background-image: url(/common/images/银色框.webp);
  background-repeat: no-repeat;
  background-size: contain;
  width: 150px;
  padding: 12%;
  transition: background-image 0.2s linear;
  position: relative;
}

.btn-storylet div.preview img.preview {
  object-fit: contain;
  pointer-events: none;
  width: 100%;
  height: 100%;
}

.btn-storylet div.preview img.key-icon {
  z-index: -200;
  width: 170%;
  position: absolute;
  top: 0%;
  left: -40%;
}

.btn-storylet .title {
  text-align: center;
  color: #aaa;
  width: 100%;
  margin-top: 0.6lh;
  font-size: 1.2em;
  transition: color 0.2s linear;
  position: absolute;
}

.btn-storylet:not(.disabled):hover .preview,
.btn-storylet:not(.disabled):focus .preview {
  background-image: url(/common/images/金色框.webp);
}

.btn-storylet:not(.disabled):hover .title,
.btn-storylet:not(.disabled):focus .title {
  color: #918375;
}

.btn-storylet.disabled .preview img.preview {
  visibility: hidden;
}

/* ========== 不带预览图节点（StoryletAnchorWithoutPreview）========== */
.storylet-anchor-small {
  z-index: 1;
  position: absolute;
  transform: translate(-50%, -50%);
}

.storylet-anchor-small img {
  width: 36px;
}

/* ========== 结局/章节跳转锚点（EndingAnchor）========== */
.storylet-anchor {
  z-index: 1;
  position: absolute;
}

.storylet-anchor.disabled {
  filter: grayscale() brightness(50%);
  cursor: not-allowed;
}

/* ========== 覆盖层 ========== */
.overlay {
  pointer-events: none;
  background-image: linear-gradient(#000000e6 0, #0000 15% 80%, #000000e6 100%);
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.overlay > * {
  pointer-events: auto;
}

.overlay .value-display {
  width: fit-content;
  margin: 3em 0;
  position: absolute;
  top: 0;
  right: 0;
}

.overlay .controls {
  pointer-events: none;
  width: 100%;
  padding: 1em 2em;
  font-size: 2em;
  position: absolute;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
}

.overlay .controls .buttons {
  display: flex;
  align-items: center;
}

.overlay .controls .buttons button {
  pointer-events: auto;
}

.overlay .controls .buttons .progress > * {
  margin-left: 0.5ic;
}

.overlay .controls .buttons .progress .small {
  font-size: 0.7em;
}

.overlay .controls .progress-bar {
  width: 100%;
  margin-top: 0.2lh;
}

/* ========== 进度条 ========== */
.bar-bg {
  background-image: url(/common/images/进度条底色-暗.webp);
  background-repeat: no-repeat;
  background-size: contain;
  border-radius: 4px;
  height: 1lh;
  position: relative;
  overflow: hidden;
}

.bar-fill {
  background-image: url(/common/images/进度条-暗.webp);
  background-repeat: no-repeat;
  background-size: contain;
  height: 100%;
  transition: width 0.3s;
  position: absolute;
  top: 0;
  left: 0;
}

/* ========== 数值展示 ========== */
.storyline-value-display {
  font-size: 1.5em;
}

.storyline-value-display tr {
  line-height: 120%;
}

.storyline-value-display tr td {
  text-align: left;
  padding-right: 0.5ic;
}

/* ========== 帮助面板 ========== */
.overlay .help {
  z-index: 9990;
  height: 100%;
  position: relative;
}

.about {
  aspect-ratio: 2762/1440;
  background-image: url(/common/images/关于.webp);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: contain;
  width: 100%;
  height: 100%;
  margin: auto 0;
  padding: 5%;
  display: flex;
  flex-direction: column;
}

.about .nav {
  width: 100%;
  margin-bottom: 1lh;
  position: relative;
  display: flex;
  align-items: center;
}

.about .nav h1 {
  font-size: 3em;
}

.about .nav button {
  align-self: flex-end;
}

.about .content-frame {
  flex-grow: 1;
  overflow-y: scroll;
}

.about .content-frame img {
  width: 100%;
}

/* ========== 工具类 ========== */
.separator {
  flex: 1;
}

.horizontal {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.vertical {
  display: flex;
  flex-direction: column;
}
</style>
