<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import ImageButton from "../components/ImageButton.vue";
import router from "../router";
import { useAchievementStore } from "../stores/achievement";
import { useMediaStore } from "../stores/media";
import type { achievementType } from "../types/achievementType";

const { tm } = useI18n();
const mediaStore = useMediaStore();
const achievementStore = useAchievementStore();
const achievements = computed(() => tm("achievements") as achievementType[]);

async function handleBack() {
  await mediaStore.setEffectAudioAsync("音效7");
  router.back();
}
</script>

<template>
  <div class="container">
    <div class="nav">
      <h1>{{ $t("bottomBar.achievements") }}</h1>
      <div class="separator"></div>
      <ImageButton
        default-icon="/common/images/关闭.webp"
        highlight-icon="/common/images/关闭高亮.webp"
        :side-length="40"
        :mobile-side-length="24"
        @click="handleBack" />
    </div>

    <div class="achievements-list">
      <div
        v-for="achievement in achievements"
        :key="achievement.id"
        class="achievement-item"
        :class="{ locked: achievementStore.isActivated(achievement.id) === false }">
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
  position: absolute;
  background-image: url(/common/images/关于.webp);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: cover;
  width: 100%;
  height: 100%;
  padding: 3% 6%;
  display: flex;
  flex-direction: column;
}
.nav {
  width: 100%;
  margin-bottom: 24px;
  position: relative;
  display: flex;
  align-items: center;
}
.separator {
  flex-grow: 1;
}

.achievements-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  overflow-y: auto;
  padding-right: 16px; /* 留出滚动条间距 */
}

.achievement-item {
  display: flex;
  background-color: rgba(25, 20, 15, 0.75);
  padding: 16px;
  border-radius: 6px;
  border: 1px solid rgba(145, 131, 117, 0.2);
  box-shadow:
    inset 0 0 10px rgba(0, 0, 0, 0.5),
    0 4px 6px rgba(0, 0, 0, 0.3);
  align-items: center;
  transition: all 0.3s ease;
}

.achievement-item:not(.locked):hover {
  background-color: rgba(45, 35, 25, 0.85);
  border-color: rgba(145, 131, 117, 0.5);
  box-shadow:
    inset 0 0 15px rgba(145, 131, 117, 0.1),
    0 6px 8px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

.achievement-icon {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  margin-right: 24px;
  background-color: #000;
  border: 2px solid #918375;
  border-radius: 4px;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.8);
  overflow: hidden;
}

.achievement-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.achievement-item:not(.locked):hover .achievement-icon img {
  transform: scale(1.05);
}

.achievement-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-grow: 1;
}

.achievement-name {
  font-size: 22px;
  font-weight: 600;
  color: #e8dcc8;
  margin-bottom: 8px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  letter-spacing: 1px;
}

.achievement-desc {
  font-size: 16px;
  color: #b5a390;
  line-height: 1.5;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
}

/* Locked state styling */
.achievement-item.locked {
  background-color: rgba(15, 15, 15, 0.6);
  border-color: rgba(80, 80, 80, 0.3);
  opacity: 0.8;
}

.achievement-item.locked .achievement-icon {
  border-color: #4a4a4a;
}

.achievement-item.locked .achievement-icon img {
  filter: grayscale(100%) brightness(0.3) sepia(20%) hue-rotate(180deg);
}

.achievement-item.locked .achievement-name {
  color: #7a7a7a;
}

.achievement-item.locked .achievement-desc {
  color: #5a5a5a;
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

@media (max-height: 500px) {
  h1 {
    font-size: 24px;
  }
  .container {
    padding: 2% 5%;
  }
  .nav {
    margin-bottom: 12px;
  }
  .achievements-list {
    gap: 8px;
    padding-right: 12px;
  }
  .achievement-item {
    padding: 10px 12px;
  }
  .achievement-icon {
    width: 48px;
    height: 48px;
    margin-right: 16px;
    border-width: 1px;
  }
  .achievement-name {
    font-size: 16px;
    margin-bottom: 4px;
  }
  .achievement-desc {
    font-size: 14px;
  }
}
</style>
