<script setup lang="ts">
import { videoAchievements } from "@/assets/data/videoAchievements";
import { useAchievementStore } from "@/stores/achievement";
import { useMediaStore } from "@/stores/media";
import { usePlayerStore } from "@/stores/player";
import { getEndingType, useSaveStore } from "@/stores/save";
import { useUIStore } from "@/stores/ui";
import type { endingType } from "@/types/endingType";
import type { introductionType } from "@/types/introductionType";
import type { playerInstructionType } from "@/types/playerInstructionType";
import type { playStateType } from "@/types/playStateType";
import type { valueChangeType } from "@/types/valueChangeType";
import { convertToChapterId, convertToStoryletId } from "@/utils/converter";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import ChapterTitle from "./ChapterTitle.vue";
import Ending from "./Ending.vue";
import LoopButton from "./LoopButton.vue";
import PageNavButton from "./PageNavButton.vue";
import Qte from "./Qte.vue";

const props = defineProps<{
  instruction: playerInstructionType;
  play?: boolean;
  pause?: boolean;
  showControls?: boolean;
  showVideoJsControls?: boolean;
}>();

const emit = defineEmits<{
  (e: "done"): void;
  (e: "back"): void;
}>();

const showControls = props.showControls ?? true;
const showVideoJsControls = props.showVideoJsControls ?? false;

const { tm } = useI18n();
const mediaStore = useMediaStore();
const saveStore = useSaveStore();
const playerStore = usePlayerStore();
const uiStore = useUIStore();
const achievementStore = useAchievementStore();

let removeSpaceKeyListener: (() => void) | null = null;

const scale = ref(1);
function updateScale() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const targetW = 1920;
  const targetH = 1080;
  const scaleW = w / targetW;
  const scaleH = h / targetH;
  scale.value = Math.min(scaleW, scaleH);
}

// 按钮位置配置（根据按钮数量）
const BUTTON_POSITIONS: { x: number; y: number }[][] = [
  [], // 0个按钮
  [{ x: 50, y: 80 }], // 1个按钮：居中
  [
    { x: 45, y: 80 },
    { x: 55, y: 80 },
  ], // 2个按钮：左右
  [
    { x: 45, y: 70 },
    { x: 55, y: 75 },
    { x: 45, y: 80 },
  ], // 3个按钮
  [
    { x: 45, y: 70 },
    { x: 55, y: 70 },
    { x: 45, y: 80 },
    { x: 55, y: 80 },
  ], // 4个按钮
];

const PLAYBACK_RATES = [0.5, 1, 1.5, 2];

// 控制条显示延时
const CONTROLS_SHOW_DELAY = 1500;
const SEEK_DEBOUNCE_DELAY = 250;

const introductions = computed(() => tm("introductions") as introductionType[]);
const valueChanges = computed(() => tm("valueChanges") as valueChangeType[]);
const endings = computed(() => tm("endings") as endingType[]);

const playerRef = shallowRef<Player | null>(null);
const playerState = shallowRef<playStateType | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);

const isLoopVideo = props.instruction.loop;

// 控制条底部偏移（当 video.js 原生控制条显示时抬高自定义控制条）
const controlsBottomOffset = computed(() => (showVideoJsControls ? "30px" : "0"));

// UI 状态
const showQteOverlay = ref(
  isLoopVideo ||
    props.instruction.actionGroups.some((g) => g.type === "qte") ||
    props.instruction.actionGroups.some((g) => g.type === "ui_button" && g.timeLimitedActionIndex !== undefined),
);
const hasSelectedOption = ref(false);
const showControlsOverlay = ref(false);
const showMouseCursor = ref(false);
const seekingTime = ref<number | null>(null);
const showEndScreen = ref(false);

// 控制条自动隐藏定时器
let controlsHideTimer: number | null = null;

/**
 * 启动控制条自动隐藏倒计时
 */
function scheduleHideControls() {
  if (controlsHideTimer) clearTimeout(controlsHideTimer);
  controlsHideTimer = setTimeout(() => {
    showControlsOverlay.value = false;
    showMouseCursor.value = false;
  }, CONTROLS_SHOW_DELAY);
}

/**
 * 取消控制条自动隐藏并立刻隐藏
 */
function hideControlsNow() {
  if (controlsHideTimer) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
  }
  showControlsOverlay.value = false;
  showMouseCursor.value = false;
}

/**
 * 鼠标移动时显示控制条，并（非循环视频）启动自动隐藏倒计时
 */
function handleMouseMove() {
  if (!isPlaying.value) return;
  if (isLoopVideo) {
    showMouseCursor.value = true;
    return;
  }
  showMouseCursor.value = true;
  showControlsOverlay.value = true;
  scheduleHideControls();
}

