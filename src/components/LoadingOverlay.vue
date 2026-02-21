<script setup lang="ts"></script>
<template>
  <div class="loading-overlay">
    <img src="/common/images/加载.webp" aria-label="Loading" />
  </div>
</template>
<style scoped>
.loading-overlay {
  z-index: 100;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5);
}
img {
  width: 50px;
  height: auto;
  rotate: -45deg;
}
</style>
