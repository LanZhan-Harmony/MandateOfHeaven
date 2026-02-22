import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

export const useMediaStore = defineStore("media", () => {
  const bgmAudio = new Audio();
  const loopAudio = new Audio();

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
  const actualPlayerVolume = computed(() => Math.pow(mainVolume.value * playerVolume.value * (temporaryPlayerMuted.value ? 0 : 1), 2));
  const actualEffectVolume = computed(() => Math.pow(mainVolume.value * effectVolume.value, 2));

  watch(actualBgmVolume, (newVolume: number) => {
    bgmAudio.volume = newVolume;
  });
  watch(actualPlayerVolume, (newVolume: number) => {
    loopAudio.volume = newVolume;
  });

  /**
   * 设置并播放背景音乐
   * @param name 音乐文件名（不含扩展名）
   * @param startSeconds 从指定秒数开始播放
   */
  async function setBGMAudioAsync(name: string, startSeconds: number = 0) {
    if (bgmAudio.src.endsWith(`${name}.opus`)) {
      return;
    }
    bgmAudio.pause();
    bgmAudio.src = `/common/musics/${name}.opus`;
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

  /**
   * 暂停播放所有音频
   */
  function pauseAllAudios() {
    if (!bgmAudio.paused) {
      bgmAudio.pause();
    }
    if (!loopAudio.paused) {
      loopAudio.pause();
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
    const effectAudio = new Audio(`/common/musics/${name}.opus`);
    effectAudio.volume = actualEffectVolume.value;
    try {
      await effectAudio.play();
    } catch (error) {
      console.error("无法播放音效:", error);
    }
  }

  async function setLoopAudioAsync(chapterId: number, videoId: string) {
    loopAudio.pause();
    loopAudio.src = `/chapters/loop_audios/chapter${chapterId}/${videoId}.opus`;
    loopAudio.loop = true;
    loopAudio.volume = actualPlayerVolume.value;
    try {
      await loopAudio.play();
    } catch (error) {
      console.error("无法播放循环音频:", error);
    }
  }

  return {
    loopAudio,
    mainVolume,
    playerVolume,
    bgmVolume,
    effectVolume,
    temporaryPlayerMuted,
    actualPlayerVolume,
    setBGMAudioAsync,
    pauseAllAudios,
    resumeBGMAudioAsync,
    setEffectAudioAsync,
    setLoopAudioAsync,
  };
});
