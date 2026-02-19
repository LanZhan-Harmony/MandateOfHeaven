<script setup lang="ts">
import { useGameStore } from "../stores/game";
import BarButton from "../components/BarButton.vue";
import MenuButton from "../components/MenuButton.vue";
import router from "../router";
import { useMediaStore } from "../stores/media";
import { onMounted, computed, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n(); // t 用于获取单条文本翻译
const mediaStore = useMediaStore();
const gameStore = useGameStore();
const appVersion = computed(() => `v${import.meta.env.VITE_APP_VERSION} | ${t("bottomBar.demo")}`);

onMounted(async () => {
  try {
    await mediaStore.setBGMAudioAsync("main_bgm", 20);
  } catch (error) {
    async function retry() {
      try {
        await mediaStore.resumeBGMAudioAsync();
        cleanup();
      } catch (e) {
        // 播放失败（通常是因为用户还未交互），重试逻辑保持
      }
    }

    function cleanup() {
      document.removeEventListener("click", retry);
      document.removeEventListener("keydown", retry);
      document.removeEventListener("touchstart", retry);
    }

    document.addEventListener("click", retry);
    document.addEventListener("keydown", retry);
    document.addEventListener("touchstart", retry);

    // 组件卸载时清理监听器
    onUnmounted(cleanup);
  }
});

async function navigateTo(path: string) {
  await mediaStore.setEffectAudioAsync("音效3");
  router.push(path);
}
</script>
<template>
  <div class="container">
    <!-- 背景视频 -->
    <video class="video" src="/common/videos/main.mp4" autoplay muted loop></video>

    <div class="overlay">
      <!-- 左侧菜单按钮 -->
      <div class="left-menu">
        <MenuButton :text="$t('menu.startStory')" @click="" />
        <MenuButton :text="$t('menu.chapterSelection')" @click="navigateTo('/chapters')" />
        <MenuButton :text="$t('menu.portfolios')" @click="navigateTo('/portfolios')" />
        <MenuButton :text="$t('menu.exitGame')" @click="" />
      </div>

      <!-- 底栏 -->
      <div class="bottom-bar">
        <span class="version">{{ appVersion }}</span>
        <span class="copyright">© 2026 {{ $t("bottomBar.copyright") }}</span>
        <div class="bottom-btn">
          <BarButton :text="$t('bottomBar.settings')" @click="navigateTo('/settings')" />
          <BarButton :text="$t('bottomBar.announcements')" @click="navigateTo('/announcements')" />
          <BarButton :text="$t('bottomBar.eula')" @click="navigateTo('/eula')" />
          <BarButton :text="$t('bottomBar.achievements')" @click="navigateTo('/achievements')" />
          <BarButton :text="$t('bottomBar.credits')" @click="navigateTo('/credits')" />
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.video {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  z-index: -1;
}
.overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 1;
}
.left-menu {
  position: absolute;
  left: 5%;
  bottom: 20%;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.bottom-bar {
  position: absolute;
  bottom: 10px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 50px;
}
.copyright {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}
.bottom-btn {
  display: flex;
  gap: 15px;
}

@media (max-height: 500px) {
  .bottom-btn {
    gap: 0px;
  }
}
</style>