/**
 * ========== 计算属性 ==========
 */

// 是否正在播放
const isPlaying = computed(() => props.play && !props.pause);

/**
 * 视频URL计算
 */
const videoUrl = computed(() => {
  if (!props.instruction) return "";
  const chapterId = convertToChapterId(props.instruction.videoId);
  const fileName = props.instruction.videoId;
  return `/chapters/videos/chapter${chapterId}/${fileName}.mp4`;
});

/**
 * 字幕轨道配置
 * 格式：res://chapter{章节号}_{语言代码}/subtitles/{视频文件名}.vtt
 *
 * 【字幕对齐原理】
 * VTT 文件格式示例：
 * WEBVTT
 *
 * 00:00:05.000 --> 00:00:08.000
 * 这是第一句字幕
 *
 * 00:00:10.000 --> 00:00:15.000
 * 这是第二句字幕
 *
 * Video.js 会自动解析 VTT 文件，根据时间戳在视频播放到对应时间时显示字幕
 */
const subtitleTracks = computed(() => {
  // 循环视频不需要字幕
  if (!props.instruction || props.instruction.videoId.endsWith("LOOP")) {
    return [];
  }

  const chapterId = convertToChapterId(props.instruction.videoId);
  const fileName = props.instruction.videoId;
  const subtitlePath = `/chapter/subtitles/chapter${chapterId}/${uiStore.locale}/${fileName}.vtt`;

  return [
    {
      kind: "subtitles",
      label: uiStore.locale,
      src: subtitlePath,
      lang: uiStore.locale,
    },
  ];
});

/**
 * 数值变化提示信息
 * 只在视频开始时（前3秒）显示
 */
const valueChangeInfo = computed(() => {
  const change = valueChanges.value.find(
    (c) => c.videoId === props.instruction.videoId && playerState.value && playerState.value.currentTime < 3,
  );
  if (change) {
    return {
      text: change.valueChangedText,
      type: change.valueChangedType,
    };
  }
  return null;
});

/**
 * 角色介绍信息
 * 根据当前视频和播放时间判断是否显示
 */
const characterIntro = computed(() => {
  return introductions.value.find(
    (intro) =>
      intro.videoId === props.instruction.videoId &&
      playerState.value &&
      playerState.value.currentTime >= intro.time &&
      playerState.value.currentTime < intro.time + intro.duration,
  );
});

/**
 * 是否可以跳过（快进到结尾）
 * 第0、1章始终可跳过，其他章节需要已观看过
 */
const canSkip = computed(() => {
  const chapterId = convertToChapterId(props.instruction.videoId);
  return chapterId === 0 || chapterId === 1 || playerStore.watchedVideos.includes(props.instruction.videoId);
});

// 显示时间（用于进度条）
const displayTime = computed(() => {
  if (!playerState.value) return 0;
  return seekingTime.value !== null ? seekingTime.value : playerState.value.currentTime;
});

// 进度条百分比
const progressPercent = computed(() => {
  if (!playerState.value) return "0";
  return `${((displayTime.value * 100) / playerState.value.duration).toFixed(2)}%`;
});

// 是否没有选项（自动播放到结尾）
const hasNoActions = computed(() => props.instruction.actionGroups.length === 0);

// 结局相关
const endingType = getEndingType(props.instruction.videoId) || null;
const endingTitle = endingType
  ? endings.value.find((e) => e.id === convertToStoryletId(props.instruction.videoId))?.title || ""
  : "";
const endingDescription = endingType
  ? endings.value.find((e) => e.id === convertToStoryletId(props.instruction.videoId))?.description || ""
  : "";
const endingVideoUrl = computed(() => {
  if (!endingType) return "";
  const chapterId = convertToChapterId(props.instruction.videoId);
  const storyletId = convertToStoryletId(props.instruction.videoId);
  return `chapters/endings/chapter${chapterId}/${storyletId}.webm`;
});

// 章节动画显示条件
const showChapterAnimation = computed(() => {
  return (
    props.instruction.actionGroups.some((g) => g.type === "animation") &&
    (playerState.value?.currentTime || 0) >= (playerState.value?.duration || Infinity) - 8
  );
});

// 结局画面显示条件
const showEndingScreen = computed(() => {
  return (
    props.instruction.actionGroups.some((g) => g.type === "ending") &&
    (playerState.value?.currentTime || 0) >= (playerState.value?.duration || Infinity) - 1.5
  );
});

