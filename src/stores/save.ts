import { defineStore } from "pinia";
import { computed, ref, toRaw } from "vue";
import { chapterEndingVideoIds } from "../assets/data/chapterEndingVideos.js";
import endings from "../assets/data/endings.json";
import { valueChangeVideoIds } from "../assets/data/valueChangeVideos.js";
import videos from "../assets/data/videos.json";
import type { actionGroupType, uiButtonActionGroupType } from "../types/actionGroupType.js";
import type { archiveType, ffiArgumentType, timelineLineType } from "../types/archiveType.js";
import type { videoType } from "../types/videoType.js";
import { apiClient } from "../utils/apiClient.js";
import { deepArrayEquals } from "../utils/comparer.js";
import { convertToChapterId, convertToStoryletId, convertToVideoId } from "../utils/converter.js";
import { clamp, randomChance } from "./calc.js";
import { usePlayerStore } from "./player.js";

// =============================
// 静态游戏数据
// =============================

const endingsData = endings as Record<string, string>;

/** 所有 storylet 及其视频的映射表 */
const videosData = videos.storylets as videoType[];

/** 所有 storylet ID 列表 */
const allStoryletIds: string[] = videosData.map((s) => s.id);
/** 所有视频 ID 列表 */
const allVideoIds: string[] = videosData.flatMap((s) => s.videos);

/** 按章节（0-7）分组的所有视频 ID 列表 */
const videosByChapter: string[][] = [...Array(8).keys()].map((chapterId) =>
  videosData.filter((s) => convertToChapterId(s.id) === chapterId).flatMap((s) => s.videos),
);

/** 按章节（0-7）分组的所有 storylet ID 列表 */
const storyletsByChapter: string[][] = [...Array(8).keys()].map((chapterId) =>
  videosData.filter((s) => convertToChapterId(s.id) === chapterId).map((s) => s.id),
);

/**
 * 判断给定视频是否为章节结束视频
 * @param videoId 视频 ID
 */
function isChapterEndingVideo(videoId: string): boolean {
  return chapterEndingVideoIds.includes(convertToVideoId(videoId));
}

/**
 * 获取视频对应的结局类型
 * @param videoId 视频 ID
 * @returns 结局类型，如无则返回 null
 */
function getEndingType(videoId: string): "gold" | "silver" | "bronze" | null {
  return (endingsData[convertToStoryletId(videoId)] as "gold" | "silver" | "bronze") || null;
}

// =============================
// 游戏数据查询函数
// =============================

/**
 * 根据 storylet ID 获取其包含的所有视频 ID
 * @param storyletId storylet ID（视频格式或 storylet 格式均可）
 * @returns 视频 ID 数组，若不存在则返回 null
 */
function getVideosFromStorylet(storyletId: string): string[] | null {
  return videosData.find((s) => s.id === convertToStoryletId(storyletId))?.videos ?? null;
}

/**
 * 根据视频 ID 查找其所属的 storylet ID
 * @param videoId 视频 ID
 * @returns storylet ID，若不存在则返回 null
 */
function getStoryletFromVideo(videoId: string): string | null {
  return videosData.find((s) => s.videos.includes(convertToVideoId(videoId)))?.id ?? null;
}

/**
 * 检查视频是否会导致游戏数值变化
 * @param videoId 视频 ID
 * @returns 是否会导致数值变化
 */
function hasValueChanges(videoId: string): boolean {
  return valueChangeVideoIds.includes(convertToVideoId(videoId));
}

export {
  allStoryletIds,
  allVideoIds,
  getEndingType,
  getStoryletFromVideo,
  getVideosFromStorylet,
  hasValueChanges,
  isChapterEndingVideo,
};

// =============================
// Store 定义
// =============================

/**
 * 存档 Store
 *
 * 职责：管理游戏存档数据（与服务器同步）、派生章节进度统计，
 * 以及依赖存档上下文的播放控制（startVideo / progressVideo）。
 * 播放队列的原始状态由 usePlayerStore 持有。
 */
