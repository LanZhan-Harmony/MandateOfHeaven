<script setup lang="ts">
import ChapterLineItem from "../components/ChapterLineItem.vue";
import type { chapterType } from "../types/chapterType";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import PageNavButton from "../components/PageNavButton.vue";
import { useGameStore } from "../stores/game";
import { useMediaStore } from "../stores/media";
import ChapterDescription from "../components/ChapterDescription.vue";

const { tm } = useI18n();
const mediaStore = useMediaStore();
const gameStore = useGameStore();

const chapters = computed(() => tm("chapters") as chapterType[]);
const selectedIndex = ref(0);

const videoSrc = computed(() => {
  return `/chapters/introductions/chapter${selectedIndex.value}/章节图.webm`;
});

const chapterIcons = [
  "/common/images/点序.webp",
  "/common/images/点一.webp",
  "/common/images/点二.svg",
  "/common/images/点三.svg",
  "/common/images/点四.svg",
  "/common/images/点五.svg",
  "/common/images/点六.svg",
  "/common/images/点七.svg",
];

onMounted(() => {
  mediaStore.setBGMAudioAsync("chapter_select_bgm", 45);
});

function handleClick(index: number) {
  selectedIndex.value = index;
}
</script>
<template>
  <div class="container">
    <img class="background" src="/common/images/章节页背景.webp" />
    <PageNavButton class="back-btn" />

    <div class="chapter-list">
      <ChapterLineItem
        v-for="(chapter, index) in chapters"
        :key="chapter.id"
        :iconPath="chapterIcons[index]! || chapterIcons[0]!"
        :title="chapter.title"
        :selected="index === selectedIndex"
        :locked="false"
        @click="handleClick(index)" />
    </div>

    <video :src="videoSrc" autoplay loop muted class="intro-video" />
    <ChapterDescription
      class="description"
      :chapterId="selectedIndex"
      :description="chapters[selectedIndex]!.description"
      :progress="gameStore.chapterProgress[selectedIndex] || 0"
      @click="" />
  </div>
</template>
<style scoped>
.background {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
}
.chapter-list {
  position: absolute;
  left: 3%;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 5px;
  z-index: 1;
}
.intro-video {
  position: absolute;
  right: -10%;
  top: -5%;
  width: 100%;
  z-index: 0;
}
.description {
  position: absolute;
  right: 3%;
  bottom: 5px;
  width: 70%;
  z-index: 1;
}

@media (max-height: 500px) {
  .chapter-list {
    top: 55%;
    left: 5%;
    gap: 0px;
  }
  .intro-video {
    right: 10%;
    top: -5%;
    width: 60%;
  }
}
</style>
