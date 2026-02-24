<!--
  ChapterTitle.vue - 章节标题组件
  
  在章节结束时显示两张书法体图片（上/下 或 上/完），
  以及一个可选的操作按钮（"下一章" 或 "返回"）。
  
  当 showButton 为 true 且 ending 为 true 时：
  - 若 noFurtherChapters 为 true：显示 "返回" 按钮
  - 否则：显示 "下一章" 按钮
  
  成就触发：
  每个章节对应一个成就名（大风起、雨打萍、蛟入海、拭锋刀、破山缺、问天命、太平志），
  当 ending && showButton 时激活对应章节的成就。
  -->
<script setup lang="ts">
import { computed, watch } from "vue";
import { useAchievementStore } from "../stores/achievement";
import ArrowButton from "./ArrowButton.vue";

const achievementStore = useAchievementStore();

const props = defineProps<{
  showButton: boolean;
  chapter: number;
  ending: boolean;
  noFurtherChapters: boolean;
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();

/** 各章节对应的成就名称 */
const CHAPTER_ACHIEVEMENTS = [
  "winds_of_change", // 第0章
  "rain_beating_on_duckweed", // 第1章
  "the_trials_begin", // 第2章
  "sharpening_the_blade", // 第3章
  "break_mountains_and_valleys", // 第4章
  "inquiring_of_heavens_mandate", // 第5章
  "the_record_of_great_peace", // 第6章
];

const topImageUrl = computed(() => `/chapters/images/chapter${props.chapter}/上.webp`);
const bottomImageUrl = computed(() => `/chapters/images/chapter${props.chapter}/${props.ending ? "完" : "下"}.webp`);

// 预加载图片资源
preloadImages([topImageUrl.value, bottomImageUrl.value]);

// 当按钮显示时，激活当前章节对应的成就
watch(
  () => props.showButton,
  () => {
    const achievementName = CHAPTER_ACHIEVEMENTS[props.chapter];
    if (achievementName && props.ending && props.showButton) {
      achievementStore.activateAchievement(achievementName);
    }
  },
);

/**
 * 简单的图片预加载
 * @param urls 需要预加载的图片 URL 数组
 */
function preloadImages(urls: string[]) {
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
}
</script>

<template>
  <div class="chapter-title-wrapper">
    <div class="chapter-title">
      <img :src="topImageUrl" />
      <img :src="bottomImageUrl" />
    </div>

    <!-- 操作按钮：仅在结局且 showButton 时显示 -->
    <div v-if="ending && showButton" class="actions">
      <ArrowButton v-if="noFurtherChapters" :text="$t('button.back')" direction="right" @click="emit('click')" />
      <ArrowButton v-else :text="$t('player.enterNextChapter')" direction="right" @click="emit('click')" />
    </div>
  </div>
</template>

<style scoped>
.chapter-title-wrapper {
  opacity: 1;
  transition:
    opacity 1s ease-in-out,
    display 1s allow-discrete;
  pointer-events: none;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.chapter-title {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20%;
}

.chapter-title img {
  width: 100%;
  height: auto;
}

.actions {
  position: absolute;
  bottom: 150px;
  right: 120px;
  scale: 1.4;
}
</style>
