<!--
  QteSlider.vue - 贝塞尔曲线滑动类QTE
  在屏幕上显示一条三次贝塞尔曲线路径，用户需要从起点沿路径滑动到终点。

  bezierPath 格式：[startX, startY, ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, endX, endY]
  坐标参考系：1920 × 1080

  贝塞尔曲线公式：
  B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
  
  渲染结构（全 SVG）：
  - 外层描边蒙版 (outer-stroke-mask)：80px 白 - 60px 黑 → 产生 10px 宽环形描边
  - 内层描边蒙版 (inner-stroke-mask)：88px 白 - 50px 黑 → 内层填充区域
  - 线性渐变：默认态 inner-stroke-fill-gradient、拖动态 inner-selected-fill-gradient
  - 终点尾部：qte_slide_tail 图片（256×256 居中于终点，按切线方向旋转）
  - 箭头标记：qte_slide_arrow 图片（64×64，1/4 1/2 3/4 弧长处，呼吸动画）
  - 拖动进度：stroke-dasharray 递增显示
  -->
<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { computed, ref, watch } from "vue";

/** 尾部图片资源 */
import tailImageUrl from "/common/images/qte_slide_tail.png";
/** 箭头图片资源 */
import arrowImageUrl from "/common/images/qte_slide_arrow.png";

const props = defineProps<{
  bezierPath: number[];
}>();

const emit = defineEmits<{
  (e: "slideSuccess"): void;
}>();

const rootRef = ref<SVGSVGElement | null>(null);

/** 触摸/点击检测半径（像素，参考 1920×1080 坐标系） */
const TOUCH_THRESHOLD = 120;

const isDragging = ref(false);
/** 弧长归一化进度 [0, 1] */
const progress = ref(0);

// ───────── 贝塞尔曲线数学工具 ─────────

/** 获取安全路径坐标 */
function getPathCoords(): [number, number, number, number, number, number, number, number] {
  const p = props.bezierPath;
  if (p && p.length >= 8) {
    return [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]] as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
  }
  return [0, 0, 0, 0, 0, 0, 0, 0];
}

/** 三次贝塞尔插值 */
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  return p0 * (1 - t) ** 3 + 3 * p1 * t * (1 - t) ** 2 + 3 * p2 * t ** 2 * (1 - t) + p3 * t ** 3;
}

/** 获取曲线在参数 t 处的坐标 */
function getBezierPoint(t: number) {
  const [x0, y0, cx1, cy1, cx2, cy2, x1, y1] = getPathCoords();
  return {
    x: cubicBezier(t, x0, cx1, cx2, x1),
    y: cubicBezier(t, y0, cy1, cy2, y1),
  };
}

/** 三次贝塞尔导数（切线方向） */
function getBezierDerivative(t: number) {
  const [x0, y0, cx1, cy1, cx2, cy2, x1, y1] = getPathCoords();
  const u = 1 - t;
  return {
    dx: 3 * u * u * (cx1 - x0) + 6 * u * t * (cx2 - cx1) + 3 * t * t * (x1 - cx2),
    dy: 3 * u * u * (cy1 - y0) + 6 * u * t * (cy2 - cy1) + 3 * t * t * (y1 - cy2),
  };
}

/** 数值积分计算曲线从 t=0 到 t=end 的弧长（1024 步） */
function getCurveLength(end = 1, steps = 1024) {
  let length = 0;
  let prev = getBezierPoint(0);
  for (let i = 0; i < steps; i++) {
    const curr = getBezierPoint((i * end) / steps);
    length += Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
    prev = curr;
  }
  return length;
}

/** 曲线总弧长 */
const totalLength = computed(() => getCurveLength(1));

