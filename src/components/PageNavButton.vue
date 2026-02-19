<script setup lang="ts">
import router from "@/router";
import { useMediaStore } from "@/stores/media";
import ArrowButton from "./ArrowButton.vue";

const props = defineProps<{
  text?: string;
  path?: string;
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();

const mediaStore = useMediaStore();

async function handleClick() {
  emit("click");
  await mediaStore.setEffectAudioAsync("音效7");
  if (props.path) {
    router.push(props.path);
  } else {
    router.back();
  }
}
</script>
<template>
  <ArrowButton class="nav-btn" :text="text || $t('button.back')" direction="left" @click="handleClick" />
</template>
<style scoped>
.nav-btn {
  position: relative;
  z-index: 1000;
  margin: 35px 0 0 40px;
}
@media (max-height: 500px) {
  .nav-btn {
    margin: 20px 0 0 20px;
  }
}
</style>
