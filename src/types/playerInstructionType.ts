import type { actionGroupType } from "./actionGroupType";

/** 播放器指令：描述单个视频的播放参数 */
export interface PlayerInstruction {
  /** 所属 storylet ID */
  storyletId: string;
  /** 视频 ID */
  videoId: string;
  /** 是否循环播放（等待用户操作） */
  loop: boolean;
  /** 该视频结束后要显示的动作组列表 */
  actionGroups: actionGroupType[];
}
