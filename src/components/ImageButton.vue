<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  defaultIcon: string;
  highlightIcon: string;
  sideLength: number;
  mobileSideLength?: number;
}>();

const emit = defineEmits<{
  (e: "click"): void;
  (e: "pointerenter"): void;
}>();

// 计算单位，确保带有 px
const widthStr = computed(() => `${props.sideLength}px`);
const mobileWidthStr = computed(() => `${props.mobileSideLength ?? props.sideLength}px`);
const defaultIconUrl = computed(() => `url(${props.defaultIcon})`);
const highlightIconUrl = computed(() => `url(${props.highlightIcon})`);
</script>

<template>
  <button class="btn" @click="emit('click')" @pointerenter="emit('pointerenter')">
    <div class="image"></div>
  </button>
</template>

<style scoped>
.btn {
  position: relative;
  background-color: transparent;
  border: none;
  /* 使用 v-bind 直接绑定计算后的属性 */
  width: v-bind(widthStr);
  height: v-bind(widthStr);
  padding: 0;
  cursor: pointer;
}

.image {
  background-image: v-bind(defaultIconUrl);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transition: background-image 0.3s;
  width: 100%;
  height: 100%;
}

.btn:hover .image,
.btn:focus .image {
  background-image: v-bind(highlightIconUrl);
}

@media (max-height: 500px) {
  .btn {
    width: v-bind(mobileWidthStr);
    height: v-bind(mobileWidthStr);
  }
}
</style>
