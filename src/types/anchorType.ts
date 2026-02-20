export interface anchorType {
  x: number; // X坐标（像素）
  y: number; // Y坐标（像素）
  id: string; // 视频节点ID
  title: string; // 显示标题
  imageUrl: string; // 缩略图URL
  icon: "bronze" | "silver" | "gold" | "chapter-in" | "chapter-out"; // 图标类型
  disabled: boolean; // 是否禁用（不可点击）
  keyNode: boolean; // 是否为关键节点（显示特殊标记）
}
