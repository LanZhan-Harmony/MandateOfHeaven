<script setup lang="ts">
import { useModel } from "vue";

const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
}>();

const modelValue = useModel(props, "modelValue");
</script>

<template>
  <input class="slider" type="range" min="0" max="1" step="0.01" v-model="modelValue" />
</template>

<style scoped>
.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: transparent;
  outline: none;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 50px;
  height: 50px;
  border-radius: 0;
  background-image: url(/common/images/音量条拖动按钮.webp);
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  border: none;
  margin-top: -10px;
}
.slider:hover::-webkit-slider-thumb,
.slider:active::-webkit-slider-thumb {
  background-image: url(/common/images/音量条拖动按钮高亮.webp);
}
.slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 30px;
  background-image: url(/common/images/音量条底色.webp);
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}
.slider:hover::-webkit-slider-runnable-track {
  background-image: url(/common/images/音量条.webp);
}
</style>
