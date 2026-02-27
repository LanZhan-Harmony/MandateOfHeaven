import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { toStreamUrl } from "../utils/streamUrl";

export const useMediaStore = defineStore("media", () => {
  const bgmAudio = new Audio();

  // ── Web Audio API：用于循环音频的无缝循环 ──
  // HTMLAudioElement.loop 在循环衔接处有约 0.3s 间隔（解码器开销），
  // AudioBufferSourceNode.loop 在样本级别循环，真正零间隔。
  let loopAudioCtx: AudioContext | null = null;
  let loopGainNode: GainNode | null = null;
  let loopSourceNode: AudioBufferSourceNode | null = null;
  let _loopContextManuallySuspended = false;
  // 每次调用 setLoopAudioAsync 递增，用于取消过期的异步请求
  let _loopRequestId = 0;

  /** 停止并断开一个 AudioBufferSourceNode（忽略已停止时的异常） */
  function stopAndDisconnect(node: AudioBufferSourceNode) {
    try {
      node.stop();
    } catch {}
    node.disconnect();
  }

  function ensureLoopAudioContext(): AudioContext {
    if (!loopAudioCtx) {
      loopAudioCtx = new AudioContext();
      loopGainNode = loopAudioCtx.createGain();
      loopGainNode.gain.value = actualPlayerVolume.value;
      loopGainNode.connect(loopAudioCtx.destination);
    }
    return loopAudioCtx;
  }

  // 辅助函数：从 localStorage 获取数字
  const getStoredNum = (key: string, defaultValue: number) => {
    const val = localStorage.getItem(key);
    return val !== null ? parseFloat(val) : defaultValue;
  };

  // 音量设置，初始化时从 localStorage 读取
  const mainVolume = ref(getStoredNum("mainVolume", 1.0));
  const playerVolume = ref(getStoredNum("playerVolume", 1.0));
  const bgmVolume = ref(getStoredNum("bgmVolume", 0.5));
  const effectVolume = ref(getStoredNum("effectVolume", 1.0));

  const temporaryPlayerMuted = ref(false);

  // 实时保存到 localStorage
  watch(mainVolume, (val) => localStorage.setItem("mainVolume", val.toString()));
  watch(playerVolume, (val) => localStorage.setItem("playerVolume", val.toString()));
  watch(bgmVolume, (val) => localStorage.setItem("bgmVolume", val.toString()));
  watch(effectVolume, (val) => localStorage.setItem("effectVolume", val.toString()));

  // 计算实际音量（使用平方曲线以获得更自然的音量调整）
  const actualBgmVolume = computed(() => Math.pow(mainVolume.value * bgmVolume.value, 2));
  const actualPlayerVolume = computed(() =>
    Math.pow(mainVolume.value * playerVolume.value * (temporaryPlayerMuted.value ? 0 : 1), 2),
  );
  const actualEffectVolume = computed(() => Math.pow(mainVolume.value * effectVolume.value, 2));

  watch(actualBgmVolume, (newVolume: number) => {
    bgmAudio.volume = newVolume;
  });
  watch(actualPlayerVolume, (newVolume: number) => {
    if (loopGainNode) {
      loopGainNode.gain.value = newVolume;
    }
  });

  /**
   * 设置并播放背景音乐
   * @param name 音乐文件名（不含扩展名）
   * @param startSeconds 从指定秒数开始播放
   */
  async function setBGMAudioAsync(name: string, startSeconds: number = 0) {
    if (bgmAudio.src.endsWith(`${name}.opus`)) {
      if (bgmAudio.paused) {
        await bgmAudio.play();
      }
      return;
    }
    bgmAudio.pause();
    bgmAudio.src = toStreamUrl(`/common/musics/${name}.opus`);
    bgmAudio.currentTime = startSeconds;
    bgmAudio.loop = true;
    bgmAudio.volume = actualBgmVolume.value;
    try {
      await bgmAudio.play();
    } catch (error) {
      console.error("无法播放BGM:", error);
      throw error;
    }
  }

  function pauseBGMAudio() {
    if (!bgmAudio.paused) {
      bgmAudio.pause();
    }
  }

  /**
   * 恢复播放背景音乐
   */
  async function resumeBGMAudioAsync() {
    if (bgmAudio.paused) {
      await bgmAudio.play();
    }
  }

  /**
   * 播放音效
   * @param name 音效文件名（不含扩展名）
   */
  async function setEffectAudioAsync(name: string) {
    const effectAudio = new Audio(toStreamUrl(`/common/musics/${name}.opus`));
    effectAudio.volume = actualEffectVolume.value;
    // 播放结束后立即释放资源，避免 Audio 对象泄漏
    effectAudio.onended = () => {
      effectAudio.onended = null;
      effectAudio.src = "";
    };
    try {
      await effectAudio.play();
    } catch (error) {
      console.error("无法播放音效:", error);
      effectAudio.src = "";
    }
  }

  /**
   * 播放循环音频（使用 Web Audio API 实现无缝循环）
   * @param chapterId 章节 ID
   * @param videoId 视频 ID
   */
  async function setLoopAudioAsync(chapterId: number, videoId: string) {
    // 递增请求 ID，使所有正在进行的旧请求在完成后失效
    const requestId = ++_loopRequestId;

    // 立即停止并断开当前正在播放的 source
    if (loopSourceNode) {
      stopAndDisconnect(loopSourceNode);
      loopSourceNode = null;
    }

    const ctx = ensureLoopAudioContext();
    // 如果 context 因自动播放策略或后台切换而暂停，先恢复
    if (ctx.state === "suspended") {
      await ctx.resume();
      _loopContextManuallySuspended = false;
    }

    const url = toStreamUrl(`/chapters/loop_audios/chapter${chapterId}/${videoId}.opus`);
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);

      // 异步操作完成后检查请求是否仍有效（是否被更新的调用取代）
      if (requestId !== _loopRequestId) return;

      // 停止可能在等待期间由其他调用创建的节点
      const staleNode = loopSourceNode as AudioBufferSourceNode | null;
      loopSourceNode = null;
      if (staleNode) stopAndDisconnect(staleNode);

      loopSourceNode = ctx.createBufferSource();
      loopSourceNode.buffer = buffer;
      loopSourceNode.loop = true;
      // 注意：始终以 1× 速度播放，避免 AudioBufferSourceNode 重采样导致音调变化
      loopSourceNode.playbackRate.value = 1.0;
      loopSourceNode.connect(loopGainNode!);
      loopSourceNode.start();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("无法播放循环音频:", error);
      }
    }
  }

  /**
   * 暂停循环音频
   */
  function pauseLoopAudio() {
    if (loopAudioCtx && loopAudioCtx.state === "running") {
      loopAudioCtx.suspend();
      _loopContextManuallySuspended = true;
    }
  }

  /**
   * 恢复播放循环音频
   */
  async function resumeLoopAudioAsync() {
    if (loopAudioCtx && loopAudioCtx.state === "suspended") {
      await loopAudioCtx.resume();
      _loopContextManuallySuspended = false;
    }
  }

  // ── 后台/锁屏暂停 ──
  let bgmWasPlaying = false;
  let loopWasPlayingBeforeHide = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      bgmWasPlaying = !bgmAudio.paused;
      // loop 正在运行（context running 且未被手动暂停）则记录并挂起
      loopWasPlayingBeforeHide =
        !!loopAudioCtx && loopAudioCtx.state === "running" && !_loopContextManuallySuspended && loopSourceNode !== null;
      if (bgmWasPlaying) bgmAudio.pause();
      if (loopWasPlayingBeforeHide) loopAudioCtx!.suspend();
    } else {
      if (bgmWasPlaying) bgmAudio.play().catch(() => {});
      if (loopWasPlayingBeforeHide) loopAudioCtx!.resume().catch(() => {});
    }
  });

  return {
    mainVolume,
    playerVolume,
    bgmVolume,
    effectVolume,
    temporaryPlayerMuted,
    actualPlayerVolume,
    setBGMAudioAsync,
    pauseBGMAudio,
    resumeBGMAudioAsync,
    pauseLoopAudio,
    resumeLoopAudioAsync,
    setEffectAudioAsync,
    setLoopAudioAsync,
  };
});
