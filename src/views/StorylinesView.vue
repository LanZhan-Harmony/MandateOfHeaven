<script setup lang="ts">
import HelpOverlay from "@/components/HelpOverlay.vue";
import ImageButton from "@/components/ImageButton.vue";
import LoadingOverlay from "@/components/LoadingOverlay.vue";
import PageNavButton from "@/components/PageNavButton.vue";
import StorylineProgressBar from "@/components/StorylineProgressBar.vue";
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
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";

// ========== 模块级常量 ==========
// SVG 文本缓存：同一章节二次进入时无需重复请求
const svgCache = new Map<number, string>();
const domParser = new DOMParser();

const { t, tm } = useI18n();
const mediaStore = useMediaStore();
const saveStore = useSaveStore();
const playerStore = usePlayerStore();
const { selectedChapterId, chapterProgress, chapterCurrentVideo } = storeToRefs(saveStore);
const storylines = computed(() => tm("storylines") as storylineType[]);

// ========== 章节数值定义 ==========
const CHAPTER_VALUES: string[][] = [
  // 第0章
  ["emperorTrust", "sikongZhengGuilt"],
  // 第1章
  ["emperorTrust", "sikongZhengGuilt"],
  // 第2章
  ["zuKunApproval"],
  // 第3章
  ["armyMorale"],
  // 第4章 - 无数值
  [],
  // 第5章
  ["armyMorale"],
  // 第6章
  ["xieXuanFightingSpirit", "zhuYuanzhiLoyalty", "zhuYuanzhiPower"],
  // 第7章
  ["zhuYuanzhiPower"],
];

// ========== 页面状态 ==========
const showHelp = ref(false);
const storylineBgStyle = computed(() => `url(/storylines/${selectedChapterId.value}-背景.jpg)`);

// ========== 响应式引用 ==========
const boundingBoxRef = ref<HTMLElement | null>(null);
const storylineRef = ref<HTMLElement | null>(null);
const nodesRef = ref<HTMLElement | null>(null);
const backgroundRef = ref<HTMLElement | null>(null);

// ========== 节点数据数组（shallowRef：元素本身不需要深度响应式）==========
const nodesWithPreview = shallowRef<anchorType[]>([]);
const nodesWithoutPreview = shallowRef<anchorType[]>([]);
const otherAnchors = shallowRef<anchorType[]>([]);

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

/**
 * 获取 SVG 文本（优先从缓存读取）
 */
async function fetchSvgText(chapterId: number): Promise<string | null> {
  if (svgCache.has(chapterId)) {
    return svgCache.get(chapterId)!;
  }
  const svgUrl = `/storylines/${chapterId}-流程.svg`;
  const response = await fetch(svgUrl);
  if (!response.ok) {
    console.error(`Failed to fetch ${svgUrl}: ${response.status} ${response.statusText}`);
    return null;
  }
  const text = await response.text();
  svgCache.set(chapterId, text);
  return text;
}

/**
 * 加载并渲染故事线地图
 */