// 历史选项高亮
const selectedActionInHistory = computed(() => {
  if (!props.instruction.actionGroups) return null;
  const uiButtonGroup = props.instruction.actionGroups.find((g) => g.type === "ui_button");
  if (!uiButtonGroup) return null;
  return uiButtonGroup.actions.find((action) =>
    saveStore.selectedActions.includes(`${props.instruction.storyletId}::${action.key}`),
  );
});

const containerStyle = computed(() => ({
  transform: `translate(-50%, -50%) scale(${scale.value})`,
  width: "1920px",
  height: "1080px",
  position: "absolute" as const,
  top: "50%",
  left: "50%",
  transformOrigin: "center center",
}));

onMounted(() => {
  updateScale();
  window.addEventListener("resize", updateScale);
  mediaStore.pauseAllAudios();

  if (!videoEl.value) return;

  // 构建初始字幕轨道列表
  const initialTracks = subtitleTracks.value.map((t) => ({
    kind: t.kind,
    label: t.label,
    src: t.src,
    srclang: t.lang,
  }));

  // 初始化 video.js 播放器
  const player = videojs(videoEl.value, {
    controls: false,
    fluid: true,
    loop: isLoopVideo && props.instruction.videoId !== "04_022_005",
    language: uiStore.locale,
    languages: uiStore.allLocales,
    techOrder: ["html5"],
    playbackRates: PLAYBACK_RATES,
    sources: [{ src: videoUrl.value, type: "video/mp4" }],
    tracks: initialTracks,
  });

  playerRef.value = player;

  // 建立响应式状态对象（由 player 事件驱动更新）
  const state = reactive<playStateType>({ playing: false, currentTime: 0, duration: 0 });
  playerState.value = state;

  // --- 注册 video.js 原生事件 ---
  player.on("play", () => {
    state.playing = true;
    handlePlay();
  });
  player.on("pause", () => {
    state.playing = false;
    handlePause();
  });
  player.on("ended", () => {
    state.playing = false;
    handleVideoEnded();
  });
  player.on("timeupdate", () => {
    state.currentTime = player.currentTime() || 0;
    handleTimeUpdate();
  });
  player.on("durationchange", () => {
    state.duration = player.duration() || 0;
  });
  player.on("seeking", handleSeeking);
  player.on("seeked", handleSeeked);
  player.on("error", handleError);
  player.on("texttrackchange", handleTextTrackChange);

  // 监听字幕轨道列表变化，同步更新 video.js 中的 track
  watch(subtitleTracks, (tracks) => {
    const existingTracks = player.remoteTextTracks() as any;
    for (let i = (existingTracks.length ?? 0) - 1; i >= 0; i--) {
      player.removeRemoteTextTrack(existingTracks[i]);
    }
    tracks.forEach((t) =>
      player.addRemoteTextTrack({ kind: t.kind, label: t.label, src: t.src, srclang: t.lang }, false),
    );
  });

  // 监听视频源变化（指令切换时更新 src）
  watch(videoUrl, (newUrl) => {
    player.src([{ src: newUrl, type: "video/mp4" }]);
  });

  // 监听播放/暂停状态
  watch(
    isPlaying,
    async (playing) => {
      playing ? await startPlayback() : await pausePlayback();
    },
    { immediate: true, flush: "sync" },
  );

  // 鼠标移动显示控制条
  document.addEventListener("mousemove", handleMouseMove);

  // 空格键播放/暂停
  const onSpaceKey = (e: KeyboardEvent) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
    }
  };
  document.addEventListener("keydown", onSpaceKey);
  removeSpaceKeyListener = () => document.removeEventListener("keydown", onSpaceKey);

  // 初始化时触发一次，确保控制条可见
  handleMouseMove();

  // 配置字幕显示样式（通过 video.js textTrackSettings 子组件）
  const tts = (player as any).textTrackSettings;
  if (tts) {
    tts.setValues({ backgroundColor: "#000", backgroundOpacity: "0", fontPercent: "2" });
    tts.saveSettings();
    tts.updateDisplay();
  }
});

onUnmounted(() => {
  document.removeEventListener("mousemove", handleMouseMove);
  removeSpaceKeyListener?.();
  if (controlsHideTimer) clearTimeout(controlsHideTimer);

  // 销毁 video.js 播放器
  if (playerRef.value) {
    try {
      playerRef.value.dispose();
    } catch (e) {
      console.debug("Error disposing video.js player:", e);
    }
    playerRef.value = null;
  }
  window.removeEventListener("resize", updateScale);
});

/**
 * 当字幕轨道发生变化时，同步当前字幕开关状态
 */
function handleTextTrackChange() {
  if (!playerRef.value) return;
  const tracks = playerRef.value.textTracks() as any;
  for (let i = 0; i < (tracks.length ?? 0); i++) {
    const track = tracks[i];
    if (track) track.mode = "showing";
  }
}

