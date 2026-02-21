<script setup lang="ts">
import router from "@/router";
import { storeToRefs } from "pinia";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import ChapterDescription from "../components/ChapterDescription.vue";
import ChapterLineItem from "../components/ChapterLineItem.vue";
import PageNavButton from "../components/PageNavButton.vue";
import { useMediaStore } from "../stores/media";
import { useSaveStore } from "../stores/save";
import type { chapterType } from "../types/chapterType";

const { tm } = useI18n();
const mediaStore = useMediaStore();
const saveStore = useSaveStore();

const chapters = computed(() => tm("chapters") as chapterType[]);
const { selectedChapterId } = storeToRefs(saveStore);

const videoSrc = computed(() => {
  return `/chapters/introductions/chapter${selectedChapterId.value}/章节图.webm`;
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
  selectedChapterId.value = saveStore.currentChapterId;
  mediaStore.setBGMAudioAsync("chapter_select_bgm", 45);
});

function handleClick(index: number) {
  selectedChapterId.value = index;
}
async function enterChapter() {
  await router.push("/storylines");
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
        :selected="index === selectedChapterId"
        :locked="saveStore.chapterUnlocked[index] === false"
        @click="handleClick(index)" />
    </div>

    <video :src="videoSrc" autoplay loop muted class="intro-video" />
    <ChapterDescription
      class="description"
      :chapterId="selectedChapterId"
      :description="chapters[selectedChapterId]!.description"
      :progress="saveStore.chapterProgress[selectedChapterId] || 0"
      @click="enterChapter" />
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
