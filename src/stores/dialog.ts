import { defineStore } from "pinia";
import { ref } from "vue";

export interface AlertOptions {
  title?: string;
  message: string;
  confirmText?: string;
  showCancel?: boolean;
  cancelText?: string;
}

export const useDialogStore = defineStore("dialog", () => {
  const isAlertOpen = ref(false);
  const alertTitle = ref("");
  const alertMessage = ref("");
  const alertConfirmText = ref("");
  const alertShowCancel = ref(false);
  const alertCancelText = ref("");

  let resolvePromise: (value: boolean) => void;

  const showAlert = (options: AlertOptions): Promise<boolean> => {
    alertTitle.value = options.title || "";
    alertMessage.value = options.message;
    alertConfirmText.value = options.confirmText || "";
    alertShowCancel.value = options.showCancel || false;
    alertCancelText.value = options.cancelText || "";
    isAlertOpen.value = true;

    return new Promise((resolve) => {
      resolvePromise = resolve;
    });
  };

  const confirmAlert = () => {
    isAlertOpen.value = false;
    if (resolvePromise) resolvePromise(true);
  };

  const cancelAlert = () => {
    isAlertOpen.value = false;
    if (resolvePromise) resolvePromise(false);
  };

  return {
    isAlertOpen,
    alertTitle,
    alertMessage,
    alertConfirmText,
    alertShowCancel,
    alertCancelText,
    showAlert,
    confirmAlert,
    cancelAlert,
  };
});
