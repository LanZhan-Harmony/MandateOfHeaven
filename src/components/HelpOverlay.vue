<script setup lang="ts">
import ImageButton from "./ImageButton.vue";
const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>
<template>
  <div class="help">
    <div class="nav">
      <h2>{{ $t("storyline.storylineHelp") }}</h2>
      <div class="separator"></div>
      <ImageButton
        default-icon="/common/images/关闭.webp"
        highlight-icon="/common/images/关闭高亮.webp"
        :side-length="32"
        :mobile-side-length="24"
        @click="emit('close')" />
    </div>
    <div class="content-frame">
      <img src="/common/images/说明页面.webp" aria-label="Help" />
    </div>
  </div>
</template>
<style scoped>
.help {
  pointer-events: auto;
  z-index: 2000;
  position: absolute;
  background-image: url(/common/images/关于.webp);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: cover;
  width: 100%;
  height: 100%;
  padding: 5%;
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

.nav button {
  align-self: flex-end;
}

.content-frame {
  flex-grow: 1;
  overflow-y: scroll;
}

.content-frame img {
  width: 100%;
}

/* ========== 工具类 ========== */
.separator {
  flex: 1;
}

::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb {
  background: #918375;
  border-radius: 10px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
}
::-webkit-scrollbar-thumb:hover {
  background: #b5a390;
}
</style>