async function loadStoryline(chapterId: number) {
  isMapReady.value = false;

  // 并行启动：SVG 预取 + BGM 切换，与淡出动画（300ms）同步进行
  const bgmKey = chapterId <= 2 ? "chapter012_bgm" : chapterId <= 5 ? "chapter345_bgm" : "chapter67_bgm";
  const svgTextPromise = fetchSvgText(chapterId);
  const bgmPromise = mediaStore.setBGMAudioAsync(bgmKey);

  // 等待淡出过渡完成，同时以上请求已在后台运行
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 300));

  // 清理旧控制器与节点数据
  if (dragController) {
    dragController.removeEventListener("dragstart", handleDragStart);
    dragController.removeEventListener("dragend", handleDragEnd);
    dragController.stop();
    dragController = null;
  }
  nodesWithPreview.value = [];
  nodesWithoutPreview.value = [];
  otherAnchors.value = [];

  if (!boundingBoxRef.value || !storylineRef.value || !nodesRef.value || !backgroundRef.value) {
    throw new Error("refs not ready");
  }

  // 等待 SVG 文本（大概率已就绪）
  const svgText = await svgTextPromise;
  if (!svgText) return;

  await bgmPromise;

  const svgDoc = domParser.parseFromString(svgText, "image/svg+xml");

  // 优化渲染
  optimizeSvgRendering(svgDoc);

  // 添加渐变定义
  svgDoc.documentElement.appendChild(domParser.parseFromString(GRADIENT_DEFS, "image/svg+xml").documentElement);

  // 构建局部数组避免 shallowRef 频繁触发更新
  const newNodesWithPreview: anchorType[] = [];
  const newNodesWithoutPreview: anchorType[] = [];
  const newOtherAnchors: anchorType[] = [];

  // ========== 单趟遍历所有 SVG 元素 ==========
  svgDoc.querySelectorAll("circle, ellipse, text, path").forEach((element) => {
    const tag = element.tagName;

    if (tag === "circle" || tag === "ellipse") {
      const parentId = element.parentElement?.id;
      if (!parentId) {
        console.debug("错误的锚点ID:", element.parentElement || element);
        element.parentElement?.removeChild(element);
        return;
      }

      switch (element.getAttribute("fill")) {
        case "#FF0000": {
          // 红色 = 普通视频锚点（小圆点，无预览图）
          if (playerStore.watchedVideos.includes(parentId)) {
            newNodesWithoutPreview.push({
              x: parseFloat(element.getAttribute("cx") || "0"),
              y: parseFloat(element.getAttribute("cy") || "0"),
              id: parentId,
              title: "",
              imageUrl: "",
              icon: "bronze",
              disabled: true,
              keyNode: hasValueChanges(parentId),
            });
          }
          break;
        }
        case "#00FFAA": {
          // 青色 = 章节入口跳转点
          const targetChapter = convertToChapterId(parentId);
          if (saveStore.chapterUnlocked[targetChapter]) {
            newOtherAnchors.push({
              x: parseFloat(element.getAttribute("cx") || "0"),
              y: parseFloat(element.getAttribute("cy") || "0"),
              id: parentId,
              title: "",
              imageUrl: "",
              icon: "chapter-in",
              keyNode: false,
              disabled: false,
            });
          }
          break;
        }
        case "#FF00EA": {
          // 粉色 = 章节出口跳转点
          const targetChapter = convertToChapterId(parentId);
          if (saveStore.chapterUnlocked[targetChapter]) {
            newOtherAnchors.push({
              x: parseFloat(element.getAttribute("cx") || "0"),
              y: parseFloat(element.getAttribute("cy") || "0"),
              id: parentId,
              title: "",
              imageUrl: "",
              icon: "chapter-out",
              keyNode: false,
              disabled: false,
            });
          }
          break;
        }
        default:
          break;
      }
      element.parentElement?.removeChild(element);
      return;
    }

    if (tag === "text") {
      const textNode = element.firstChild ?? element;
      const videoId = textNode.textContent ?? "";
      const storyletId = convertToStoryletId(videoId);
      const endingType = getEndingType(storyletId);

      if (playerStore.watchedVideos.includes(videoId)) {
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
        if (endingType === "bronze") {
          newOtherAnchors.push(anchor);
        } else {
          newNodesWithPreview.push(anchor);
        }
      }

      element.parentElement?.removeChild(element);
      return;
    }

    // tag === "path"
    {
      const pathElement = element as SVGPathElement;
      const pathId = pathElement.id.split(",", 2).map(convertToVideoId);

      if (pathId.length < 2) {
        console.debug("错误的路径ID:", pathElement);
        return;
      }

      const bothOnTimeline = pathId.every((id) => saveStore.videosOnCurrentTimeline.includes(id));
      const bothWatched = pathId.every((id) => playerStore.watchedVideos.includes(id));
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
      return;
    }
  });

  // 预加载节点缩略图
  preloadImages(newNodesWithPreview.map((n) => n.imageUrl));

  // 一次性赋值，触发单次响应式更新
  nodesWithPreview.value = newNodesWithPreview;
  nodesWithoutPreview.value = newNodesWithoutPreview;
  otherAnchors.value = newOtherAnchors;

  // 将处理后的 SVG 插入背景容器
  backgroundRef.value.innerHTML = svgDoc.documentElement.outerHTML;

  // 初始化拖拽和缩放控制器
  dragController = new DragZoomController(storylineRef.value, boundingBoxRef.value);
  dragController.addEventListener("dragstart", handleDragStart);
  dragController.addEventListener("dragend", handleDragEnd);

  // 移动到当前视频位置
  moveToCurrentVideo();

  isMapReady.value = true;
  await nextTick();
}