/**
 * 视频播放结束
 */
async function handleVideoEnded() {
  playerStore.setVideoWatched(props.instruction.videoId);

  // 特殊视频处理
  if (props.instruction.videoId === "04_022_005") {
    await handleSelectOption(0);
  }

  // 处理未选择的QTE（超时失败）
  if (!props.instruction.loop && !hasSelectedOption.value) {
    // QTE超时，选择失败选项
    const hasQte = props.instruction.actionGroups.some((g) => g.type === "qte");
    if (hasQte) {
      await handleSelectOption(1); // 失败选项
    }

    // 特殊视频 04_025_005B032033034035：处理QTE超时后直接返回，
    // 不处理 timeLimitedAction 也不进入结束画面
    if (props.instruction.videoId === "04_025_005B032033034035") {
      return;
    }

    // 限时选项超时
    const timedGroup = props.instruction.actionGroups.find(
      (g): g is import("@/types/actionGroupType").uiButtonActionGroupType =>
        g.type === "ui_button" && g.timeLimitedActionIndex !== undefined,
    );
    if (timedGroup) {
      await handleSelectOption(timedGroup.timeLimitedActionIndex!);
    }

    hasSelectedOption.value = true;
  }

  // 显示结束画面或完成
  if (hasNoActions.value) {
    await handleDone();
  } else {
    showEndScreen.value = true;
  }
}

/**
 * 进度条拖动
 */
function handleSeek(event: Event) {
  if (!playerRef.value) throw new Error("no player");

  const newTime = parseFloat((event.target as HTMLInputElement).value);
  seekingTime.value = newTime;

  // 未观看视频不能往前拖
  if (!canSkip.value && newTime > playerState.value!.currentTime) {
    seekingTime.value = null;
    return;
  }

  playerRef.value.currentTime(newTime);
}

/**
 * 拖动结束
 */
function handleSeeked() {
  // 延迟清除拖动时间
  setTimeout(() => {
    seekingTime.value = null;
  }, SEEK_DEBOUNCE_DELAY);
}

/**
 * 暂停事件
 */
function handlePause() {}

/**
 * 播放事件
 */
function handlePlay() {}

/**
 * 播放错误处理
 */
function handleError(_event: unknown) {
  if (!playerRef.value) return;

  const currentTime = playerRef.value.currentTime();

  // 网络错误时尝试重新加载
  if (playerRef.value.error()?.code === 2) {
    playerRef.value.error(undefined);
    playerRef.value.pause();
    playerRef.value.load();
    playerRef.value.currentTime(currentTime);
    playerRef.value.play();
  }
}

/**
 * 时间更新（用于记录观看进度）
 */
function handleTimeUpdate() {
  // 接近结尾时标记为已观看
  if (playerState.value?.duration && playerState.value?.currentTime) {
    if (playerState.value.duration - playerState.value.currentTime < 5) {
      playerStore.setVideoWatched(props.instruction.videoId);
    }
  }
}

/**
 * 开始播放
 */
async function startPlayback() {
  if (playerState.value?.playing === true) return;

  mediaStore.pauseAllAudios();

  // 播放视频
  try {
    await playerRef.value?.play();
  } catch (e) {
    console.debug("Error starting video track:", e);
  }
}

/**
 * 暂停播放
 */
async function pausePlayback() {
  if (playerState.value?.playing !== true) return;

  mediaStore.pauseAllAudios();

  try {
    playerRef.value?.pause();
  } catch (e) {
    console.debug("Error stopping video track:", e);
  }
}

/**
 * 切换播放/暂停
 */
async function togglePlayPause() {
  if (!isPlaying.value) return;

  if (playerState.value?.playing) {
    await pausePlayback();
  } else {
    await startPlayback();
  }
}

/**
 * 切换静音
 */
async function toggleMute() {
  mediaStore.temporaryPlayerMuted = !mediaStore.temporaryPlayerMuted;
}

/**
 * 处理选项选择（包括QTE成功）
 *
 * 【QTE处理核心逻辑】
 * @param {number} optionIndex - 选项索引
 */
async function handleSelectOption(optionIndex: number) {
  showQteOverlay.value = false;
  hasSelectedOption.value = true;

  // 提交保存动作到游戏状态
  await saveStore.commitSaveAction(optionIndex);

  if (!showQteOverlay.value) {
    // 完成当前视频
    await handleDone();
  }
}

/**
 * 处理QTE点击（循环视频中的QTE）
 */
async function handleQteClick() {
  await mediaStore.setEffectAudioAsync("音效12");
  await handleDone();
}

/**
 * 完成当前视频
 */
