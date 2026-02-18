export interface archiveType {
  id: number;
  timeline: timelineType;
  /** 已访问的剧情节点 ID 列表 */
  visited_storylets: string[];
  /** 已选择的选项记录，格式通常为 "storylet_id::action_id" */
  selected_actions: string[];
  /** ISO 格式的创建时间 */
  created_at: string;
  /** ISO 格式的更新时间 */
  updated_at: string;
}

/**
 * 时间轴数据
 */
export interface timelineType {
  /** 剧情渲染行，包含视频播放、按钮触发等指令 */
  lines: timelineLineType[];
  /** 当前待处理的交互操作 */
  actions: actionType[];
  /** 历史记录 */
  record: any[];
}

/**
 * 交互操作元组：[类型, 标签文本, 唯一标识符]
 * 例如: ["ui_button", "那我可要不起", "ui_button_f?gh/Sk{)a..."]
 */
export type actionType = ["ui_button", string, string] | ["ffi", string, string, string];

/**
 * FFI 调用参数结构
 */
export interface ffiArgumentType {
  identifier: string; // 参数标识符 (如 "qte_name")
  category: "string" | "number" | "boolean"; // 参数类型
  value_string?: string; // 字符串值
  value_number?: number; // 数值值
  value_boolean?: boolean; // 布尔值
}

/**
 * 时间轴指令行的联合类型定义
 */
export type timelineLineType =
  | ["storylet_start", string] // 节点开始
  | ["storylet_end", string, string[] | []] // 节点结束，包含触发的 Action ID 数组
  | ["play_video", string] // 播放视频 (如 "00_001_001" 或 "02_035_QTE2")
  | ["actions", actionType[]] // 出现交互选项
  | ["assigns_badge", string] // 获得勋章
  | ["assigns_state", string, string] // 设置状态 (节点ID, 状态值)
  | ["value_changed", string, string | number | boolean] // 变量变更 (变量名, 新值)
  | ["ffi", string, ffiArgumentType[]]; // 扩展功能调用 (调用名, 参数列表)
