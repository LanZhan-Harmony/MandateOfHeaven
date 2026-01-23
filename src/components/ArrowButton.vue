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
    <img class="arrow-default" src="/common/images/箭头按钮.webp" />
    <img class="arrow-highlighted" src="/common/images/箭头按钮高亮.webp" />
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
  font-size: 30px;
}
.btn:hover,
.btn:focus {
  color: #fff;
  filter: drop-shadow(0 0 5px #edb26b);
}
.arrow-default,
.arrow-highlighted {
  height: 30px;
}
.arrow-default {
  display: block;
}
.arrow-highlighted {
  display: none;
}
.btn:hover .arrow-default,
.btn:focus .arrow-default {
  display: none;
}
.btn:hover .arrow-highlighted,
.btn:focus .arrow-highlighted {
  display: block;
}
.right {
  flex-direction: row-reverse;
}
.right .arrow-default,
.right .arrow-highlighted {
  rotate: 180deg;
}
</style>
