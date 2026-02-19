<script setup lang="ts">
const props = defineProps<{
  text: string;
  direction: "left" | "right";
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();
</script>
<template>
  <button :class="['btn', { right: direction === 'right' }]" @click="$emit('click')">
    <div class="arrow"></div>
    <span>{{ text }}</span>
  </button>
</template>
<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: inherit;
  font-family: inherit;
  font-size: 26px;
  transition:
    color 0.3s,
    filter 0.3s;
}
.btn:hover,
.btn:focus {
  color: #fff;
  filter: drop-shadow(0 0 5px #edb26b);
}
.arrow {
  width: 26px;
  height: 26px;
  background-image: url("/common/images/箭头按钮.webp");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transition: background-image 0.3s;
}
.btn:hover .arrow,
.btn:focus .arrow {
  background-image: url("/common/images/箭头按钮高亮.webp");
}
.right {
  flex-direction: row-reverse;
}
.right .arrow {
  rotate: 180deg;
}

@media (max-height: 500px) {
  .btn {
    font-size: 22px;
    gap: 6px;
  }
  .arrow {
    width: 22px;
    height: 22px;
  }
}
</style>
