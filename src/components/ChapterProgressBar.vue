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
    <img class="head" src="/common/images/进度条头部.webp" />
    <div class="progress-area">
      <img class="tail" src="/common/images/进度条2.webp" />
      <div class="dynamic">
        <img class="progress-pic" src="/common/images/进度条1.webp" :style="progressWidth" />
        <span class="progress-text">{{ Math.round(progress * 100) }}%</span>
      </div>
    </div>
  </div>
</template>
<style scoped>
.progress-bar {
  display: flex;
  height: 20px;
  align-items: center;
}
.progress-area {
  position: relative;
  flex-grow: 1;
  height: 100%;
  margin: 0 180px 0 -25px;
}
.dynamic {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  z-index: 5;
}
.progress-pic {
  height: 100%;
  object-fit: cover;
  transition: width 0.3s;
}
.head {
  height: 100%;
  z-index: 1;
}
.tail {
  height: 100%;
  position: absolute;
  right: 0;
}
.progress-text {
  font-size: 22px;
  margin-left: 10px;
}
</style>
