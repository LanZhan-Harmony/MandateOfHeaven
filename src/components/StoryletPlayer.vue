<script setup lang="ts">
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { videoAchievements } from "../assets/data/videoAchievements";
import { useAchievementStore } from "../stores/achievement";
import { useMediaStore } from "../stores/media";
import { usePlayerStore } from "../stores/player";
import { getEndingType, useSaveStore } from "../stores/save";
import { useUIStore } from "../stores/ui";
import type { uiButtonActionGroupType } from "../types/actionGroupType";
import type { endingType } from "../types/endingType";
import type { introductionType } from "../types/introductionType";
import type { playerInstructionType } from "../types/playerInstructionType";
import type { playStateType } from "../types/playStateType";
import type { valueChangeType } from "../types/valueChangeType";
import { convertToChapterId, convertToStoryletId } from "../utils/converter";
import { sleep } from "../utils/sleep";
import { toStreamUrl } from "../utils/streamUrl";
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
let playerReadyResolve: (() => void) | null = null;
const playerReadyPromise = new Promise<void>((r) => {
  playerReadyResolve = r;
});

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

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];

// 当前播放速度索引（存储于 uiStore，持久化到 localStorage）
const currentPlaybackRate = computed(() => PLAYBACK_RATES[uiStore.playbackRateIndex]!);

// 控制条显示延时
const CONTROLS_SHOW_DELAY = 3000;
const SEEK_DEBOUNCE_DELAY = 250;

const introductions = computed(() => tm("introductions") as introductionType[]);
const valueChanges = computed(() => tm("valueChanges") as valueChangeType[]);
const endings = computed(() => tm("endings") as endingType[]);

const playerRef = shallowRef<Player | null>(null);
const playerState = shallowRef<playStateType | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);

const isLoopVideo = computed(() => props.instruction.loop);

// 控制条底部偏移（当 video.js 原生控制条显示时抬高自定义控制条）
const controlsBottomOffset = computed(() => (showVideoJsControls ? "30px" : "0"));

// UI 状态
const showQteOverlay = computed(
  () =>
    !hasSelectedOption.value &&
    (isLoopVideo.value ||
      props.instruction.actionGroups.some((g) => g.type === "qte") ||
      props.instruction.actionGroups.some((g) => g.type === "ui_button" && g.timeLimitedActionIndex !== undefined)),
);
const hasSelectedOption = ref(false);
const showControlsOverlay = ref(false);
const showMouseCursor = ref(isLoopVideo.value);
const seekingTime = ref<number | null>(null);
const showEndScreen = ref(false);

// 监听进入循环视频，确保鼠标指针显示
watch(isLoopVideo, (isLoop) => {
  if (isLoop) {
    showMouseCursor.value = true;
    showControlsOverlay.value = false;
  }
});

// 控制条自动隐藏定时器
let controlsHideTimer: number | null = null;

/**
 * 启动控制条自动隐藏倒计时
 */
function scheduleHideControls() {
  if (controlsHideTimer) clearTimeout(controlsHideTimer);
  controlsHideTimer = setTimeout(() => {
    showControlsOverlay.value = false;
    showMouseCursor.value = isLoopVideo.value;
  }, CONTROLS_SHOW_DELAY);
}

/**
 * ========== 计算属性 ==========
 */

// 是否正在播放
const isPlaying = computed(() => props.play && !props.pause);
const isVisible = computed(() => props.play);

/**
 * 视频URL计算
 */
const videoUrl = computed(() => {
  if (!props.instruction) return "";
  const chapterId = convertToChapterId(props.instruction.videoId);
  const fileName = props.instruction.videoId;
  return toStreamUrl(`/chapters/videos/chapter${chapterId}/${fileName}.mp4`);
});

