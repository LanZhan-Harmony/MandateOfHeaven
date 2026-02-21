import type { achievementType } from "@/types/achievementType";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

export const useAchievementStore = defineStore("achievement", () => {
  const { tm } = useI18n();

  /** 所有成就 */
  const achievements = computed(() => tm("achievements") as achievementType[]);

  /** 已激活（解锁）的成就 ID 列表，从 localStorage 初始化 */
  const activatedIds = ref<string[]>(JSON.parse(localStorage.getItem("activatedAchievements") || "[]"));

  // 状态变化时自动保存到 localStorage
  watch(
    activatedIds,
    (newIds) => {
      localStorage.setItem("activatedAchievements", JSON.stringify(newIds));
    },
    { deep: true },
  );

  /**
   * 激活/解锁一个成就
   * @param achievementId 成就 ID
   */
  function activateAchievement(achievementId: string) {
    if (!activatedIds.value.includes(achievementId)) {
      activatedIds.value.push(achievementId);
    }
  }

  /**
   * 判断某个成就是否已解锁
   * @param achievementId 成就 ID
   */
  function isActivated(achievementId: string): boolean {
    return activatedIds.value.includes(achievementId);
  }

  /** 已解锁的成就数量 */
  const activatedCount = computed(() => activatedIds.value.length);

  /** 成就总数 */
  const totalCount = computed(() => achievements.value.length);

  /** 解锁进度百分比 (0-100) */
  const progressPercentage = computed(() => {
    if (totalCount.value === 0) return 0;
    return Math.floor((activatedCount.value / totalCount.value) * 100);
  });

  /**
   * 重置所有已解锁成就
   */
  function resetAchievements() {
    activatedIds.value = [];
  }

  return {
    achievements,
    activatedIds,
    activateAchievement,
    isActivated,
    activatedCount,
    totalCount,
    progressPercentage,
    resetAchievements,
  };
});
