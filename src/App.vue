<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { RouterView } from "vue-router";
import DialogOverlay from "./components/DialogOverlay.vue";
import { useSaveStore } from "./stores/save";
import { useUIStore } from "./stores/ui";

const saveStore = useSaveStore();
const uiStore = useUIStore();

// 阻止默认行为的通用函数
function preventDefault(event: Event) {
  event.preventDefault();
}

// Alt+Enter 切换全屏
function handleKeydown(event: KeyboardEvent) {
  if (event.altKey && event.key === "Enter") {
    event.preventDefault();
    uiStore.toggleFullscreen();
  }
}

onMounted(async () => {
  // 初始化游戏存档数据（仅在尚未加载时执行完整同步）
  await saveStore.speculativeSyncSave();

  // 阻止右键菜单、文本选择和拖拽
  window.addEventListener("contextmenu", preventDefault);
  window.addEventListener("selectstart", preventDefault);
  window.addEventListener("dragstart", preventDefault);

  // 全局快捷键：Alt+Enter 切换全屏
  window.addEventListener("keydown", handleKeydown);

  // 应用上次保存的全屏状态（启动时默认全屏）
  await uiStore.applyFullscreen(uiStore.fullscreen);
});

onBeforeUnmount(() => {
  window.removeEventListener("contextmenu", preventDefault);
  window.removeEventListener("selectstart", preventDefault);
  window.removeEventListener("dragstart", preventDefault);
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div id="app-container">
    <RouterView />
    <DialogOverlay />
  </div>
</template>

<style>
#app-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
