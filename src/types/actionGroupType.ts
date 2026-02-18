/** 单个动作选项的描述 */
export interface actionItemType {
  /** 显示文本或提示 */
  prompt: string;
  /** 动作索引 */
  index: number;
  /** 唯一标识键 */
  key: string;
}

/** UI 按钮动作组 */
export interface uiButtonActionGroupType {
  type: "ui_button";
  actions: actionItemType[];
  /** 时间限制选项的索引（无时间限制时为 undefined） */
  timeLimitedActionIndex?: number;
}

/** 结局动作组 */
export interface endingActionGroupType {
  type: "ending";
  actions: actionItemType[];
}

/** 动画动作组（章节结束） */
export interface animationActionGroupType {
  type: "animation";
  actions: actionItemType[];
}

/** QTE 动作组 */
export interface qteActionGroupType {
  type: "qte";
  id: string;
  /** QTE 类型（qte_trigger / qte_slide） */
  qteType?: string;
  actions: actionItemType[];
}

export type actionGroupType =
  | uiButtonActionGroupType
  | endingActionGroupType
  | animationActionGroupType
  | qteActionGroupType;
