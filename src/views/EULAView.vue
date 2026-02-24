<script setup lang="ts">
import ImageButton from "../components/ImageButton.vue";
import router from "../router";
import { useMediaStore } from "../stores/media";

const mediaStore = useMediaStore();

async function handleBack() {
  await mediaStore.setEffectAudioAsync("音效7");
  router.back();
}
</script>
<template>
  <div class="container">
    <div class="nav">
      <h1>{{ $t("bottomBar.eula") }}</h1>
      <div class="separator"></div>
      <ImageButton
        default-icon="/common/images/关闭.webp"
        highlight-icon="/common/images/关闭高亮.webp"
        :side-length="40"
        :mobile-side-length="24"
        @click="handleBack" />
    </div>
  </div>
</template>
<style scoped>
.container {
  position: absolute;
  background-image: url(/common/images/关于.webp);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: contain;
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
@media (max-height: 500px) {
  h1 {
    font-size: 24px;
  }
}
</style>