async function handleDone() {
  playerStore.setVideoWatched(props.instruction.videoId);
  emit("done");
  await pausePlayback();
}

/**
 * 跳过到视频结尾
 */
async function skipToEnd() {
  await mediaStore.setEffectAudioAsync("音效7");
  playerRef.value?.currentTime(playerState.value?.duration || 0);
}

/**
 * LoopButton 点击处理（带音效）
 * @param {number} optionIndex - 选项索引
 */
async function handleLoopButtonClick(optionIndex: number) {
  await mediaStore.setEffectAudioAsync("音效12");
  await mediaStore.setEffectAudioAsync("选项飞出声音");
  await handleSelectOption(optionIndex);
}

/**
 * QTE selectOption 处理（带音效）
 * @param {number} optionIndex - 选项索引
 */
async function handleQteSelectOption(optionIndex: number) {
  await mediaStore.setEffectAudioAsync("音效12");
  await handleSelectOption(optionIndex);
}

/**
 * 切换控制条显示
 */
function toggleControls() {
  showControlsOverlay.value = !showControlsOverlay.value;
}

/**
 * 阻止事件冒泡（用于控制条区域，防止点击穿透到 toggleControls）
 */
function stopPropagation(e: Event) {
  e.stopPropagation();
}

/**
 * 进度条开始拖动（seeking 事件，无需特殊处理）
 */
function handleSeeking() {
  // 不做任何处理，Video.js 内部已处理
}

/**
 * ========== 生命周期 ==========
 */

// 监听指令变化，加载循环音频
watch(
  [props],
  async ([newProps]) => {
    // 检查视频成就
    if (props.instruction.videoId && props.play) {
      const achievement = videoAchievements[props.instruction.videoId];
      if (achievement) {
        achievementStore.activateAchievement(achievement);
      }
    }

    // 检查剧情线成就（基于 storyletId 和历史记录）
    if (props.instruction.storyletId) {
      const sid = props.instruction.storyletId;

      // 硬骨头：在特定三个剧情全都走过
      if (sid === "a01_a046_a010c") {
        const lines =
          saveStore.currentSave?.timeline.lines.filter((e) => e[0] === "storylet_start").map((e) => e[1]) || [];
        if (
          lines.includes("a01_a037_a008c") &&
          lines.includes("a01_a040_a009a040") &&
          lines.includes("a01_a046_a010c")
        ) {
          achievementStore.activateAchievement("unyielding_spirit");
        }
      }

      // 有所为，有所不为
      if (sid === "a05_a076_a057058059060061") {
        const lines =
          saveStore.currentSave?.timeline.lines.filter((e) => e[0] === "storylet_start").map((e) => e[1]) || [];
        if (lines.includes("a05_a059_a014b") && lines.includes("a05_a076_a057058059060061")) {
          achievementStore.activateAchievement("principled_choice");
        }
      }

      // 足智多谋
      if (["a00_a036_a020", "a00_a055_a012a", "a00_a056_a012b"].includes(sid)) {
        const visited = saveStore.currentSave?.visited_storylets || [];
        if (
          visited.includes("a00_a036_a020") &&
          visited.includes("a00_a055_a012a") &&
          visited.includes("a00_a056_a012b")
        ) {
          achievementStore.activateAchievement("master_strategist");
        }
      }

      // 捧哏大师
      const juniusSids = [
        "a04_a003_a001a003_abe001",
        "a03_a034_a007a017018_abe001",
        "a03_a046_a009a034_abe002",
        "a03_a060_a012a054",
        "a03_a064_a013a_abe007",
      ];
      if (juniusSids.includes(sid)) {
        const visited = saveStore.currentSave?.visited_storylets || [];
        if (juniusSids.every((s) => visited.includes(s))) {
          achievementStore.activateAchievement("court_jester_supreme");
        }
      }

      // 雨露均沾
      const yulvSids = ["a06_a025_a006a012", "a06_a026_a006b013", "a06_a027_a006c014qte2", "a06_a028_a006d"];
      if (yulvSids.includes(sid)) {
        const visited = saveStore.currentSave?.visited_storylets || [];
        console.log(visited);
        if (yulvSids.every((s) => visited.includes(s))) {
          achievementStore.activateAchievement("favor_for_all");
        }
      }
    }

    // 加载新的循环音频
    if (newProps.instruction.loop) {
      const chapterId = convertToChapterId(newProps.instruction.videoId);
      await mediaStore.setLoopAudioAsync(chapterId, newProps.instruction.videoId);
    }
  },
  { immediate: true },
);

// 数值变化音效
watch(
  valueChangeInfo,
  async (newVal, oldVal) => {
    if (oldVal === null && newVal !== null) {
      await mediaStore.setEffectAudioAsync("好感度音效");
    }
  },
  { immediate: true },
);

