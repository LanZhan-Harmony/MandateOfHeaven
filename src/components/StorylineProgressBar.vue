<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  progress: number;
}>();

const progressWidth = computed(() => {
  return { width: `${props.progress * 100}%` };
});
</script>
<template>
  <div class="progress-bar">
    <div class="dynamic" :style="progressWidth" />
  </div>
</template>
<style scoped>
.progress-bar {
  position: relative;
  width: 100%;
  height: 20px;
  background-image: url(/common/images/进度条底色-黑.webp);
  background-repeat: no-repeat;
  background-size: contain;
  overflow: hidden;
}
.dynamic {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  transition: width 0.3s;
  flex-shrink: 0;
  background-image: url(/common/images/进度条-暗.webp);
  background-repeat: no-repeat;
  background-size: contain;
}
</style>
