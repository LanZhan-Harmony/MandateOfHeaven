<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ArrowButton from "./ArrowButton.vue";
import ChapterProgressBar from "./ChapterProgressBar.vue";

const props = defineProps<{
  chapterId: number;
  description: string;
  progress: number;
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();

const chapterIdPicSrc = computed(() => {
  return `/chapters/images/chapter${props.chapterId}/上.webp`;
});
const chapterNamePicSrc = computed(() => {
  return `/chapters/images/chapter${props.chapterId}/下.webp`;
});

const descriptionRef = ref<HTMLElement | null>(null);

watch(
  () => props.chapterId,
  () => {
    if (descriptionRef.value) {
      descriptionRef.value.scrollTop = 0;
    }
  },
);
</script>
<template>
  <div class="description-card">
    <div class="chapter-title">
      <img class="chapter-id-pic" :src="chapterIdPicSrc" />
      <img class="chapter-name-pic" :src="chapterNamePicSrc" />
    </div>
    <div ref="descriptionRef" class="description-text">{{ props.description }}</div>
    <ChapterProgressBar :progress="progress" />
    <ArrowButton :text="$t('chapter.enterChapter')" class="enter-btn" direction="right" @click="$emit('click')" />
  </div>
</template>
<style scoped>
.description-card {
  aspect-ratio: 851/188;
  background-image: url(/common/images/章节页面介绍框.webp);
  background-repeat: no-repeat;
  background-size: contain;
  padding: 4% 4% 4% 4%;
  width: 100%;
  position: relative;
}
.chapter-title {
  position: absolute;
  width: 30%;
  display: flex;
  flex-direction: column;
  top: -25%;
  left: -2%;
  z-index: 100;
}
.description-text {
  font-size: 16px;
  line-height: 20px;
  height: 100%;
  overflow-y: auto;
  text-indent: 2em;
  white-space: pre-wrap;
}
.progress {
  left: 6%;
  width: 60%;
}
.enter-btn {
  position: absolute;
  right: 0;
  bottom: 30%;
}
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb {
  background: #918375; /* 金色系，契合游戏风格 */
  border-radius: 10px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
}
::-webkit-scrollbar-thumb:hover {
  background: #b5a390;
}
@media (max-height: 500px) {
  .description-text {
    font-size: 14px;
  }
}
</style>