// 选项出现音效
watch(
  () => props.play,
  async (playing) => {
    if (playing && props.instruction.actionGroups.some((g) => g.type === "ui_button")) {
      await mediaStore.setEffectAudioAsync("选项飞入声音");
    }
  },
  { immediate: true },
);
</script>
<template>
  <div v-show="isPlaying" class="storylet-player">
    <!-- Video.js 视频播放器（直接使用 video.js，不经过包装组件） -->
    <div
      id="player"
      :class="[
        'vjs-custom-theme vjs-big-play-centered',
        {
          playing: !!playerState?.playing,
          controls: showControlsOverlay,
          'mouse-hidden': !showMouseCursor,
        },
      ]"
      :data-playing-status="playerState?.playing"
      style="width: 100%; height: 100%"
      @click="toggleControls">
      <video ref="videoEl" class="video-js" crossorigin="anonymous" playsinline />
    </div>

    <!-- 自定义控制层 -->
    <div
      v-show="showControlsOverlay && !showEndScreen"
      :class="['custom-controls ui-font', { 'top-half': showQteOverlay }]"
      @click="toggleControls">
      <!-- 顶部导航 -->
      <div class="nav">
        <PageNavButton @click="emit('back')" />
      </div>

      <!-- 底部控制条（非QTE模式显示） -->
      <div v-if="showControls && !showQteOverlay" class="controls vertical" @click.stop>
        <div class="switches horizontal">
          <!-- 播放/暂停按钮 -->
          <button v-show="!playerState?.playing" class="play" @click="togglePlayPause" />
          <button v-show="playerState?.playing" class="pause" @click="togglePlayPause" />

          <!-- 静音按钮 -->
          <button :class="['mute', { muted: mediaStore.temporaryPlayerMuted }]" @click="toggleMute" />

          <div class="separator" />

          <!-- 下一段按钮（仅已观看视频可用） -->
          <button v-if="canSkip && !isLoopVideo" class="next" @click="skipToEnd" />
        </div>

        <!-- 进度条 -->
        <div class="progress-bar">
          <div class="progress" />
          <input
            type="range"
            min="0"
            :max="playerState?.duration"
            :value="displayTime"
            step="0.1"
            @input="handleSeek" />
        </div>
      </div>
    </div>

    <!-- 问卷/选项区域 -->
    <div class="questionnaire vertical">
      <!-- 遍历所有动作组 -->
      <div v-for="(actionGroup, agIdx) in instruction.actionGroups" :key="agIdx" class="center horizontal">
        <!-- UI按钮类型：显示选项按钮 -->
        <div v-if="actionGroup.type === 'ui_button'" class="loop-buttons">
          <LoopButton
            v-for="action in actionGroup.actions"
            v-show="play"
            :key="action.index"
            class="item"
            :disabled="!showQteOverlay"
            :x="BUTTON_POSITIONS[actionGroup.actions.length]![action.index]!.x"
            :y="BUTTON_POSITIONS[actionGroup.actions.length]![action.index]!.y"
            :center="actionGroup.actions.length === 1"
            :left="action.index % 2 === 0"
            :in-history="selectedActionInHistory === action"
            @click="handleLoopButtonClick(action.index)"
            @pointerenter="mediaStore.setEffectAudioAsync('音效11')">
            {{ action.prompt }}
          </LoopButton>
        </div>

        <!-- QTE类型：显示对应的QTE组件 -->
        <!-- Qte 内部根据 videoId 硬编码匹配具体 QTE 子组件及参数 -->
        <Transition
          mode="out-in"
          enter-active-class="transition-opacity"
          leave-active-class="transition-opacity"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
          :duration="{ enter: 100, leave: 100 }">
          <Qte
            v-if="actionGroup.type === 'qte'"
            v-show="play"
            :disabled="!showQteOverlay"
            :video-id="actionGroup.id"
            :elapsed-ms="(playerState?.currentTime ?? 0) * 1000"
            @click="handleQteClick"
            @select-option="handleQteSelectOption" />
        </Transition>

        <!-- 章节动画类型 -->
        <Transition>
          <ChapterTitle
            v-if="play && actionGroup.type === 'animation'"
            v-show="showChapterAnimation"
            :chapter="actionGroup.actions[0]!.index"
            :ending="true"
            :show-button="showEndScreen"
            :no-further-chapters="convertToChapterId(instruction.storyletId) + 1 > 7"
            @click="handleDone" />
        </Transition>

        <!-- 结局类型 -->
        <Transition>
          <Ending
            v-if="play && showEndingScreen && actionGroup.type === 'ending'"
            :title="endingTitle"
            :description="endingDescription"
            :type="endingType"
            :video-url="endingVideoUrl"
            :chapter-id="convertToChapterId(instruction.videoId)"
            :ending-id="instruction.storyletId" />
        </Transition>
      </div>

      <!-- 数值变化提示 -->
      <Transition name="data-change-slide" :duration="{ enter: 1000, leave: 1000 }">
        <div v-if="valueChangeInfo" v-show="play" class="data-change-alert">
          {{ valueChangeInfo.text }} {{ valueChangeInfo.type }}
        </div>
      </Transition>

      <!-- 角色介绍弹窗 -->
      <Transition name="data-change-slide" :duration="{ enter: 1000, leave: 1000 }">
        <div v-if="characterIntro" v-show="play" class="character-intro">
          <div class="popup-icon" />
          <div class="name">{{ characterIntro.name }}</div>
          <div class="separator" />
          <div class="description">{{ characterIntro.description }}</div>
        </div>
      </Transition>
    </div>
  </div>
