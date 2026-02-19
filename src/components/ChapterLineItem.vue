<script setup lang="ts">
import { useMediaStore } from "../stores/media";
import { computed } from "vue";

const props = defineProps<{
  iconPath: string;
  selected?: boolean;
  locked?: boolean;
  title: string;
}>();

const emit = defineEmits<{
  (e: "click"): void;
  (e: "pointerenter"): void;
}>();

const mediaStore = useMediaStore();

const highlightStyle = computed(() => {
  return { backgroundImage: props.selected ? "url(/common/images/点高亮.webp)" : `url(${props.iconPath})` };
});

async function handleClick() {
  if (!props.locked) {
    await mediaStore.setEffectAudioAsync("音效3");
    emit("click");
  }
}

async function handlePointerEnter() {
  if (!props.locked) {
    await mediaStore.setEffectAudioAsync("音效11");
    emit("pointerenter");
  }
}
</script>
<template>
  <button
    class="btn"
    :class="{
      selected: selected,
      locked: locked,
    }"
    @click="handleClick"
    @pointerenter="handlePointerEnter">
    <div class="content">
      <span class="icon" :style="highlightStyle"></span>
      <span v-if="locked" class="lock-icon">
        <img src="/common/images/锁.webp" />
      </span>
      <span v-else class="title">{{ title }}</span>
    </div>
  </button>
</template>
<style scoped>
.btn {
  background-image: url("/common/images/章节按钮.webp");
  background-position: 0;
  background-repeat: no-repeat;
  background-size: contain;
  background-color: transparent;
  text-align: left;
  border: none;
  font-family: inherit;
  font-size: 24px;
  width: 220px;
  transition: background-image 0.2s linear;
}

.btn.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:not(.locked):hover {
  background-image: url("/common/images/章节按钮高亮.webp");
}

.content {
  display: flex;
  align-items: center;
  margin: 10px;
  gap: 10px;
}

.icon {
  width: 24px;
  height: 24px;
  background-size: contain;
  background-repeat: no-repeat;
  transition: background-image 0.2s linear;
}

.title {
  color: #fff;
}

@media (max-height: 500px) {
  .btn {
    font-size: 20px;
    height: 35px;
    width: 180px;
  }
  .content {
    margin: 5px;
  }
  .icon {
    width: 24px;
    height: 24px;
  }
}
</style>
