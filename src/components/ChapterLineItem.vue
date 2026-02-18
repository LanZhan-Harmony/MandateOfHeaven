<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  chapterIndex: number;
  iconPath: string;
  selected?: boolean;
  locked?: boolean;
  title: string;
}>();

const emit = defineEmits<{
  (e: "click"): void;
  (e: "pointerenter"): void;
}>();

const isHighlighted = ref(false);

function handleClick() {
  if (!props.locked) {
    emit("click");
  }
}

function handlePointerEnter() {
  if (!props.locked) {
    isHighlighted.value = true;
    emit("pointerenter");
  }
}

function handlePointerLeave() {
  isHighlighted.value = false;
}
</script>
<template>
  <button
    class="btn"
    :class="{
      highlighted: isHighlighted,
      selected: selected,
      locked: locked,
    }"
    @click="handleClick"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave">
    <div class="content">
      <span class="icon">
        <img v-if="!isHighlighted && !selected" class="default-icon" :src="iconPath" />
        <img v-else class="selected-icon" src="/common/images/点高亮.svg" />
      </span>
    </div>
  </button>
</template>
<style scoped></style>
