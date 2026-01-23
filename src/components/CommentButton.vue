<script setup lang="ts">
const props = defineProps<{
  type: "like" | "dislike";
  text: string | number;
}>();

const emit = defineEmits<{
  (e: "click"): void;
  (e: "pointerenter"): void;
}>();
</script>
<template>
  <button class="btn" @click="emit('click')" @pointerenter="emit('pointerenter')">
    <div class="image" :class="type"></div>
    <span>{{ text }}</span>
  </button>
</template>
<style scoped>
.btn {
  position: relative;
  color: inherit;
  background-color: transparent;
  border: none;
  font-size: 20px;
  font-family: inherit;
  transition: color 0.36s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.image {
  width: 50px;
  height: 50px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transition: background-image 0.3s;
}
.image.like {
  background-image: url("/common/images/赏按钮.webp");
}
.btn:hover .image.like,
.btn:focus .image.like {
  background-image: url("/common/images/赏按钮高亮.webp");
}
.image.dislike {
  background-image: url("/common/images/贬按钮.webp");
}
.btn:hover .image.dislike,
.btn:focus .image.dislike {
  background-image: url("/common/images/贬按钮高亮.webp");
}
</style>
