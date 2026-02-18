<script setup lang="ts">
import PageNavButton from "@/components/PageNavButton.vue";
import { useGameStore } from "@/stores/game";
import { useMediaStore } from "@/stores/media";
import { onMounted } from "vue";

const mediaStore = useMediaStore();
const gameStore = useGameStore();

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
</script>
<template>
  <div class="container">
    <img class="background" src="/common/images/章节页背景.webp" />
    <PageNavButton class="back-btn" />
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
</style>
