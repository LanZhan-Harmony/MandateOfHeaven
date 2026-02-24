<!--
  LoopButton.vue - 循环视频选项按钮组件

  在循环视频播放期间显示的可交互选项按钮。
  按钮通过绝对定位放置在画面上（x%, y%），
  支持三种位置样式（left / right / center），
  以及历史选项高亮状态。

  过渡动画：
    - left:   从左侧滑入（-48px → 0）
    - right:  从右侧滑入（+48px → 0）
    - center: 淡入
  
  背景图片：
    - left:   选项A按钮.webp / 选项A按钮高亮.webp
    - right:  选项B按钮.webp / 选项B按钮高亮.webp
    - center: 单选框.webp / 单选框高亮.webp
-->
<script setup lang="ts">
import { computed, useCssVars } from "vue";

const props = defineProps<{
  x: number;
  y: number;
  disabled: boolean;
  inHistory: boolean;
  center: boolean;
  left: boolean;
}>();

const emit = defineEmits<{
  (e: "click"): void;
  (e: "pointerenter"): void;
}>();

const xPercent = computed(() => `${props.x}%`);
const yPercent = computed(() => `${props.y}%`);

/** CSS 变量注入：定位坐标 */
useCssVars(() => ({
  xPercent: xPercent.value,
  yPercent: yPercent.value,
}));

/** 动态 class 对象 */
const classObject = computed(() => ({
  disabled: props.disabled,
  "in-history": props.inHistory,
  center: props.center,
  left: props.left,
  right: !props.center && !props.left,
}));

/** 过渡动画名称 */
const transitionName = computed(() => (props.center ? "loop-center" : props.left ? "loop-left" : "loop-right"));

const handleClick = () => {
  if (!props.disabled) emit("click");
};

const handlePointerEnter = async () => {
  if (!props.disabled) emit("pointerenter");
};
</script>

<template>
  <Transition :name="transitionName">
    <button
      v-show="!disabled"
      :class="['loop-button', classObject]"
      @click.passive="handleClick"
      @pointerenter.passive="handlePointerEnter">
      <slot />
    </button>
  </Transition>
</template>

<style scoped>
.loop-button {
  left: v-bind(xPercent);
  top: v-bind(yPercent);
  vertical-align: middle;
  color: #fff;
  --slide-x: 0;
  background-repeat: no-repeat;
  background-size: cover;
  background-color: transparent;
  border: none;
  min-width: 400px;
  min-height: 100px;
  padding-top: 16px;
  padding-bottom: 16px;
  font-size: 40px;
  position: absolute;
  -webkit-mask-source-type: alpha;
  mask-mode: alpha;
  font-family: inherit;
}

/* 左侧按钮样式 */
.loop-button.left {
  transform: translate(-100%, -50%) translateX(var(--slide-x, 0));
  background-image: url(/common/images/选项A按钮.webp);
  background-position: 100%;
  justify-content: left;
  padding-left: 140px;
  padding-right: 70px;
  -webkit-mask-image: linear-gradient(90deg, #0000 0%, #000 140px);
  mask-image: linear-gradient(90deg, #0000 0%, #000 140px);
}

.loop-button.left:hover,
.loop-button.left:focus {
  background-image: url(/common/images/选项A按钮高亮.webp);
}

/* 右侧按钮样式 */
.loop-button.right {
  transform: translate(0, -50%) translateX(var(--slide-x, 0));
  background-image: url(/common/images/选项B按钮.webp);
  background-position: 0;
  justify-content: right;
  padding-left: 70px;
  padding-right: 140px;
  -webkit-mask-image: linear-gradient(270deg, #0000 0%, #000 140px);
  mask-image: linear-gradient(270deg, #0000 0%, #000 140px);
}

.loop-button.right:hover,
.loop-button.right:focus {
  background-image: url(/common/images/选项B按钮高亮.webp);
}

/* 居中按钮样式 */
.loop-button.center {
  transform: translate(-50%, -50%) translateX(var(--slide-x, 0));
  background-image: url(/common/images/单选框.webp);
  background-position: 50%;
  background-size: contain;
  justify-content: center;
  padding-left: 80px;
  padding-right: 80px;
  -webkit-mask-image: none;
  mask-image: none;
}

.loop-button.center:hover,
.loop-button.center:focus {
  background-image: url(/common/images/单选框高亮.webp);
}

/* 历史选项高亮 */
.loop-button.in-history {
  color: #918375;
}

/* === 过渡动画 === */

/* 左侧滑入/滑出 */
.loop-left-enter-from,
.loop-left-leave-to {
  opacity: 0;
  --slide-x: -48px;
}

.loop-left-enter-to,
.loop-left-appear-to {
  opacity: 1;
  --slide-x: 0;
}

/* 右侧滑入/滑出 */
.loop-right-enter-from,
.loop-right-leave-to {
  opacity: 0;
  --slide-x: 48px;
}

.loop-right-enter-to,
.loop-right-appear-to {
  opacity: 1;
  --slide-x: 0;
}

/* 居中淡入/淡出 */
.loop-center-enter-from,
.loop-center-leave-to {
  opacity: 0;
}

.loop-center-enter-to,
.loop-center-appear-to {
  opacity: 1;
}

/* 所有动画通用 */
.loop-left-enter-active,
.loop-right-enter-active,
.loop-center-enter-active,
.loop-left-leave-active,
.loop-right-leave-active,
.loop-center-leave-active {
  transition:
    opacity 1s,
    transform 1s;
}
</style>
