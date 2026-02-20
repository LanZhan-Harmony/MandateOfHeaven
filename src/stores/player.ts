import { defineStore } from "pinia";
import { computed, ref, shallowReactive } from "vue";
import type { PlayerInstruction } from "../types/playerInstructionType.js";

/**
 * 播放器 Store
 *
 * 职责：管理视频播放指令队列、已观看记录，以及触发器计数器。
 * 不感知存档数据，仅维护播放侧的纯粹状态。
 */
export const usePlayerStore = defineStore("player", () => {
  // ----------------------------------
  // 响应式状态
  // ----------------------------------

  /** 播放器指令队列（包含视频 ID、循环标志、动作组信息） */
  const playerInstructions = shallowReactive<PlayerInstruction[]>([]);

  /** 当前正在播放的指令索引（-1 表示未激活） */
  const currentPlayerInstructionId = ref(-1);

  /** 本地记录的已完整观看视频列表，供 UI 展示已看标记 */
  const fullyWatchedVideos = ref<string[]>([]);

  /** 计数触发器专用计数器（累计达到阈值时触发特殊逻辑） */
  const specialCounter = ref(0);

  // ----------------------------------
  // 计算属性
  // ----------------------------------

  /** 当前播放的视频 ID，未激活时为 null */
  const currentVideoId = computed<string | null>(() =>
    currentPlayerInstructionId.value === -1
      ? null
      : (playerInstructions[currentPlayerInstructionId.value]?.videoId ?? null),
  );

  /** 已完整观看的视频 ID 列表（只读） */
  const watchedVideos = computed<string[]>(() => fullyWatchedVideos.value);

  // ----------------------------------
  // 操作方法
  // ----------------------------------

  /**
   * 将指定视频标记为已观看（幂等）
   * @param videoId 视频 ID
   */
  function setVideoWatched(videoId: string): void {
    if (!fullyWatchedVideos.value.includes(videoId)) {
      fullyWatchedVideos.value = [...fullyWatchedVideos.value, videoId];
    }
  }

  /** 重置所有播放器状态（切换存档或新游戏时调用） */
  function resetPlayerState(): void {
    playerInstructions.length = 0;
    currentPlayerInstructionId.value = -1;
    fullyWatchedVideos.value = [];
    specialCounter.value = 0;
  }

  return {
    playerInstructions,
    currentPlayerInstructionId,
    fullyWatchedVideos,
    specialCounter,
    currentVideoId,
    watchedVideos,
    setVideoWatched,
    resetPlayerState,
  };
});
