<!--
  QteClick.vue - 点击类QTE
  在屏幕指定位置显示一个可点击区域，用户点击后触发 success 事件。
  描述文字通过 i18n 从 nodes.{storyletId}.qte1 获取。
  位置通过 CSS 变量 (useCssVars) 驱动。
-->

<script setup lang="ts">
import { computed, useCssVars } from "vue";
import { useI18n } from "vue-i18n";
import type { storylineType } from "../types/storylineType";
import { convertToStoryletId } from "../utils/converter";

const { tm } = useI18n();

const props = defineProps<{
  videoId: string;
  x: number;
  y: number;
}>();

const emit = defineEmits(["success"]);

const storylines = computed(() => tm("storylines") as storylineType[]);

const descriptionText = computed(() => {
  const storyletId = convertToStoryletId(props.videoId);
  const storylet = storylines.value.find((s) => s.id === storyletId);
  return storylet?.qte1 || "";
});

const xPercent = computed(() => `${(props.x / 1920) * 100}%`);
const yPercent = computed(() => `${(props.y / 1080) * 100}%`);

/** CSS 变量注入（由 Vue 编译器转换为 --v{hash} 变量） */
useCssVars(() => ({
  xPercent: xPercent.value,
  yPercent: yPercent.value,
}));

const handleClick = () => {
  emit("success");
};
</script>

<template>
  <div class="qte-container">
    <div class="qte-click" @click.stop="handleClick">
      <div class="qte-text">点击</div>
    </div>
    <div class="qte-description-text">{{ descriptionText }}</div>
  </div>
</template>

<style scoped>
.qte-container {
  width: 100%;
  height: 100%;
}

.qte-click {
  left: v-bind(xPercent);
  top: v-bind(yPercent);
  pointer-events: auto;
  background-color: #000c;
  border: 2px solid #ffe6c8cc;
  border-radius: 100%;
  width: 100px;
  height: 100px;
  position: absolute;
  transform: translate(-50%, -50%);
}

.qte-description-text {
  left: calc(v-bind(xPercent) + 100px);
  top: calc(v-bind(yPercent) + 80px);
  color: #fff8ed;
  text-shadow: 0 0 10px #00000080;
  width: 100px;
  height: 100px;
  font-size: 20px;
  position: absolute;
  transform: translate(-50%, -50%);
}

.qte-text {
  text-align: center;
  pointer-events: none;
  color: #fff8ed;
  justify-content: center;
  align-items: center;
  font-size: 25px;
  display: flex;
  position: absolute;
  inset: 0;
}
</style>
