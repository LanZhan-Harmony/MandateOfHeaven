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
    <img class="background" src="/common/images/进度条底色-黑.webp" />
    <img class="dynamic" :style="progressWidth" src="/common/images/进度条-暗.webp" />
  </div>
</template>
<style scoped>
.progress-bar {
  position: relative;
  width: 100%;
  height: 20px;
}
.background {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.dynamic {
  position: absolute;
  height: 100%;
  object-fit: cover;
  transition: width 0.3s;
  flex-shrink: 0;
}
</style>