</template>
<style scoped>
.chapter-title-wrapper {
  opacity: 1;
  transition:
    opacity 1s ease-in-out,
    display 1s allow-discrete;
  pointer-events: none;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

@starting-style {
  .chapter-title-wrapper {
    opacity: 0;
  }
}

.chapter-title-wrapper .chapter-title {
  width: 20%;
}

.chapter-title-wrapper .actions {
  position: absolute;
  bottom: 8em;
  right: 8em;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ==========================================
   StoryletPlayer 主组件
   ========================================== */

/* 鼠标隐藏状态 */
.mouse-hidden {
  cursor: none;
}

/* 播放器内所有直接子元素铺满 */
.storylet-player > * {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* 自定义控制层（带渐变遮罩） */
.storylet-player .custom-controls {
  z-index: 100;
  opacity: 1;
  background-image: linear-gradient(#000c 0, #0000 50%, #000c 100%);
  transition:
    opacity 0.2s ease-in-out,
    visibility 0.2s;
}

/* QTE 场景：只保留上半部渐变（不遮挡选项区） */
.storylet-player .custom-controls.top-half {
  background-image: linear-gradient(#000c 0, #0000 50% 100%);
}

/* 顶部导航栏定位 */
.storylet-player .custom-controls > .nav {
  position: absolute;
  top: 3lh;
  left: 3ic;
}

/* 底部控制条 */
.storylet-player .custom-controls > .controls {
  left: 0;
  bottom: v-bind(controlsBottomOffset);
  align-items: flex-start;
  width: 100%;
  padding-bottom: 0.5lh;
  font-size: 2.5em;
  position: absolute;
}

.storylet-player .custom-controls > .controls > * {
  width: 100%;
}

/* 按钮组 */
.storylet-player .custom-controls > .controls > .switches {
  align-items: stretch;
  padding: 0 1ic;
}

@media (pointer: coarse) {
  .storylet-player .custom-controls > .controls > .switches > button {
    height: 1.5lh;
  }
}

.storylet-player .custom-controls > .controls > .switches > button {
  aspect-ratio: 1;
  text-align: center;
  vertical-align: middle;
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: contain;
  width: auto;
  height: 1lh;
  margin: 0 0.3ic;
}

.storylet-player .custom-controls > .controls > .switches > button:hover,
.storylet-player .custom-controls > .controls > .switches > button:focus {
  color: #fff;
}

/* 播放按钮 */
.storylet-player .custom-controls > .controls > .switches > button.play {
  background-image: url(/common/images/播放按钮.webp);
}
.storylet-player .custom-controls > .controls > .switches > button.play:hover,
.storylet-player .custom-controls > .controls > .switches > button.play:focus {
  background-image: url(/common/images/播放按钮高亮.webp);
}

/* 暂停按钮 */
.storylet-player .custom-controls > .controls > .switches > button.pause {
  background-image: url(/common/images/暂停按钮.webp);
}
.storylet-player .custom-controls > .controls > .switches > button.pause:hover,
.storylet-player .custom-controls > .controls > .switches > button.pause:focus {
  background-image: url(/common/images/暂停按钮高亮.webp);
}

/* 跳过按钮 */
.storylet-player .custom-controls > .controls > .switches > button.next {
  background-image: url(/common/images/跳过视频按钮.webp);
}
.storylet-player .custom-controls > .controls > .switches > button.next:hover,
.storylet-player .custom-controls > .controls > .switches > button.next:focus {
  background-image: url(/common/images/跳过视频按钮高亮.webp);
}

/* 静音按钮 */
.storylet-player .custom-controls > .controls > .switches > button.mute {
  background-image: url(/common/images/静音按钮.webp);
}
.storylet-player .custom-controls > .controls > .switches > button.mute:hover,
.storylet-player .custom-controls > .controls > .switches > button.mute:focus {
  background-image: url(/common/images/静音按钮高亮.webp);
}
.storylet-player .custom-controls > .controls > .switches > button.mute.muted {
  background-image: url(/common/images/已静音按钮.webp);
}
.storylet-player .custom-controls > .controls > .switches > button.mute.muted:hover,
.storylet-player .custom-controls > .controls > .switches > button.mute.muted:focus {
  background-image: url(/common/images/已静音按钮高亮.webp);
}

/* 进度条背景 */
.storylet-player .custom-controls > .controls > .progress-bar {
  filter: drop-shadow(0 4px 4px #00000040);
  background: url(/common/images/进度条底色-暗.webp) 50% / contain no-repeat;
  width: 100%;
  height: 1lh;
  margin-top: 1lh;
}

/* 进度条填充（宽度由 v-bind 注入 CSS 变量驱动） */
.storylet-player .custom-controls > .controls > .progress-bar > .progress {
  height: 100%;
  width: calc(v-bind(progressPercent) * 1.005);
  filter: drop-shadow(0 4px 4px #00000040);
  z-index: 5;
  pointer-events: none;
  background-image: url(/common/images/进度条-亮.webp);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: contain;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
}

/* 进度条滑块游标（竖线指示器） */
.storylet-player .custom-controls > .controls > .progress-bar > .progress:before {
  content: "";
  z-index: 4;
  background: linear-gradient(0deg, #0000 1px, #fff 2px, #a7835c 5px, #0000);
  position: absolute;
  inset: -11px;
  transform: translate(-12px, -50%);
}

/* 进度条 range 输入（透明覆盖，用于拖动） */
.storylet-player .custom-controls > .controls > .progress-bar > input[type="range"] {
  z-index: 3;
  appearance: none;
  background: 0 0;
  outline: none;
  width: 100%;
  height: 36px;
  position: absolute;
  bottom: 0;
  left: 0;
}
.storylet-player .custom-controls > .controls > .progress-bar > input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 25px;
  height: 25px;
}

/* 问卷/选项区域 */
.storylet-player .questionnaire {
  z-index: 100;
  pointer-events: none;
  align-items: center;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.storylet-player .questionnaire > .center {
  align-items: center;
  margin: auto;
}

.storylet-player .questionnaire > .center > * {
  pointer-events: auto;
}

/* 数值变化提示（右侧滑入） */
.storylet-player .data-change-alert {
  color: #e2c697;
  text-align: center;
  z-index: 200;
  background: linear-gradient(#0f0f0f00, #41332477 50%, #918375 100%);
  border-radius: 10px 0 0 10px;
  padding: 10px 30px;
  font-size: 2em;
  position: absolute;
  top: 15%;
  right: 0;
}

.storylet-player .data-change-slide-enter-active,
.storylet-player .data-change-slide-leave-active {
  transition: transform 0.3s;
}

.storylet-player .data-change-slide-enter-from,
.storylet-player .data-change-slide-leave-to {
  transform: translate(110%);
}

.storylet-player .data-change-slide-enter-to,
.storylet-player .data-change-slide-leave-from {
  transform: translate(0);
}

/* 角色介绍弹窗（右侧滑入） */
.storylet-player .character-intro {
  color: #e2c697;
  z-index: 100;
  background: #00000026;
  border: 1px solid #f5ca9552;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 10px;
  font-family:
    Source Han Serif VF,
    serif;
  font-size: 2em;
  display: flex;
  position: absolute;
  top: 10%;
  right: 0;
}

.storylet-player .character-intro .popup-icon {
  background-image: url(/common/images/弹窗图标.webp);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: contain;
  width: 44px;
  height: 44px;
  margin-right: 8px;
}

.storylet-player .character-intro .name {
  font-size: 24px;
  font-weight: 900;
}

.storylet-player .character-intro .separator {
  background: #a7835c;
  width: 1px;
  height: 44px;
  margin: 0 8px;
}

.storylet-player .character-intro .description {
  text-align: left;
  white-space: pre-wrap;
  max-width: 300px;
  font-size: 16px;
  font-weight: 700;
  line-height: 150%;
}

.storylet-player .character-intro-slide-enter-active,
.storylet-player .character-intro-slide-leave-active {
  transition: transform 0.3s;
}

.storylet-player .character-intro-slide-enter-from,
.storylet-player .character-intro-slide-leave-to {
  transform: translate(110%);
}

.storylet-player .character-intro-slide-enter-to,
.storylet-player .character-intro-slide-leave-from {
  transform: translate(0);
}
</style>
