<script setup lang="ts">
import { useDialogStore } from "@/stores/dialog";

const dialogStore = useDialogStore();
</script>
<template>
  <div v-if="dialogStore.isAlertOpen" class="global-alert-overlay">
    <div
      class="global-alert-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="dialogStore.alertTitle || $t('dialog.closeDialog')">
      <!-- 顶部装饰图（弹窗顶部装饰.webp，通过 CSS 背景图实现） -->
      <div class="global-alert-title"></div>

      <!-- 弹窗正文 -->
      <div class="global-alert-message">{{ dialogStore.alertMessage }}</div>

      <!-- 操作按钮区 -->
      <div class="global-alert-actions">
        <!-- 次要按钮（取消/cancelText），仅当 alertShowCancel 为 true 时显示 -->
        <button
          v-if="dialogStore.alertShowCancel"
          class="global-alert-button global-alert-button--secondary"
          :aria-label="$t('dialog.closeDialog')"
          @click="dialogStore.cancelAlert()">
          {{ dialogStore.alertCancelText || $t("dialog.closeDialog") }}
        </button>

        <!-- 主要按钮（确认/confirmText） -->
        <button class="global-alert-button" :aria-label="$t('dialog.closeDialog')" @click="dialogStore.confirmAlert()">
          {{ dialogStore.alertConfirmText || $t("dialog.closeDialog") }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 半透明黑色遮罩，覆盖整个画面，z-index: 999 */
.global-alert-overlay {
  z-index: 999;
  background: #0009;
  place-items: center;
  display: grid;
  position: absolute;
  inset: 0;
}

/* 弹窗主体 */
.global-alert-dialog {
  white-space: pre-wrap;
  color: #ffe9d0;
  background: linear-gradient(#2e2012c9 37.02%, #0000007d 100%);
  border: 1px solid #2e2012c9;
  border-radius: 12px;
  gap: 1lh;
  width: auto;
  min-width: 400px;
  height: auto;
  padding: 2%;
}

/* 顶部装饰图（弹窗顶部装饰.webp） */
.global-alert-title {
  background-image: url(/common/images/弹窗顶部装饰.webp);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: contain;
  width: 100%;
  height: 60px;
}

/* 弹窗正文 */
.global-alert-message {
  text-align: center;
  font-size: 1.1em;
  line-height: 1.6;
}

/* 按钮区：居中排列，有间距 */
.global-alert-actions {
  justify-content: center;
  gap: 1lh;
  margin-top: 2lh;
  display: flex;
}

/* 按钮通用样式 */
.global-alert-button {
  color: #ffe9d0;
  cursor: pointer;
  background: transparent;
  border: 1px solid #ffe9d0;
  border-radius: 8px;
  padding: 0.4lh 1lh;
  font-size: 1.1em;
}

/* 次要按钮（取消）：镂空风格 */
.global-alert-button.global-alert-button--secondary {
  color: #ffe9d0;
  background: transparent;
  border-color: #ffe9d0;
}

/* 主要按钮（确认）：实心高亮风格，深色文字 */
.global-alert-button:not(.global-alert-button--secondary) {
  color: #1b1513;
  background: #ffe9d0;
  border-color: #ffe9d0;
  font-weight: 700;
}
</style>
