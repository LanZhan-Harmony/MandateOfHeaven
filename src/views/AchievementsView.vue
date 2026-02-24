<script setup lang="ts">
import { useAchievementStore } from "@/stores/achievement";
import type { achievementType } from "@/types/achievementType";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import PageNavButton from "../components/PageNavButton.vue";

const { tm } = useI18n();
const achievementStore = useAchievementStore();
const achievements = computed(() => tm("achievements") as achievementType[]);
</script>

<template>
  <div class="container">
    <PageNavButton />

    <div class="achievements-list">
      <div
        v-for="achievement in achievements"
        :key="achievement.id"
        class="achievement-item"
        :class="{ locked: !achievementStore.isActivated(achievement.id) }">
        <div class="achievement-icon">
          <img :src="`/achievements/${achievement.id}.jpg`" :alt="achievement.name" />
        </div>
        <div class="achievement-content">
          <div class="achievement-name">{{ achievement.name }}</div>
          <div class="achievement-desc">{{ achievement.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  height: 100vh;
  width: 100vw;
  overflow-y: auto;
  padding: 80px 20% 40px; /* Center content with padding */
  box-sizing: border-box;
}

.achievements-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  overflow-y: auto;
}

.achievement-item {
  display: flex;
  background-color: #16202d;
  padding: 15px;
  border-radius: 4px; /* Slight rounding but mostly square like Steam */
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  align-items: center;
  transition: background-color 0.2s;
}

.achievement-item:not(.locked):hover {
  background-color: #1a2736;
}

.achievement-icon {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  margin-right: 20px;
  background-color: #000;
  border: 1px solid #3c3d3e; /* Dark border for placeholder/frame */
}

.achievement-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.achievement-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-grow: 1;
}

.achievement-name {
  font-size: 1.1rem;
  font-weight: bold;
  color: #dcdedf;
  margin-bottom: 6px;
}

.achievement-desc {
  font-size: 0.9rem;
  color: #8f98a0;
  line-height: 1.4;
}

/* Locked state styling */
.achievement-item.locked {
  background-color: #1a1a1a; /* Darker background for locked items */
  opacity: 0.7;
}

.achievement-item.locked .achievement-icon img {
  filter: grayscale(100%) brightness(0.4);
}

.achievement-item.locked .achievement-name {
  color: #626366;
}

.achievement-item.locked .achievement-desc {
  color: #4f5357;
}

::-webkit-scrollbar {
  width: 8px;
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
</style>
