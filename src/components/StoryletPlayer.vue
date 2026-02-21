<script setup lang="ts">
import { useMediaStore } from "@/stores/media";
import { usePlayerStore } from "@/stores/player";
import { useSaveStore } from "@/stores/save";
import { computed, onMounted, onUnmounted, ref } from "vue";

const mediaStore = useMediaStore();
const saveStore = useSaveStore();
const playerStore = usePlayerStore();

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

// const PLAYBACK_RATES = [0.5, 1, 1.5, 2];

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
  mediaStore.pauseBGMAudio();
});

onUnmounted(() => {
  window.removeEventListener("resize", updateScale);
});
</script>
<template></template>
<style scoped></style>
