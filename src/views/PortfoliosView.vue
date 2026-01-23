<script setup lang="ts">
import PageNavButton from "@/components/PageNavButton.vue";
import { useMediaStore } from "@/stores/media";
import { onMounted, ref } from "vue";

const mediaStore = useMediaStore();

const selectedIndex = ref(0);

const ANGLE_STEP = 6;

onMounted(async () => {
  await mediaStore.setBGMAudio("character_bgm", 3);
});

function selectItem(index: number) {
  selectedIndex.value = index;
}

function handleWheel(event: WheelEvent) {
  if (event.deltaY < 0) {
    // 向上滚动
  } else {
    // 向下滚动
  }
}
</script>
<template>
  <div class="container">
    <img class="background" src="/common/images/人物档案背景.webp" />
    <PageNavButton class="back-btn" />
  </div>
</template>
<style scoped>
.background {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
}
</style>
