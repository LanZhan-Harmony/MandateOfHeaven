import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

export const useMediaStore = defineStore("media", () => {
  const bgmAudio = new Audio();

  // 音量设置，范围从 0.0 到 1.0
  const mainVolume = ref(1.0);
  const playerVolume = ref(1.0);
  const bgmVolume = ref(1.0);
  const effectVolume = ref(1.0);

  // 计算实际音量
  const actualBgmVolume = computed(() => mainVolume.value * bgmVolume.value);
  const actualPlayerVolume = computed(() => mainVolume.value * playerVolume.value);
  const actualEffectVolume = computed(() => mainVolume.value * effectVolume.value);

  watch(actualBgmVolume, (newVolume: number) => {
    bgmAudio.volume = newVolume;
  });

  /**
   * 设置并播放背景音乐
   * @param name 音乐文件名（不含扩展名）
   * @param startSeconds 从指定秒数开始播放
   */
  async function setBGMAudio(name: string, startSeconds: number = 0) {
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
   * 暂停播放背景音乐
   */
  function pauseBGMAudio() {
    if (!bgmAudio.paused) {
      bgmAudio.pause();
    }
  }

  /**
   * 恢复播放背景音乐
   */
  async function resumeBGMAudio() {
    if (bgmAudio.paused) {
      try {
        await bgmAudio.play();
      } catch (error) {
        console.error("无法恢复播放BGM:", error);
      }
    }
  }

  /**
   * 播放音效
   * @param name 音效文件名（不含扩展名）
   */
  async function setEffectAudio(name: string) {
    const effectAudio = new Audio(`/common/musics/${name}.opus`);
    effectAudio.volume = actualEffectVolume.value;
    try {
      await effectAudio.play();
    } catch (error) {
      console.error("无法播放音效:", error);
    }
  }

  return {
    mainVolume,
    playerVolume,
    bgmVolume,
    effectVolume,
    setBGMAudio,
    pauseBGMAudio,
    resumeBGMAudio,
    setEffectAudio,
  };
});
