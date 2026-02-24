<!--
  QteTimedClick.vue - 限时点击QTE
  显示一个倒计时收缩圆环，玩家需要在指定时间窗口内点击中心按钮。
  描述文字通过 i18n 从 nodes.{storyletId}.qte1 获取。
  位置和尺寸通过 CSS 变量 (useCssVars) 驱动。
  
  【圆环尺寸公式】
  圆环外径  = duration(s) × 50 + 80  (px)
  可接受窗口环径  = acceptRange(s) × 50 + 80  (px)
  内圆缩放比 = 80 / 外径
  倒计时动画时长 = duration (ms)
  
  【DOM 层叠顺序】
  accept 圆（灰底） → countdown 圆环（收缩动画） → click 按钮（最上层）
  -->
<script setup lang="ts">
import { computed, useCssVars } from "vue";
import { useI18n } from "vue-i18n";
import type { storylineType } from "../types/storylineType";
import { convertToStoryletId } from "../utils/converter";

const { tm } = useI18n();

const props = defineProps<{
  videoId: string;
  /** 总持续时间（毫秒） */
  duration: number;
  /** 当前已播放时间（毫秒），用于判断是否在接受窗口内 */
  elapsedMs: number;
  /** 可接受的时间窗口（毫秒） */
  acceptRange: number;
  /** 相对于 1920 的 X 坐标 */
  x: number;
  /** 相对于 1080 的 Y 坐标 */
  y: number;
}>();

const emit = defineEmits<{
  (e: "success"): void;
  (e: "failure"): void;
}>();

const storylines = computed(() => tm("storylines") as storylineType[]);

const descriptionText = computed(() => {
  const storyletId = convertToStoryletId(props.videoId);
  const storylet = storylines.value.find((s) => s.id === storyletId);
  return storylet?.qte1 || "";
});

const xPercent = computed(() => `${(props.x / 1920) * 100}%`);
const yPercent = computed(() => `${(props.y / 1080) * 100}%`);

const acceptRingSize = computed(() => `${(props.acceptRange / 1000) * 50 + 80}px`);
const animationDuration = computed(() => `${props.duration}ms`);
const outerRingPx = computed(() => (props.duration / 1000) * 50 + 80);
const outerRingSize = computed(() => `${outerRingPx.value}px`);
const innerScaleRatio = computed(() => 80 / outerRingPx.value);

/** CSS 变量注入 */
useCssVars(() => ({
  xPercent: xPercent.value,
  yPercent: yPercent.value,
  acceptRingSize: acceptRingSize.value,
  outerRingSize: outerRingSize.value,
  animationDuration: animationDuration.value,
  innerScaleRatio: innerScaleRatio.value,
}));

const handleClick = () => {
  if (props.elapsedMs >= props.duration - props.acceptRange) {
    emit("success");
  } else {
    emit("failure");
  }
};
</script>

<template>
  <div class="qte-container">
    <!-- 可接受区域（灰色静态圆） -->
    <div class="qte-accept" />
    <!-- 向内收缩的倒计时圆环 -->
    <div class="qte-countdown-ring" />
    <!-- 中心点击按钮 -->
    <div class="qte-click" @click.stop="handleClick">
      <div class="qte-text">{{ descriptionText }}</div>
    </div>
  </div>
</template>

<style scoped>
.qte-container {
  width: 100%;
  height: 100%;
}

/* 可接受区域（灰色静态圆） */
.qte-accept {
  width: v-bind(acceptRingSize);
  height: v-bind(acceptRingSize);
  inset: 0;
  left: v-bind(xPercent);
  top: v-bind(yPercent);
  background-color: #d9d9d9cc;
  border-radius: 100%;
  position: absolute;
  transform: translate(-50%, -50%);
}

/* 倒计时收缩圆环 */
.qte-countdown-ring {
  left: v-bind(xPercent);
  top: v-bind(yPercent);
  width: v-bind(outerRingSize);
  height: v-bind(outerRingSize);
  animation: qteCountdownShrink v-bind(animationDuration) linear forwards;
  pointer-events: none;
  border: 4px solid #ffe6c8cc;
  border-radius: 100%;
  position: absolute;
  transform: translate(-50%, -50%) scale(1);
  box-shadow:
    inset 0 0 12px #c6a0778c,
    0 0 8px #c6a07759;
}

@keyframes qteCountdownShrink {
  0% {
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    transform: translate(-50%, -50%) scale(v-bind(innerScaleRatio));
  }
}

/* 中心点击按钮 */
.qte-click {
  left: v-bind(xPercent);
  top: v-bind(yPercent);
  pointer-events: auto;
  background-color: #000c;
  border: 2px solid #ffe6c8cc;
  border-radius: 100%;
  width: 80px;
  height: 80px;
  position: absolute;
  transform: translate(-50%, -50%);
}

.qte-text {
  text-align: center;
  pointer-events: none;
  color: #fff8ed;
  justify-content: center;
  align-items: center;
  font-size: 22px;
  display: flex;
  position: absolute;
  inset: 0;
}
</style>
