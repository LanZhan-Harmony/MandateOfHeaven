<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { RouterView } from "vue-router";

// 阻止默认行为的通用函数
function preventDefault(event: Event) {
  event.preventDefault();
}

// 尝试进入全屏
function tryEnterFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      // 全屏请求失败通常是因为没有用户交互，或者用户拒绝了
      console.log(`全屏请求失败: ${err.message}`);
    });
  }
}

// 交互处理函数
function handleInteraction() {
  tryEnterFullscreen();
  // 移除监听器，只尝试一次
  window.removeEventListener("click", handleInteraction);
  window.removeEventListener("keydown", handleInteraction);
  window.removeEventListener("touchstart", handleInteraction);
}

onMounted(() => {
  // 阻止右键菜单、文本选择和拖拽
  window.addEventListener("contextmenu", preventDefault);
  window.addEventListener("selectstart", preventDefault);
  window.addEventListener("dragstart", preventDefault);

  // 监听用户交互以触发全屏
  window.addEventListener("click", handleInteraction);
  window.addEventListener("keydown", handleInteraction);
  window.addEventListener("touchstart", handleInteraction);
});

onBeforeUnmount(() => {
  window.removeEventListener("contextmenu", preventDefault);
  window.removeEventListener("selectstart", preventDefault);
  window.removeEventListener("dragstart", preventDefault);

  window.removeEventListener("click", handleInteraction);
  window.removeEventListener("keydown", handleInteraction);
  window.removeEventListener("touchstart", handleInteraction);
});
</script>

<template>
  <RouterView />
</template>

<style></style>