/**
 * 优化 SVG 渲染性能
 * @param svgDoc 需要优化的 SVG 文档对象
 */
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
 * @param urls 需要预加载的图片 URL 数组
 */
function preloadImages(urls: string[]) {
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
}

/**
 * 清理当前地图数据和控制器（不含淡出延迟，由 loadStoryline 统一管理）
 */
async function cleanup() {
  isMapReady.value = false;
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (dragController) {
    dragController.removeEventListener("dragstart", handleDragStart);
    dragController.removeEventListener("dragend", handleDragEnd);
    dragController.stop();
    dragController = null;
  }

  nodesWithPreview.value = [];
  nodesWithoutPreview.value = [];
  otherAnchors.value = [];
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
    selectedChapterId.value = targetChapterId;
  } else {
    // 视频节点跳转：回溯并导航到播放器
    await saveStore.rewindSave(anchorId);
    await router.push("/player");
  }
}

/**
 * 查找锚点数据
 */
function findAnchor(videoId: string): anchorType | null {
  let anchor = nodesWithPreview.value.find((a) => a.id === videoId);
  anchor ||= nodesWithoutPreview.value.find((a) => a.id === videoId);
  anchor ||= otherAnchors.value.find((a) => a.id === videoId);
  return anchor || null;
}

/**
 * 移动视图到指定视频位置
 */
function moveTo(videoId: string) {
  let anchor = findAnchor(videoId);

  if (!anchor) {
    const storyletId = getStoryletFromVideo(videoId);
    if (!storyletId) {
      console.error("Failed to get storyletId from videoId", videoId);
      return;
    }
    const relatedVideos = getVideosFromStorylet(storyletId) || [];
    for (const vid of relatedVideos) {
      anchor = findAnchor(vid);
      if (anchor) break;
    }
  }

  if (anchor) {
    dragController?.setCenter(anchor.x, anchor.y);
  }
}

/**
 * 移动到当前正在播放/观看的视频位置
 */
function moveToCurrentVideo() {
  let videoId = chapterCurrentVideo.value[selectedChapterId.value];
  videoId ||= nodesWithPreview.value[0]?.id ?? null;

  if (!videoId) {
    console.debug("No storylet to move to");
    return;
  }

  moveTo(videoId);
}

function getThumbnailUrl(storyletId: string): string {
  const chapter = convertToChapterId(storyletId);
  return `/chapters/node_thumbnails/chapter${chapter}/${storyletId}.webp`;
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
  () => selectedChapterId.value,
  async (newVal, oldVal) => {
    if (newVal !== oldVal) {
      await loadStoryline(newVal);
    }
  },
);

onMounted(async () => {
  await loadStoryline(selectedChapterId.value);
});