export const useSaveStore = defineStore("save", () => {
  // 依赖注入：在 store setup 顶层获取 player store（无循环模块依赖）
  const playerStore = usePlayerStore();

  // ----------------------------------
  // 响应式状态
  // ----------------------------------

  /** 当前存档（从服务器获取） */
  const currentSave = ref<archiveType | null>(null);

  /** 当前所处的 storylet ID */
  const currentStoryletId = ref<string | null>(null);

  /** 当前选择的章节 ID */
  const selectedChapterId = ref<number>(0);

  // ----------------------------------
  // 计算属性
  // ----------------------------------

  /** 当前章节编号（最大为 7） */
  const currentChapterId = computed<number>(() =>
    currentStoryletId.value ? Math.min(convertToChapterId(currentStoryletId.value), 7) : 0,
  );

  /** 已访问的 storylet ID 列表 */
  const visitedStoryletIds = computed<string[]>(() => currentSave.value?.visited_storylets ?? []);

  /** 已选择的动作记录列表 */
  const selectedActions = computed<string[]>(() => currentSave.value?.selected_actions ?? []);

  /**
   * 可回溯的视频列表
   * 从所有已访问 storylet 中汇总其包含的视频
   */
  const rewindableVideos = computed<(string | null | undefined)[]>(
    () => currentSave.value?.visited_storylets.map((s) => getVideosFromStorylet(s)).flat() ?? [],
  );

  /** 当前时间线上所有 play_video 事件对应的视频 ID 列表 */
  const videosOnCurrentTimeline = computed<string[]>(
    () =>
      currentSave.value?.timeline.lines
        .filter((line): line is ["play_video", string] => line[0] === "play_video")
        .map((line) => line[1]) ?? [],
  );

  /** 各章节的解锁状态（是否有该章节的视频已被访问） */
  const chapterUnlocked = computed<boolean[]>(() =>
    [...Array(8).keys()].map(
      (chapterId) =>
        rewindableVideos.value.some((video) => video && convertToChapterId(video as string) === chapterId) &&
        chapterId <= 7,
    ),
  );

  /** 各章节的完成进度（0-1 浮点数） */
  const chapterProgress = computed<number[]>(() =>
    storyletsByChapter.map((chapterStorylets) => {
      const visitedCount = visitedStoryletIds.value.filter((s) => chapterStorylets.includes(s)).length;
      return clamp(visitedCount / chapterStorylets.length, 0, 1);
    }),
  );

  /** 各章节中尚未播放的视频列表 */
  const unplayedVideosPerChapter = computed<string[][]>(() =>
    videosByChapter.map((chapterVideos) => chapterVideos.filter((video) => !rewindableVideos.value.includes(video))),
  );

  /** 各章节当前时间线上最后播放的视频 ID */
  const chapterCurrentVideo = computed<(string | null)[]>(() =>
    [...Array(8).keys()].map((chapterId) => {
      const line = currentSave.value?.timeline.lines.findLast(
        (l): l is ["play_video", string] => l[0] === "play_video" && convertToChapterId(l[1] as string) === chapterId,
      );
      return line?.[1] ?? null;
    }),
  );

  /**
   * 各章节的数值变化统计
   * 结构：`values[chapterId][valueName] = 累计变化量`
   */
  const values = computed<Record<string, number>[]>(() => {
    const valueChanges: Record<string, number>[] = Array.from({ length: 8 }, () => ({}));
    let currentChapter = -1;

    for (const line of currentSave.value?.timeline.lines ?? []) {
      if (line[0] === "storylet_start") {
        currentChapter = convertToChapterId(line[1] as string);
      }

      if (line[0] === "value_changed" && line.length >= 3 && currentChapter >= 0) {
        const key = line[1] as string;
        const delta = line[2] as number;
        const chapter = valueChanges[currentChapter];
        if (chapter !== undefined) {
          chapter[key] = (chapter[key] ?? 0) + delta;
        }
      }
    }

    return valueChanges;
  });

  /** 是否为新游戏（未开始或处于第一个 storylet） */
  const isNewGame = computed<boolean>(() => !currentSave.value || currentStoryletId.value === "a00_a001_a001");

  // ----------------------------------
  // 状态操作
  // ----------------------------------

  /** 重置存档及播放器的所有本地状态（切换存档或新游戏时调用） */
  async function resetGameState(): Promise<void> {
    currentSave.value = null;
    currentStoryletId.value = null;
    playerStore.resetPlayerState();
  }

  // ----------------------------------
  // 核心函数：同步存档数据
  // ----------------------------------

  /**
   * 将服务器返回的存档数据同步到本地状态，并重建播放指令队列。
   *
   * 处理流程：
   * 1. 对比新旧时间线，计算回滚事件和新增事件
   * 2. 遍历时间线事件，构建 `playerInstructions` 队列
   * 3. 处理 `timeline.actions`（FFI 触发器、UI 按钮等）
   * 4. 如有需要，将队列回溯到指定视频
   * 5. 移除超出第 7 章的视频
   *
   * @param newSave 服务器返回的最新存档
   * @param newStoryletId 强制设置的当前 storylet ID（为 null 时自动处理）
   * @param rewindToVideoId 目标回溯视频 ID（为 null 时不回溯）
   */
  async function syncSaveData(
    newSave: archiveType,
    newStoryletId: string | null = null,
    rewindToVideoId: string | null = null,
  ): Promise<void> {
    const oldSave = currentSave.value;

    const rolledBackEvents: timelineLineType[] = [];
    const newEvents: timelineLineType[] = [];

    // ------------------------------------------------------------------
    // 步骤 1：对比时间线差异（Diff 算法）
    // ------------------------------------------------------------------
    if (!oldSave) {
      // 无旧存档：所有事件均为新增
      newEvents.push(...newSave.timeline.lines);
    } else {
      // 查找回滚点（旧存档中被撤销的部分）
      for (let i = 0; i < oldSave.timeline.lines.length; ++i) {
        if (!deepArrayEquals(oldSave.timeline.lines[i], newSave.timeline.lines[i])) {
          rolledBackEvents.push(...oldSave.timeline.lines.slice(i));
          break;
        }
      }
      // 查找新增点
      for (let i = 0; i < newSave.timeline.lines.length; ++i) {
        if (!deepArrayEquals(oldSave.timeline.lines[i], newSave.timeline.lines[i])) {
          newEvents.push(...newSave.timeline.lines.slice(i));
          break;
        }
      }
    }

    // ------------------------------------------------------------------
    // 步骤 2：确定要处理的事件范围
    // ------------------------------------------------------------------
    let shouldProcessEvents = false;

    if (newStoryletId) {
      currentStoryletId.value = newStoryletId;
    } else {
      shouldProcessEvents = true;
    }

    let eventsToProcess = newEvents.slice();

    // 有回滚或无新事件时，重建完整队列
    if (rolledBackEvents.length > 0 || newEvents.length === 0) {
      playerStore.playerInstructions.length = 0;
      eventsToProcess = newSave.timeline.lines.slice();
    }

    let currentStorylet = "";

    // ------------------------------------------------------------------
    // 步骤 3：遍历时间线事件，构建播放指令队列
    // ------------------------------------------------------------------
    for (const event of eventsToProcess) {
      if (!event) continue;
      const eventType = event[0];

      switch (eventType) {
        // 纯数据事件，不影响播放队列
        case "actions":
        case "assigns_badge":
        case "assigns_state":
        case "value_changed":
          break;

        // 追踪当前 storylet，并在匹配当前节点时开启事件处理
        case "storylet_start":
        case "storylet_end": {
          const storyletEvent = event as ["storylet_start" | "storylet_end", string, ...unknown[]];
          currentStorylet = storyletEvent[1];
          if (currentStorylet === currentStoryletId.value) {
            shouldProcessEvents = true;
          }
          break;
        }

        // 播放视频：构建播放指令推入队列
        case "play_video": {
          if (!shouldProcessEvents) break;

          const playEvent = event as ["play_video", string];
          const videoId = playEvent[1];
          const actionGroups: actionGroupType[] = [];
          const endingType = getEndingType(videoId);

          if (endingType) {
            // 结局视频：附加结局提示动作组
            actionGroups.push({
              type: "ending",
              actions: [{ prompt: endingType, index: convertToChapterId(videoId), key: "unknown" }],
            });
          } else if (isChapterEndingVideo(videoId)) {
            // 章节结束视频：附加章节结束动画动作组
            actionGroups.push({
              type: "animation",
              actions: [{ prompt: "chapter_end", index: convertToChapterId(videoId), key: "unknown" }],
            });
          }

          playerStore.playerInstructions.push({ storyletId: currentStorylet, videoId, loop: false, actionGroups });
          break;
        }

        // FFI 调用（当前支持 qte_continue）
        case "ffi": {
          if (!shouldProcessEvents) break;

          const ffiEvent = event as ["ffi", string, ffiArgumentType[]];
          const ffiType = ffiEvent[1];
          if (!ffiType) break;

          if (ffiType === "qte_continue") {
            const lastInstruction = playerStore.playerInstructions[playerStore.playerInstructions.length - 1];
            if (!lastInstruction) break;
            lastInstruction.loop = true;
            const params = ffiEvent[2] as ffiArgumentType[];
            lastInstruction.actionGroups.push({
              type: "qte",
              id: params.find((p) => p.identifier === "qte_name")?.value_string ?? "",
              actions: [],
            });
          }
          break;
        }
      }
    }

    // ------------------------------------------------------------------
    // 步骤 4：处理待处理动作（timeline.actions）
    // ------------------------------------------------------------------
    const pendingActions = newSave.timeline.actions;
    const firstAction = pendingActions[0];

    if (pendingActions.length > 0 && firstAction?.[0] === "ffi") {
      const ffiAction = firstAction as ["ffi", string, string, string];
      const ffiType = ffiAction[1];

      switch (ffiType) {
        case "possibility_trigger":
          // 概率触发：20% 成功概率
          await commitSaveAction(randomChance(0.2) ? "success" : "failure", pendingActions);
          newSave.timeline.actions = [];
          break;

        case "count_trigger":
          // 计数触发：累计 3 次后触发
          playerStore.specialCounter += 1;
          await commitSaveAction(playerStore.specialCounter >= 3 ? "enough" : "not_enough", pendingActions);
          newSave.timeline.actions = [];
          break;

        case "qte_slide":
        case "qte_trigger": {
          // QTE 触发：将选项附加到当前视频指令上
          const lastInstruction = playerStore.playerInstructions[playerStore.playerInstructions.length - 1];
          if (!lastInstruction) break;
          const currentVideo = lastInstruction.videoId;
          lastInstruction.loop = currentVideo.toLowerCase().includes("loop");
          lastInstruction.actionGroups.push({
            type: "qte",
            id: currentVideo,
            qteType: ffiType,
            actions: pendingActions.map((action, index) => ({
              prompt: action[3] as string,
              index,
              key: action[2] as string,
            })),
          });
          newSave.timeline.actions = [];
          break;
        }

        case "qte_continue":
        default:
          break;
      }
    }

    // 处理普通 UI 按钮动作
    if (newSave.timeline.actions.length > 0) {
      if (playerStore.playerInstructions.length === 0) {
        // 有动作但无视频可挂载，强制执行第一个动作跳过
        await commitSaveAction(0);
        return;
      }

      const uiButtonGroup: uiButtonActionGroupType = {
        type: "ui_button",
        actions: newSave.timeline.actions
          .filter((action) => action[0] === "ui_button")
          .map((action, index) => ({
            prompt: action[1] as string,
            index,
            key: action[2] as string,
          })),
      };

      // 检查是否存在时间限制选项
      const timeLimitIndex = newSave.timeline.actions.findIndex((action) => action[1] === "time_limit_choose");
      if (timeLimitIndex === -1) {
        // 无时间限制：视频循环等待用户操作
        playerStore.playerInstructions[playerStore.playerInstructions.length - 1]!.loop = true;
      } else {
        uiButtonGroup.timeLimitedActionIndex = timeLimitIndex;
      }

      playerStore.playerInstructions[playerStore.playerInstructions.length - 1]!.actionGroups.push(uiButtonGroup);
    }

    // ------------------------------------------------------------------
    // 步骤 5：回溯到指定视频
    // ------------------------------------------------------------------
    if (rewindToVideoId) {
      let rewindIndex = -1;
      for (let i = 0; i < playerStore.playerInstructions.length; ++i) {
        if (playerStore.playerInstructions[i]!.videoId === rewindToVideoId) {
          rewindIndex = i;
          break;
        }
      }
      if (rewindIndex > 0) {
        playerStore.playerInstructions.splice(0, rewindIndex);
      }
    }

    // ------------------------------------------------------------------
    // 步骤 6：移除超出第 7 章的视频（游戏共 8 章，索引 0-7）
    // ------------------------------------------------------------------
    for (let i = 0; i < playerStore.playerInstructions.length; i++) {
      if (convertToChapterId(playerStore.playerInstructions[i]!.videoId) > 7) {
        playerStore.playerInstructions.splice(i);
        break;
      }
    }

    currentSave.value = newSave;
  }

  // ----------------------------------
  // 存档管理函数
  // ----------------------------------

  /** 强制创建新存档并重置所有本地状态 */
  async function forceNewSave(): Promise<void> {
    await Promise.all([apiClient.createArchive(), resetGameState()]);
    await fullSyncSave();
  }

  /**
   * 从服务器完整加载存档。
   * 若无存档则自动创建，并处理循环视频的回溯逻辑。
   */
  async function fullSyncSave(): Promise<void> {
    // 步骤 1：获取存档列表
    const savesList = await apiClient.getAllArchives();

    // 步骤 2：选取现有存档或创建新存档
    const selectedSaveId = savesList.length === 0 ? await apiClient.createArchive() : savesList[0]!.id;

    // 步骤 3：加载存档详情
    const saveData = await apiClient.getArchive(selectedSaveId);

    // 步骤 4：提取当前 storylet
    const lastStoryletLine = saveData.timeline.lines.findLast(
      (line) => line[0] === "storylet_start" || line[0] === "storylet_end",
    );
    currentStoryletId.value = lastStoryletLine && typeof lastStoryletLine[1] === "string" ? lastStoryletLine[1] : null;
    selectedChapterId.value = convertToChapterId(currentStoryletId.value ?? "") || 0;

    // 步骤 5：将所有已访问 storylet 的视频标记为已观看
    for (const storyletId of saveData.visited_storylets) {
      const storyletVideos = getVideosFromStorylet(storyletId);
      if (storyletVideos) {
        for (const videoId of storyletVideos) {
          playerStore.setVideoWatched(videoId);
        }
      }
    }

    // 步骤 6：同步存档数据到本地状态
    await syncSaveData(saveData, currentStoryletId.value);

    // 步骤 7：若最后一个视频在时间线上出现多次（循环视频），则回溯
    const lastPlayVideoLine = saveData.timeline.lines.findLast(
      (line): line is ["play_video", string] => line[0] === "play_video",
    );
    const lastVideo = lastPlayVideoLine?.[1] ?? null;

    if (
      lastVideo &&
      saveData.timeline.lines.filter(
        (line): line is ["play_video", string] => line[0] === "play_video" && line[1] === lastVideo,
      ).length > 1
    ) {
      console.warn("检测到循环视频在时间线上出现多次，执行回溯:", lastVideo);
      await rewindSave(lastVideo);
    }
  }

  /**
   * 推测性同步：仅在本地无存档时才触发完整同步。
   * 适合在应用启动时调用，避免重复加载。
   */
  async function speculativeSyncSave(): Promise<void> {
    if (!currentSave.value) {
      await fullSyncSave();
      // logAllStates();
    }
  }

  /**
   * 提交玩家的动作选择。
   *
   * @param actionIndexOrId 动作索引（number）或动作唯一键（string）
   * @param actionsArray 当传入字符串键时，用于查找索引的动作列表
   */
  async function commitSaveAction(
    actionIndexOrId: number | string,
    actionsArray: unknown[] | null = null,
  ): Promise<void> {
    // 字符串 ID 但没有参照列表：无法解析，直接返回
    if (typeof actionIndexOrId === "string" && !actionsArray) return;

    let actionIndex: number;

    if (typeof actionIndexOrId === "string") {
      // 将字符串 ID 转换为对应索引，找不到时默认使用第一个
      actionIndex = actionsArray!.findIndex((action) => (action as string[])[3] === actionIndexOrId);
      if (actionIndex === -1) actionIndex = 0;
    } else {
      actionIndex = actionIndexOrId;
    }

    // 确保索引在合法范围内
    if (actionIndex < 0 || (actionsArray && actionIndex >= actionsArray.length)) {
      actionIndex = 0;
    }

    const actionResult = await apiClient.actInGame(currentSave.value!.id, actionIndex);
    await syncSaveData(actionResult, null);
  }

  /**
   * 回溯到指定视频。
   * 支持视频 ID 或 storylet ID，函数内部会自动解析。
   *
   * @param id 视频 ID 或 storylet ID
   */
  async function rewindSave(id: string): Promise<void> {
    let storyletId: string | null = convertToStoryletId(id);
    let firstVideoId: string | undefined = getVideosFromStorylet(id)?.[0];

    if (!firstVideoId) {
      // 尝试将 id 作为视频 ID 处理
      firstVideoId = convertToVideoId(id);
      storyletId = getStoryletFromVideo(firstVideoId);
    }

    if (!storyletId || !firstVideoId) {
      console.error("无效的回溯 ID：", id, storyletId, firstVideoId);
      return;
    }

    const jumpResult = await apiClient.jumpInGame(currentSave.value!.id, storyletId);
    await syncSaveData(jumpResult, storyletId, firstVideoId);
  }

  /**
   * 复制指定存档并切换到该存档。
   * @param saveId 要复制的存档 ID
   */
  async function copySave(saveId: number): Promise<void> {
    const copiedSave = await apiClient.copyArchive(saveId);
    await resetGameState();

    if (copiedSave.id === saveId) {
      await fullSyncSave();
    } else {
      await syncSaveData(copiedSave, null);
    }
  }

  // ----------------------------------
  // 播放控制函数
  // ----------------------------------

  /**
   * 开始播放：激活第一个播放指令。
   * 若队列为空，则先回溯到时间线最后一个视频再激活。
   */
  async function startVideo(): Promise<void> {
    if (playerStore.playerInstructions.length === 0) {
      const lastPlayLine = currentSave.value?.timeline.lines.findLast(
        (line): line is ["play_video", string] => line[0] === "play_video",
      );
      if (lastPlayLine?.[1]) {
        await rewindSave(lastPlayLine[1]);
      }
    }

    if (playerStore.currentPlayerInstructionId === -1 && playerStore.playerInstructions.length > 0) {
      playerStore.currentPlayerInstructionId = 0;
      currentStoryletId.value = playerStore.playerInstructions[0]?.storyletId ?? null;
    }
  }

  /**
   * 推进到下一个视频：移除当前指令并更新播放状态。
   */
  async function progressVideo(): Promise<void> {
    if (playerStore.playerInstructions.length === 0) {
      playerStore.currentPlayerInstructionId = -1;
      return;
    }

    if (playerStore.currentPlayerInstructionId >= 0) {
      playerStore.currentPlayerInstructionId = 0;
      playerStore.playerInstructions.shift();
    } else {
      playerStore.currentPlayerInstructionId = 0;
    }

    currentStoryletId.value = playerStore.playerInstructions[0]?.storyletId ?? null;
    toRaw(playerStore.playerInstructions);

    if (playerStore.playerInstructions.length === 0) {
      playerStore.currentPlayerInstructionId = -1;
    }
  }

  function logAllStates(): void {
    console.log("currentSave:", currentSave.value);
    console.log("currentStoryletId:", currentStoryletId.value);
    console.log("visitedStoryletIds:", visitedStoryletIds.value);
    console.log("selectedActions:", selectedActions.value);
    console.log("rewindableVideos:", rewindableVideos.value);
    console.log("videosOnCurrentTimeline:", videosOnCurrentTimeline.value);
    console.log("chapterUnlocked:", chapterUnlocked.value);
    console.log("chapterProgress:", chapterProgress.value);
    console.log("unplayedVideosPerChapter:", unplayedVideosPerChapter.value);
    console.log("chapterCurrentVideo:", chapterCurrentVideo.value);
    console.log("values:", values.value);
    console.log("playerInstructions:", playerStore.playerInstructions);
    console.log("currentPlayerInstructionId:", playerStore.currentPlayerInstructionId);
    console.log("fullyWatchedVideos:", playerStore.fullyWatchedVideos);
    console.log("specialCounter:", playerStore.specialCounter);
  }

  // ----------------------------------
  // 导出 Store 成员
  // ----------------------------------

  return {
    // 原始状态
    currentSave,
    currentStoryletId,
    selectedChapterId,

    // 计算属性
    currentChapterId,
    isNewGame,
    visitedStorylets: visitedStoryletIds,
    selectedActions,
    rewindableVideos,
    videosOnCurrentTimeline,
    chapterUnlocked,
    chapterProgress,
    unplayedVideosPerChapter,
    chapterCurrentVideo,
    values,

    // 只读静态数据
    allStoryletIds,
    allVideoIds,
    hasValueChanges,

    // 状态操作
    resetGameState,

    // 存档管理
    forceNewSave,
    fullSyncSave,
    speculativeSyncSave,
    commitSaveAction,
    rewindSave,
    copySave,

    // 播放控制（依赖存档上下文）
    startVideo,
    progressVideo,
  };
});