/**
 * 字幕轨道配置
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
  const subtitlePath = `/chapters/subtitles/chapter${chapterId}/${uiStore.locale}/${fileName}.vtt`;

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
const canSkip = computed(() => playerStore.watchedVideos.includes(props.instruction.videoId));

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
  return toStreamUrl(`/chapters/endings/chapter${chapterId}/${storyletId}.webm`);
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
  if (props.play) {
    if (isLoopVideo.value) showMouseCursor.value = true;
  }

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
    controls: showVideoJsControls,
    loop: isLoopVideo.value && props.instruction.videoId !== "04_022_005",
    language: uiStore.locale,
    languages: uiStore.allLocales,
    techOrder: ["html5"],
    playbackRates: PLAYBACK_RATES,
    sources: [{ src: videoUrl.value, type: "video/mp4" }],
    tracks: initialTracks,
  });

  playerRef.value = player;

  // 播放器就绪后 resolve promise（供 startPlayback 等待）
  player.ready(() => {
    playerReadyResolve?.();
  });

  // 建立响应式状态对象（由 player 事件驱动更新）
  const state = reactive<playStateType>({ playing: false, currentTime: 0, duration: 0 });
  playerState.value = state;

  // --- 注册 video.js 原生事件 ---
  player.on("play", () => {
    state.playing = true;
  });
  player.on("pause", () => {
    state.playing = false;
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
  player.on("seeked", handleSeeked);
  player.on("error", handleError);
  player.on("texttrackchange", handleTextTrackChange);
  player.on("playing", () => {
    errorRetryCount = 0; // 成功播放后重置重试计数
  });

  // Android WebView 中 video.js 会拦截 touch 事件导致 @click 不冒泡，
  // 通过 video.js API 直接监听 touchend 来触发控制栏切换
  player.on("touchend", (e: Event) => {
    e.preventDefault();
    toggleControls();
  });

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
    errorRetryCount = 0;
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

  // 空格键播放/暂停
  const onSpaceKey = (e: KeyboardEvent) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
    }
  };
  document.addEventListener("keydown", onSpaceKey);
  removeSpaceKeyListener = () => document.removeEventListener("keydown", onSpaceKey);

  // 绑定视频播放器音量到 actualPlayerVolume
  player.volume(mediaStore.actualPlayerVolume);
  watch(
    () => mediaStore.actualPlayerVolume,
    (vol) => {
      player.volume(vol);
    },
  );

  // 初始化时应用已保存的播放速度
  player.playbackRate(currentPlaybackRate.value);
  watch(currentPlaybackRate, (rate) => {
    player.playbackRate(rate);
  });

  // 配置字幕显示样式（通过 video.js textTrackSettings 子组件）
  const tts = (player as any).textTrackSettings;
  if (tts) {
    tts.setValues({ backgroundColor: "#000", backgroundOpacity: "0", fontPercent: "2.00" });
    tts.saveSettings();
    tts.updateDisplay();
  }
});

onUnmounted(() => {
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
      (g): g is uiButtonActionGroupType => g.type === "ui_button" && g.timeLimitedActionIndex !== undefined,
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

const MAX_ERROR_RETRIES = 3;
let errorRetryCount = 0;

/**
 * 播放错误处理
 * - code 2: 网络错误
 * - code 3: 解码错误
 * - code 4: 源不支持（实际常因加载超时/数据不完整触发）
 */
