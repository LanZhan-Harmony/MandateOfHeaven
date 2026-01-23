<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";

const props = defineProps<{
  text: string;
}>();

const emit = defineEmits<{
  (e: "click"): void;
  (e: "pointerenter"): void;
}>();

const TOTAL_FRAMES = 12; // 精灵图总帧数
const FRAME_DURATION = 30; // 每帧持续时间（毫秒）

const currentFrame = ref(0);
const targetFrame = ref(0);

let animationFrameId: number | null = null;
let lastFrameTime = 0;

const backgroundPositionY = computed(() => {
  return (currentFrame.value / (TOTAL_FRAMES - 1)) * 100;
});

const shineStyle = computed(() => {
  return {
    backgroundImage: `url(/common/images/btn_shine.webp)`,
    backgroundPosition: `center ${backgroundPositionY.value}%`,
    backgroundSize: `100% ${TOTAL_FRAMES * 100}%`,
  };
});

function updateAnimation(timestamp: number) {
  if (lastFrameTime === 0) {
    lastFrameTime = timestamp;
  }

  if (timestamp - lastFrameTime >= FRAME_DURATION) {
    lastFrameTime = timestamp;
    if (currentFrame.value < targetFrame.value) {
      currentFrame.value++;
    } else if (currentFrame.value > targetFrame.value) {
      currentFrame.value--;
    } else {
      animationFrameId = null;
      return;
    }
  }

  animationFrameId = requestAnimationFrame(updateAnimation);
}

function animateToTargetFrame(frame: number) {
  targetFrame.value = frame;
  if (animationFrameId === null) {
    lastFrameTime = 0;
    animationFrameId = requestAnimationFrame(updateAnimation);
  }
}

function handlePointerEnter() {
  emit("pointerenter");
  animateToTargetFrame(TOTAL_FRAMES - 1);
}

function handlePointerLeave() {
  animateToTargetFrame(0);
}

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>
<template>
  <button class="btn" @click="emit('click')" @pointerenter="handlePointerEnter" @pointerleave="handlePointerLeave">
    <div class="shine" :style="shineStyle"></div>
    <span>{{ text }}</span>
  </button>
</template>
<style scoped>
.btn {
  position: relative;
  color: inherit;
  background-color: transparent;
  border: none;
  font-size: 20px;
  font-family: inherit;
  transition: color 0.36s;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.btn:hover {
  color: #fff;
}
.shine {
  aspect-ratio: 1;
  position: relative;
  top: 0;
  left: 0;
  width: 40px;
  height: 40px;
  pointer-events: none;
  background-repeat: no-repeat;
}
</style>