onUnmounted(() => {
  cleanup();
});
</script>
<template>
  <div class="game ui-font">
    <!-- 顶部导航 -->
    <PageNavButton />

    <!-- 加载指示器 -->
    <LoadingOverlay v-if="!isMapReady" />

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
              <img :src="anchor.imageUrl" class="preview-img" />
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
              :side-length="80"
              :mobile-side-length="32"
              :invert="anchor.icon === 'chapter-out'" />
          </div>
        </div>
        <div ref="backgroundRef" class="background"></div>
      </div>
    </div>

    <!-- 覆盖层（渐变 + 控件）-->
    <div class="overlay">
      <!-- 右上角数值展示 -->
      <div class="value-display">
        <table>
          <tbody>
            <tr v-if="(CHAPTER_VALUES[selectedChapterId] || []).length > 0">
              {{
                $t("storyline.valueToPayAttentionTo")
              }}
            </tr>
            <tr v-for="name in CHAPTER_VALUES[selectedChapterId]" :key="name">
              <td class="value">{{ $t(`storyline.${name}`) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 底部控制栏 -->
      <div class="controls">
        <div class="buttons">
          <ImageButton
            default-icon="/common/images/旗帜.webp"
            highlight-icon="/common/images/旗帜高亮.webp"
            :side-length="28"
            :mobile-side-length="24"
            @click="moveToCurrentVideo" />
          <ImageButton
            default-icon="/common/images/问号.webp"
            highlight-icon="/common/images/问号高亮.webp"
            :side-length="28"
            :mobile-side-length="24"
            @click="showHelp = true" />
          <div class="separator"></div>
          <div class="progress">
            <span class="progress-small">{{ $t("storyline.currentProgress") }}</span>
            <span class="progress-normal">{{ ((chapterProgress[selectedChapterId] || 0) * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <StorylineProgressBar class="progress-bar" :progress="chapterProgress[selectedChapterId] || 0" />
      </div>

      <!-- 帮助面板 -->
      <HelpOverlay v-if="showHelp" @close="showHelp = false" />
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
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  position: absolute;
  overflow: hidden;
}

.storyline,
.loading {
  transition:
    opacity 0.3s,
    visibility 0.3s;
}

.hidden {
  visibility: hidden;
  opacity: 0;
}

.storyline {
  z-index: -1;
  will-change: transform;
  width: auto;
  height: auto;
  position: absolute;
  top: 0;
  left: 0;
}

.nodes,
.background {
  background-position: 0 0;
  background-repeat: no-repeat;
  background-size: contain;
}

.nodes {
  z-index: 2;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.background {
  background-image: v-bind(storylineBgStyle);
  z-index: 1;
}

/* ========== 带预览图节点（StoryletAnchorWithPreview）========== */
.btn-storylet {
  z-index: 2;
  position: absolute;
  transform: translate(-50%, -50%);
}

.ending-icon {
  width: 56px;
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(30%, -30%);
  z-index: 3;
}

.preview {
  background-image: url(/common/images/银色框.webp);
  background-repeat: no-repeat;
  background-size: contain;
  width: 150px;
  padding: 12%;
  transition: background-image 0.2s linear;
  position: relative;
}

.preview-img {
  object-fit: contain;
  pointer-events: none;
  width: 100%;
  height: 100%;
}

.key-icon {
  z-index: -10;
  width: 170%;
  position: absolute;
  top: 0%;
  left: -40%;
}

.title {
  text-align: center;
  color: #aaa;
  width: 100%;
  margin-top: 14px;
  font-size: 30px;
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

.btn-storylet.disabled .preview-img {
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

.value-display {
  width: fit-content;
  position: absolute;
  top: 3%;
  right: 1%;
}

.controls {
  pointer-events: auto;
  width: 100%;
  padding: 0 50px 10px 50px;
  position: absolute;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
}

.buttons {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-direction: row;
}

.progress-small {
  font-size: 20px;
}

.progress-normal {
  font-size: 30px;
  margin-left: 10px;
}

/* ========== 数值展示 ========== */
.value-display tr {
  line-height: 120%;
}

.value-display tr td {
  text-align: left;
  padding-right: 8px;
}

.separator {
  flex: 1;
}

@media (max-height: 500px) {
  .progress-small {
    font-size: 16px;
  }
  .progress-normal {
    font-size: 24px;
  }
  .value-display{
    font-size: 16px;
  }
}
</style>
