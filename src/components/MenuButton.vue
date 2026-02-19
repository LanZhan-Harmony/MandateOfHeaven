<script setup lang="ts">
import { useMediaStore } from "@/stores/media";
import { computed, onUnmounted, ref } from "vue";

const props = defineProps<{
  text: string;
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();

const mediaStore = useMediaStore();

const TOTAL_FRAMES = 15; // 精灵图总帧数
const FRAME_DURATION = 30; // 每帧持续时间（毫秒）

const currentFrame = ref(0);
const targetFrame = ref(0);

let animationFrameId: number | null = null;
let lastFrameTime = 0;

const backgroundPositionY = computed(() => {
  return (currentFrame.value / (TOTAL_FRAMES - 1)) * 100;
});

const buttonStyle = computed(() => {
  return {
    backgroundImage: `url(/common/images/主界面按钮背景.png)`,
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

async function handlePointerEnter() {
  await mediaStore.setEffectAudioAsync("音效4");
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
  <button
    class="btn"
    :style="buttonStyle"
    @click.passive="emit('click')"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave">
    {{ text }}
  </button>
</template>
<style scoped>
.btn {
  color: inherit;
  vertical-align: middle;
  text-align: left;
  aspect-ratio: 330/95;
  background-color: transparent;
  background-repeat: no-repeat;
  border: none;
  height: 50px;
  padding-left: 16px;
  font-size: 25px;
  font-family: inherit;
  transition: color 0.45s;
  display: inline-block;
}

.btn:hover {
  color: #ffffff;
}

.btn:focus {
  outline: none;
}

@media (max-height: 500px) {
  .btn {
    height: 30px;
    font-size: 18px;
    padding-left: 12px;
  }
}
</style>
