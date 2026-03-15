<script setup lang="ts">
import { useMagicKeys } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import LoadingOverlay from "../components/LoadingOverlay.vue";
import MenuButton from "../components/MenuButton.vue";
import PageNavButton from "../components/PageNavButton.vue";
import StoryletPlayer from "../components/StoryletPlayer.vue";
import router from "../router";
import { useMediaStore } from "../stores/media";
import { usePlayerStore } from "../stores/player";
import { useSaveStore } from "../stores/save";

const mediaStore = useMediaStore();
const saveStore = useSaveStore();
const playerStore = usePlayerStore();
const { playerInstructions } = storeToRefs(playerStore);

// 仅取前 N 条指令参与渲染（Android 硬件解码器有限，只保留 1 个以避免 MEDIA_ERR_DECODE）
const isAndroid = /android/i.test(navigator.userAgent);
const visibleInstructions = computed(() => playerInstructions.value.slice(0, isAndroid ? 1 : 3));
const transitionFrame = ref<string | null>(null);
let transitionFrameTimer: number | null = null;
const PLAYER_BASE_WIDTH = 1920;
const PLAYER_BASE_HEIGHT = 1080;
const scale = ref(1);

function updateScale() {
  const scaleW = window.innerWidth / PLAYER_BASE_WIDTH;
  const scaleH = window.innerHeight / PLAYER_BASE_HEIGHT;
  scale.value = Math.min(scaleW, scaleH);
}

const transitionFreezeStyle = computed(() => ({
  transform: `translate(-50%, -50%) scale(${scale.value})`,
  width: `${PLAYER_BASE_WIDTH}px`,
  height: `${PLAYER_BASE_HEIGHT}px`,
  position: "absolute" as const,
  top: "50%",
  left: "50%",
  transformOrigin: "center center",
}));

function handleFrameCapture(dataUrl: string) {
  if (transitionFrameTimer) {
    clearTimeout(transitionFrameTimer);
    transitionFrameTimer = null;
  }
  transitionFrame.value = dataUrl;
  transitionFrameTimer = window.setTimeout(() => {
    transitionFrame.value = null;
    transitionFrameTimer = null;
  }, 1500);
}

function handlePlayerPlaying() {
  if (transitionFrameTimer) {
    clearTimeout(transitionFrameTimer);
    transitionFrameTimer = null;
  }
  if (transitionFrame.value) {
    transitionFrame.value = null;
  }
}

const isPaused = ref(false);
const { escape } = useMagicKeys();
watch(escape!, async (pressed) => {
  if (pressed) {
    await mediaStore.setEffectAudioAsync("esc");
    isPaused.value = !isPaused.value;
  }
});

async function handleDone() {
  await saveStore.progressVideo();
  if (playerInstructions.value.length === 0) {
    router.push("/storylines");
  }
}

async function handleContinue() {
  await mediaStore.setEffectAudioAsync("音效7");
  isPaused.value = false;
}

async function handleToStoryline() {
  await mediaStore.setEffectAudioAsync("音效7");
  router.push("/storylines");
}

async function handleToSettings() {
  await mediaStore.setEffectAudioAsync("音效7");
  router.push("/settings");
}

onMounted(async () => {
  updateScale();
  window.addEventListener("resize", updateScale);
  mediaStore.pauseBGMAudio();
  await saveStore.startVideo();
});

onUnmounted(() => {
  if (transitionFrameTimer) {
    clearTimeout(transitionFrameTimer);
    transitionFrameTimer = null;
  }
  window.removeEventListener("resize", updateScale);
});
</script>
<template>
  <div class="container">
    <PageNavButton v-if="playerInstructions.length === 0" />
    <LoadingOverlay v-if="playerInstructions.length === 0" />

    <StoryletPlayer
      class="player-view"
      v-for="(instruction, index) in visibleInstructions"
      :key="instruction.videoId"
      :instruction="instruction"
      :show-controls="true"
      :show-video-js-controls="false"
      :play="index === 0"
      :prewarm="index > 0"
      :pause="isPaused"
      @done="handleDone"
      @frame-capture="handleFrameCapture"
      @playing="handlePlayerPlaying"
    />

    <div v-if="transitionFrame" class="transition-freeze" :style="transitionFreezeStyle" aria-hidden="true">
      <img :src="transitionFrame" alt="" />
    </div>

    <div v-if="isPaused" class="pause-menu">
      <MenuButton :text="$t('esc.continueStory')" @click="handleContinue" />
      <MenuButton :text="$t('esc.backToStoryline')" @click="handleToStoryline" />
      <MenuButton :text="$t('esc.settings')" @click="handleToSettings" />
    </div>
  </div>
</template>
<style scoped>
.player-view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.pause-menu {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 15%;
  background-image: url(/common/images/esc背景.webp);
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
}

.transition-freeze {
  position: absolute;
  z-index: 95;
  pointer-events: none;
}

.transition-freeze img {
  width: 100%;
  height: 100%;
  object-fit: fill;
  display: block;
}
</style>
