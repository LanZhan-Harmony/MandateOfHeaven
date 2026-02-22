<!--
  QteHoldCharge.vue - 长按蓄力类QTE
  显示一个需要长按的按钮，按住达到指定时间后触发 success。
  描述文字通过 i18n 从 nodes.{storyletId}.qte1 获取。
  位置和填充高度通过 CSS 变量 (useCssVars) 驱动。
  -->
<script setup lang="ts">
import type { storylineType } from "@/types/storylineType";
import { convertToStoryletId } from "@/utils/converter";
import { computed, onMounted, onUnmounted, ref, useCssVars, watch } from "vue";
import { useI18n } from "vue-i18n";

const { tm } = useI18n();

const props = defineProps<{
  videoId: string;
  holdRequired: number;
  x: number;
  y: number;
}>();
const emit = defineEmits(["success", "failure"]);

const storylines = computed(() => tm("storylines") as storylineType[]);

const descriptionText = computed(() => {
  const storyletId = convertToStoryletId(props.videoId);
  const storylet = storylines.value.find((s) => s.id === storyletId);
  return storylet?.qte1 || "";
});

const xPercent = computed(() => `${(props.x / 1920) * 100}%`);
const yPercent = computed(() => `${(props.y / 1080) * 100}%`);

const isHolding = ref(false);
const holdTime = ref(0);
const completed = ref(false);
let animationFrameId: number | null = null;
let startTime: number | null = null;

/** 进度条填充百分比 */
const fillPercent = computed(() => `${Math.min(holdTime.value / props.holdRequired, 1) * 100}%`);

/** CSS 变量注入 */
useCssVars(() => ({
  fillPercent: fillPercent.value,
  xPercent: xPercent.value,
  yPercent: yPercent.value,
}));

/** 取消正在运行的 requestAnimationFrame */
const cancelAnimation = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

/** 重置所有状态 */
const reset = () => {
  isHolding.value = false;
  holdTime.value = 0;
  startTime = null;
  cancelAnimation();
  completed.value = false;
};

/** 用 requestAnimationFrame 持续更新长按时间 */
const updateHoldTime = (timestamp: number) => {
  if (!isHolding.value || completed.value) return;

  if (startTime === null) {
    startTime = timestamp;
  }

  holdTime.value = timestamp - startTime;

  if (holdTime.value >= props.holdRequired) {
    completed.value = true;
    emit("success");
    return;
  }

  animationFrameId = requestAnimationFrame(updateHoldTime);
};

const startHold = () => {
  if (completed.value) return;
  holdTime.value = 0;
  startTime = null;
  isHolding.value = true;
  cancelAnimation();
  animationFrameId = requestAnimationFrame(updateHoldTime);
};

const endHold = () => {
  if (completed.value) return;
  reset();
};

onMounted(() => {
  reset();
});

onUnmounted(() => {
  cancelAnimation();
});

// 当 videoId 或 holdRequired 变化时重置状态
watch(
  () => props.videoId,
  () => {
    reset();
  },
);
watch(() => props.holdRequired, reset);
</script>

<template>
  <div class="qte-container">
    <div class="qte-hold">
      <button
        class="qte-button"
        @mousedown.passive="startHold"
        @mouseup.passive="endHold"
        @mouseleave.passive="endHold"
        @touchstart.passive="startHold"
        @touchend.passive="endHold"
        @touchcancel.passive="endHold">
        <div class="qte-fill" />
      </button>
      <div class="qte-text">长按</div>
    </div>
    <div class="qte-description-text">{{ descriptionText }}</div>
  </div>
</template>

<style scoped>
.qte-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.qte-hold {
  left: v-bind(xPercent);
  top: v-bind(yPercent);
  width: 80px;
  height: 80px;
  position: absolute;
  transform: translate(-50%, -50%);
}

.qte-button {
  background-color: #000c;
  border: 2px solid #ffe6c8cc;
  border-radius: 100%;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* 按住时从底部上升的填充条 */
.qte-fill {
  width: 100%;
  height: v-bind(fillPercent);
  background: linear-gradient(#c6a077d9 0%, #c6a077a6 60%, #c6a07773 100%);
  position: absolute;
  bottom: 0;
  left: 0;
  box-shadow:
    inset 0 0 12px #c6a0778c,
    0 0 8px #c6a07759;
}

.qte-text {
  text-align: center;
  pointer-events: none;
  color: #fff8ed;
  justify-content: center;
  align-items: center;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  position: absolute;
  inset: 0;
}

.qte-description-text {
  left: calc(v-bind(xPercent) + 100px);
  top: calc(v-bind(yPercent) + 80px);
  color: #fff8ed;
  text-shadow: 0 0 10px #00000080;
  width: 100px;
  height: 100px;
  font-size: 20px;
  font-weight: 700;
  position: absolute;
  transform: translate(-50%, -50%);
}
</style>
