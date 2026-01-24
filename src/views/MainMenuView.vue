<script setup lang="ts">
import BarButton from "@/components/BarButton.vue";
import MenuButton from "@/components/MenuButton.vue";
import router from "@/router";
import { useMediaStore } from "@/stores/media";
import { onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const mediaStore = useMediaStore();
const appVersion = computed(() => `v${import.meta.env.VITE_APP_VERSION} | ${t("bottomBar.demo")}`);

onMounted(async () => {
  try {
    await mediaStore.setBGMAudioAsync("main_bgm", 20);
  } catch (error) {
    let retryTimer: number | null = null;

    async function retry() {
      try {
        await mediaStore.resumeBGMAudioAsync();
        document.removeEventListener("click", retry);
        document.removeEventListener("keydown", retry);
        document.removeEventListener("touchstart", retry);
        if (retryTimer) {
          clearInterval(retryTimer);
        }
      } catch {}
    }

    document.addEventListener("click", retry);
    document.addEventListener("keydown", retry);
    document.addEventListener("touchstart", retry);
    retryTimer = window.setInterval(retry, 500);
  }
});

async function navigateTo(path: string) {
  await mediaStore.setEffectAudioAsync("音效3");
  router.push(path);
}

async function playHoverSound() {
  await mediaStore.setEffectAudioAsync("音效4");
}
</script>
<template>
  <div class="container">
    <!-- 背景视频 -->
    <video class="video" src="/common/videos/main.mp4" autoplay muted loop></video>

    <div class="overlay">
      <!-- 左侧菜单按钮 -->
      <div class="left-menu">
        <MenuButton :text="$t('menu.startStory')" @click="" @pointerenter="playHoverSound" />
        <MenuButton
          :text="$t('menu.chapterSelection')"
          @click="navigateTo('/chapters')"
          @pointerenter="playHoverSound" />
        <MenuButton :text="$t('menu.portfolios')" @click="navigateTo('/portfolios')" @pointerenter="playHoverSound" />
        <MenuButton :text="$t('menu.exitGame')" @click="" @pointerenter="playHoverSound" />
      </div>

      <!-- 底栏 -->
      <div class="bottom-bar">
        <span class="version">{{ appVersion }}</span>
        <span class="copyright">© 2026 {{ $t("bottomBar.copyright") }}</span>
        <div class="bottom-btn">
          <BarButton :text="$t('bottomBar.settings')" @click="navigateTo('/settings')" @pointerenter="playHoverSound" />
          <BarButton
            :text="$t('bottomBar.announcements')"
            @click="navigateTo('/announcements')"
            @pointerenter="playHoverSound" />
          <BarButton :text="$t('bottomBar.eula')" @click="navigateTo('/eula')" @pointerenter="playHoverSound" />
          <BarButton
            :text="$t('bottomBar.achievements')"
            @click="navigateTo('/achievements')"
            @pointerenter="playHoverSound" />
          <BarButton :text="$t('bottomBar.credits')" @click="navigateTo('/credits')" @pointerenter="playHoverSound" />
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

@media (max-width: 1024px) {
  .bottom-btn {
    gap: 0px;
  }
}
</style>