/** 切线角度（度） */
function getAngleAtT(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const { dx, dy } = getBezierDerivative(clamped);
  if (dx === 0 && dy === 0) {
    const a = getBezierPoint(Math.max(0, clamped - 1e-4));
    const b = getBezierPoint(clamped);
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  }
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** SVG 路径字符串 */
const pathD = computed(() => {
  const [x0, y0, cx1, cy1, cx2, cy2, x1, y1] = props.bezierPath;
  return `M ${x0} ${y0} C ${cx1} ${cy1} ${cx2} ${cy2}, ${x1} ${y1}`;
});

/** 终点坐标 */
const endPoint = computed(() => getBezierPoint(1));

/** 终点切线角度 */
const endAngle = computed(() => getAngleAtT(1));

/**
 * 1/4、1/2、3/4 弧长处的箭头标记（位置 + 角度）
 */
const arrowMarkers = computed(() =>
  [0.25, 0.5, 0.75]
    .map((fraction) => {
      let arcLen = 0;
      let prev = getBezierPoint(0);
      for (let r = 0; r <= 1; r += 1 / 1024) {
        const curr = getBezierPoint(r);
        arcLen += Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
        prev = curr;
        if (arcLen / totalLength.value > fraction) return r;
      }
      return 0;
    })
    .map((t, id) => {
      const pt = getBezierPoint(t);
      return { id, x: pt.x, y: pt.y, angle: getAngleAtT(t) };
    }),
);

/** 找到曲线上距离给定点（参考坐标系 1920×1080）最近的 t 值 */
function findClosestT(mouseX: number, mouseY: number) {
  let closestT = 0;
  let minDistance = Infinity;
  for (let t = 0; t <= 1; t += 1 / 1024) {
    const pt = getBezierPoint(t);
    const dist = Math.sqrt((mouseX - pt.x) ** 2 + (mouseY - pt.y) ** 2);
    if (dist < minDistance) {
      closestT = t;
      minDistance = dist;
    }
  }
  return closestT;
}

// ───────── 指针事件处理 ─────────

function handlePointerDown(event: MouseEvent | TouchEvent) {
  const rect = rootRef.value?.getBoundingClientRect();
  if (!rect) return;

  let clientX: number, clientY: number;
  if (event instanceof TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  const mouseX = ((clientX - rect.left) / rect.width) * 1920;
  const mouseY = ((clientY - rect.top) / rect.height) * 1080;
  const startPoint = getBezierPoint(0);
  if (Math.sqrt((mouseX - startPoint.x) ** 2 + (mouseY - startPoint.y) ** 2) > TOUCH_THRESHOLD) return;
  isDragging.value = true;
}

function handlePointerMove(event: MouseEvent | TouchEvent) {
  if (!isDragging.value) return;
  const rect = rootRef.value?.getBoundingClientRect();
  if (!rect) return;

  let clientX: number, clientY: number;
  if (event instanceof TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  const mouseX = ((clientX - rect.left) / rect.width) * 1920;
  const mouseY = ((clientY - rect.top) / rect.height) * 1080;
  const t = findClosestT(mouseX, mouseY);
  if (Math.sqrt((mouseX - getBezierPoint(t).x) ** 2 + (mouseY - getBezierPoint(t).y) ** 2) > TOUCH_THRESHOLD) {
    isDragging.value = false;
    progress.value = 0;
    return;
  }
  progress.value = getCurveLength(t) / totalLength.value;
}

function handlePointerUp() {
  isDragging.value = false;
  progress.value = 0;
}

useEventListener(rootRef, "mousedown", handlePointerDown);
useEventListener(rootRef, "mousemove", handlePointerMove);
useEventListener(rootRef, "mouseup", handlePointerUp);
useEventListener(rootRef, "touchstart", handlePointerDown);
useEventListener(rootRef, "touchmove", handlePointerMove);
useEventListener(rootRef, "touchend", handlePointerUp);
useEventListener(rootRef, "touchcancel", handlePointerUp);

/** 进度达到 95% 触发成功 */
watch(progress, (value) => {
  if (value >= 0.95) {
    emit("slideSuccess");
  }
});
</script>

<template>
  <svg
    ref="rootRef"
    class="qte-slider"
    width="1920"
    height="1080"
    viewBox="0,0,1920,1080"
    xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- 外层描边蒙版：80px 白描边 - 60px 黑描边 → 产生环形 -->
      <mask id="outer-stroke-mask">
        <rect x="0" y="0" width="100%" height="100%" fill="black" />
        <path :d="pathD" fill="none" stroke="white" stroke-width="80" stroke-linecap="round" />
        <path :d="pathD" fill="none" stroke="black" stroke-width="60" stroke-linecap="round" />
      </mask>
      <!-- 内层描边蒙版：88px 白描边 - 50px 黑描边 → 更宽的填充区域 -->
      <mask id="inner-stroke-mask">
        <rect x="0" y="0" width="100%" height="100%" fill="black" />
        <path :d="pathD" fill="none" stroke="white" stroke-width="88" stroke-linecap="round" />
        <path :d="pathD" fill="none" stroke="black" stroke-width="50" stroke-linecap="round" />
      </mask>
      <!-- 默认态内层渐变 -->
      <linearGradient id="inner-stroke-fill-gradient">
        <stop stop-color="#4A37237F" />
        <stop stop-color="#6750377F" offset="23%" />
        <stop stop-color="#C6A07766" offset="100%" />
      </linearGradient>
      <!-- 拖动态内层渐变（更不透明） -->
      <linearGradient id="inner-selected-fill-gradient">
        <stop stop-color="#4A3723E5" />
        <stop stop-color="#866A4CE5" offset="23%" />
        <stop stop-color="#C6A077E5" offset="100%" />
      </linearGradient>
    </defs>

    <!-- 外层环形描边背景 -->
    <rect x="0" y="0" width="100%" height="100%" mask="url(#outer-stroke-mask)" fill="#A7835CBC" />
    <!-- 内层半透明填充 -->
    <rect x="0" y="0" width="100%" height="100%" mask="url(#inner-stroke-mask)" fill="#4A372323" />
    <!-- 内层渐变描边 -->
    <path :d="pathD" fill="none" stroke="url(#inner-stroke-fill-gradient)" stroke-width="60" stroke-linecap="round" />

    <!-- 终点尾部图片 -->
    <image
      :href="tailImageUrl"
      width="256"
      height="256"
      :x="endPoint.x - 128"
      :y="endPoint.y - 128"
      :transform="`rotate(${endAngle}, ${endPoint.x}, ${endPoint.y})`" />

    <!-- 方向指引箭头（1/4、1/2、3/4 弧长处） -->
    <image
      v-for="arrow in arrowMarkers"
      :key="arrow.id"
      :href="arrowImageUrl"
      width="64"
      height="64"
      :x="arrow.x - 32"
      :y="arrow.y - 32"
      :transform="`rotate(${arrow.angle}, ${arrow.x}, ${arrow.y})`"
      class="qte-arrow"
      :style="{ animationDelay: `${arrow.id * 0.15}s` }" />

    <!-- 拖动进度填充（仅拖动时显示） -->
    <path
      v-if="isDragging"
      :d="pathD"
      fill="none"
      stroke="url(#inner-selected-fill-gradient)"
      stroke-width="70"
      stroke-linecap="round"
      :stroke-dasharray="`${totalLength * progress}, ${totalLength * 2}`" />
  </svg>
</template>

<style scoped>
.qte-slider {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto;
}

/* 方向箭头呼吸动画 */
@keyframes qteArrowPulseOpacity {
  0% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.35;
  }
}

.qte-arrow {
  animation: 1.2s ease-in-out infinite qteArrowPulseOpacity;
}
</style>