function handleError(_event: unknown) {
  if (!playerRef.value) return;

  const currentTime = playerRef.value.currentTime();
  const error = playerRef.value.error();
  const errorCode = error?.code;
  const errorMsg = error?.message || "unknown";

  console.error(
    `[Player] Video error: code=${errorCode} msg=${errorMsg} retry=${errorRetryCount}/${MAX_ERROR_RETRIES}`,
  );

  // 可重试的错误码（2=网络, 3=解码, 4=源不支持/加载失败）
  if ((errorCode === 2 || errorCode === 3 || errorCode === 4) && errorRetryCount < MAX_ERROR_RETRIES) {
    errorRetryCount++;
    playerRef.value.error(undefined as any);
    playerRef.value.pause();

    // 指数退避：500ms, 1000ms, 1500ms
    const delay = 500 * errorRetryCount;
    console.log(`[Player] Retrying in ${delay}ms...`);
    setTimeout(() => {
      if (!playerRef.value) return;
      playerRef.value.load();
      playerRef.value.currentTime(currentTime);
      playerRef.value.play();
    }, delay);
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

  mediaStore.pauseLoopAudio();
  // 等待播放器就绪（首次挂载时需要，后续调用 promise 已 resolved，不会阻塞）
  await playerReadyPromise;

  // 等待视频数据加载完成（readyState >= 3 即 HAVE_FUTURE_DATA）
  const player = playerRef.value;
  if (player && (player.readyState?.() ?? 0) < 3) {
    await Promise.race([
      new Promise<void>((resolve) => {
        const onCanPlay = () => {
          player.off("canplay", onCanPlay);
          resolve();
        };
        player.on("canplay", onCanPlay);
      }),
      sleep(10000), // 安全兜底超时
    ]);
  }

  // 播放视频
  try {
    await playerRef.value?.play();
  } catch (e) {
    console.debug("Error starting video track:", e);
  }

  // 循环视频需加载并播放循环音频
  if (isLoopVideo.value && props.play) {
    showMouseCursor.value = true;
    try {
      const chapterId = convertToChapterId(props.instruction.videoId);
      await mediaStore.setLoopAudioAsync(chapterId, props.instruction.videoId);
    } catch (e) {
      console.debug("Error starting loop audio:", e);
    }
  }
}

/**
 * 暂停播放
 */
async function pausePlayback() {
  if (playerState.value?.playing !== true) return;

  mediaStore.pauseLoopAudio();

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
 * 循环切换播放速度
 */
function cyclePlaybackRate() {
  uiStore.playbackRateIndex = (uiStore.playbackRateIndex + 1) % PLAYBACK_RATES.length;
  playerRef.value?.playbackRate(currentPlaybackRate.value);
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
 * 鼠标移动时显示控制条，并重置自动隐藏计时器
 */
function handleMouseMove() {
  showMouseCursor.value = true;
  if (!isLoopVideo.value) scheduleHideControls();
}

/**
 * 切换控制条显示（点击屏幕时显示控制条并启动自动隐藏计时器）
 */
function toggleControls() {
  if (!showControlsOverlay.value) {
    showControlsOverlay.value = true;
    showMouseCursor.value = true;
    if (!isLoopVideo.value) scheduleHideControls();
  } else {
    showControlsOverlay.value = false;
    showMouseCursor.value = isLoopVideo.value;
    if (controlsHideTimer) {
      clearTimeout(controlsHideTimer);
      controlsHideTimer = null;
    }
  }
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
          achievementStore.activateAchievement("unyielding_bones");
        }
      }

      // 有所为，有所不为
      if (sid === "a05_a076_a057058059060061") {
        const lines =
          saveStore.currentSave?.timeline.lines.filter((e) => e[0] === "storylet_start").map((e) => e[1]) || [];
        if (lines.includes("a05_a059_a014b") && lines.includes("a05_a076_a057058059060061")) {
          achievementStore.activateAchievement("to_act_and_to_refrain_from_acting");
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
          achievementStore.activateAchievement("resourceful");
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
          achievementStore.activateAchievement("master_of_comic_banter");
        }
      }

      // 雨露均沾
      const yulvSids = ["a06_a025_a006a012", "a06_a026_a006b013", "a06_a027_a006c014qte2", "a06_a028_a006d"];
      if (yulvSids.includes(sid)) {
        const visited = saveStore.currentSave?.visited_storylets || [];
        if (yulvSids.every((s) => visited.includes(s))) {
          achievementStore.activateAchievement("showering_favors_equally");
        }
      }
    }

    // 加载新的循环音频（仅当前活跃播放器）
    if (newProps.instruction.loop && newProps.play) {
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
  <div v-show="isVisible" class="storylet-player" :style="containerStyle">
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
      @click="toggleControls"
      @mousemove="handleMouseMove">
      <video ref="videoEl" class="video-js" crossorigin="anonymous" playsinline />
    </div>

    <!-- 自定义控制层 -->
    <div
      v-show="showControlsOverlay && !showEndScreen"
      :class="['custom-controls ui-font', { 'top-half': showQteOverlay }]"
      @click="toggleControls"
      @mousemove="handleMouseMove">
      <!-- 顶部导航 -->
      <PageNavButton class="nav" @click="emit('back')" />

      <!-- 底部控制条（非QTE模式显示） -->
      <div v-if="showControls && !showQteOverlay" class="controls vertical" @click.stop>
        <div class="switches horizontal">
          <div class="left-switches">
            <!-- 播放/暂停按钮 -->
            <button v-show="!playerState?.playing" class="play" @click="togglePlayPause" />
            <button v-show="playerState?.playing" class="pause" @click="togglePlayPause" />

            <!-- 静音按钮 -->
            <button :class="['mute', { muted: mediaStore.temporaryPlayerMuted }]" @click="toggleMute" />
          </div>

          <div class="right-switches">
            <!-- 播放速度切换按钮 -->
            <button class="speed" @click.stop="cyclePlaybackRate">{{ currentPlaybackRate }}x</button>
            <!-- 下一段按钮（仅已观看视频可用） -->
            <button v-if="canSkip && !isLoopVideo" class="next" @click="skipToEnd" />
          </div>
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
            class="qte-wrapper"
            :disabled="!showQteOverlay"
            :video-id="actionGroup.id"
            :elapsed-ms="(playerState?.currentTime ?? 0) * 1000"
            @click="handleQteClick"
            @select-option="handleQteSelectOption" />
        </Transition>

        <!-- 章节动画类型 -->
        <Transition name="fade">
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
        <Transition name="fade">
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
/* ==========================================
   StoryletPlayer 主组件
   ========================================== */

/* video.js 充满容器 */
:deep(.video-js) {
  width: 100% !important;
  height: 100% !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
}

/* 鼠标隐藏状态 */
.mouse-hidden {
  cursor: none;
}

/* 容器裁剪溢出内容（数值变化提示、角色介绍等） */
.storylet-player {
  overflow: hidden;
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
.custom-controls {
  z-index: 100;
  opacity: 1;
  background-image: linear-gradient(#000c 0, #0000 50%, #000c 100%);
  transition:
    opacity 0.2s ease-in-out,
    visibility 0.2s;
}

/* QTE 场景：只保留上半部渐变 */
.custom-controls.top-half {
  background-image: linear-gradient(#000c 0, #0000 50% 100%);
}

/* 顶部导航栏定位 */
.nav {
  position: absolute;
  top: 10px;
  left: 30px;
  scale: 1.4;
}

/* 底部控制条 */
.controls {
  left: 0;
  bottom: v-bind(controlsBottomOffset);
  align-items: flex-start;
  width: 100%;
  padding-bottom: 12px;
  position: absolute;
}

.controls > * {
  width: 100%;
}

/* 按钮组 */
.switches {
  align-items: stretch;
  padding: 0 30px;
  display: flex;
  justify-content: space-between;
}

.left-switches,
.right-switches {
  display: flex;
  gap: 10px;
}

@media (pointer: coarse) {
  .switches button {
    height: 36px;
  }
}

.switches button {
  aspect-ratio: 1;
  text-align: center;
  vertical-align: middle;
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: contain;
  background-color: transparent;
  border: none;
  width: auto;
  height: 50px;
  margin: 0 5px;
  cursor: pointer;
}

.switches button:hover {
  color: #fff;
}

/* 各类型按钮背景 */
.play {
  background-image: url(/common/images/播放按钮.webp);
}
.play:hover {
  background-image: url(/common/images/播放按钮高亮.webp);
}

.pause {
  background-image: url(/common/images/暂停按钮.webp);
}
.pause:hover {
  background-image: url(/common/images/暂停按钮高亮.webp);
}

.next {
  background-image: url(/common/images/跳过视频按钮.webp);
}
.next:hover {
  background-image: url(/common/images/跳过视频按钮高亮.webp);
}

/* 播放速度按钮 */
.speed {
  width: 90px !important;
  padding: 0 14px !important;
  border-radius: 8px !important;
  border: 3px solid #8a8378 !important;
  color: #8a8378 !important;
  font-size: 22px !important;
  font-family: inherit;
  letter-spacing: 1px;
  min-width: 72px;
  transition:
    background-color 0.15s,
    border-color 0.15s;
}
.speed:hover {
  border-color: #fff !important;
  color: #fff !important;
}

.mute {
  background-image: url(/common/images/静音按钮.webp);
}
.mute:hover {
  background-image: url(/common/images/静音按钮高亮.webp);
}
.mute.muted {
  background-image: url(/common/images/已静音按钮.webp);
}
.mute.muted:hover {
  background-image: url(/common/images/已静音按钮高亮.webp);
}

/* 进度条 */
.progress-bar {
  position: relative;
  filter: drop-shadow(0 4px 4px #00000040);
  background: url(/common/images/进度条底色-暗.webp) 50% / contain no-repeat;
  width: 100%;
  height: 40px;
  margin-top: 50px;
}

.progress {
  height: 100%;
  width: calc(v-bind(progressPercent) * 1.005);
  filter: drop-shadow(0 4px 4px #00000040);
  z-index: 5;
  pointer-events: none;
  background-image: url(/common/images/进度条-亮.webp);
  background-position: left center; /* 确保从左侧开始填充 */
  background-repeat: no-repeat;
  background-size: contain;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
}

.progress::before {
  content: "";
  z-index: 4;
  background: linear-gradient(0deg, #0000 1px, #fff 2px, #a7835c 5px, #0000);
  position: absolute;
  inset: -11px 0;
  transform: translateY(-50%);
}

.progress-bar > input[type="range"] {
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
.progress-bar > input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 25px;
  height: 25px;
}

/* 问卷/选项区域 */
.questionnaire {
  z-index: 100;
  pointer-events: none;
  align-items: center;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.questionnaire .center {
  align-items: center;
  margin: auto;
}

.questionnaire .center > :not(.qte-wrapper) {
  pointer-events: auto;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.transition-opacity {
  transition: opacity 0.3s ease-in-out;
}

.opacity-0 {
  opacity: 0;
}

/* 数值变化提示 */
.data-change-alert {
  color: #e2c697;
  text-align: center;
  z-index: 200;
  background: linear-gradient(#0f0f0f00, #41332477 50%, #918375 100%);
  border-radius: 10px 0 0 10px;
  padding: 10px 30px;
  font-size: 30px;
  position: absolute;
  top: 10%;
  right: 0;
}

.data-change-slide-enter-active,
.data-change-slide-leave-active {
  transition: transform 0.3s;
}

.data-change-slide-enter-from,
.data-change-slide-leave-to {
  transform: translate(110%);
}

.data-change-slide-enter-to,
.data-change-slide-leave-from {
  transform: translate(0);
}

/* 角色介绍弹窗 */
.character-intro {
  color: #e2c697;
  z-index: 100;
  background: #00000026;
  border: 1px solid #f5ca9552;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 10px;
  display: flex;
  position: absolute;
  top: 10%;
  right: 0;
}

.character-intro .popup-icon {
  background-image: url(/common/images/弹窗图标.webp);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: contain;
  width: 44px;
  height: 44px;
  margin-right: 8px;
}

.character-intro .name {
  font-size: 30px;
  font-weight: 700;
}

.character-intro .separator {
  background: #a7835c;
  width: 1px;
  height: 44px;
  margin: 0 8px;
}

.character-intro .description {
  text-align: left;
  white-space: pre-wrap;
  max-width: 300px;
  font-size: 20px;
  line-height: 150%;
}

.character-intro-slide-enter-active,
.character-intro-slide-leave-active {
  transition: transform 0.3s;
}

.character-intro-slide-enter-from,
.character-intro-slide-leave-to {
  transform: translate(110%);
}

.character-intro-slide-enter-to,
.character-intro-slide-leave-from {
  transform: translate(0);
}

/* ==========================================
   Video.js 字幕样式定制
   ========================================== */

/* 强制字幕容器置于底部居中 */
:deep(.vjs-text-track-display) {
  bottom: 10% !important;
  top: auto !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  pointer-events: none !important;
}

/* 轨道背景透明，强制居中 */
:deep(.vjs-text-track-cue) {
  background-color: transparent !important;
  position: absolute !important;
  inset: auto 0 0 0 !important;
  width: 100% !important;
  height: auto !important;
  text-align: center !important;
  transform: none !important;
}

/* 字幕文本样式：白色文字, 黑色描边 */
:deep(.vjs-text-track-cue > div) {
  background-color: transparent !important;
  color: #ffffff !important;
  font-family:
    "Times New Roman", "KuangShanKaiShu", "TsangErJinKai", "NanoOldSong", "STSong", "Songti SC", "Microsoft YaHei" !important;
  font-size: 60px !important;
  paint-order: stroke fill;
  text-align: center !important;
  -webkit-text-stroke: 2px #000000 !important;
  display: inline-block !important;
  width: auto !important;
  transform: none !important;
}

@media (max-height: 800px) {
  .nav {
    position: absolute;
    top: 20px;
    left: 60px;
    scale: 2;
  }
}
</style>
