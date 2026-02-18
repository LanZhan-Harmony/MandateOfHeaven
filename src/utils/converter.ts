/**
 * 将任意格式的 ID 规范化为 storylet ID 格式（小写，各段加 `a` 前缀）
 * 幂等：输入已是 storylet 格式时结果不变。
 * @param id 任意格式的 ID（如 "01_002_003" 或 "a01_a002_a003"）
 * @return storylet ID（如 "a01_a002_a003"）
 * @example `"01_002_003"` → `"a01_a002_a003"`
 * @example `"a01_a002_a003"` → `"a01_a002_a003"`
 */
export function convertToStoryletId(id: string): string {
  return `a${id
    .split("_")
    .map((e) => e.replace(/^a/, ""))
    .join("_a")
    .toLowerCase()}`;
}

/**
 * 将任意格式的 ID 规范化为视频 ID 格式（大写，去除各段 `a` 前缀）
 * 幂等：输入已是视频格式时结果不变。
 * @param id 任意格式的 ID（如 "01_002_003" 或 "a01_a002_a003"）
 * @return 视频 ID（如 "01_002_003"）
 * @example `"a01_a002_a003"` → `"01_002_003"`
 * @example `"01_002_003"` → `"01_002_003"`
 */
export function convertToVideoId(id: string): string {
  return id
    .split("_")
    .map((e) => e.replace(/^a/, ""))
    .join("_")
    .toUpperCase();
}

/**
 * 从 storylet ID 中提取章节编号
 * @param storyletId storylet ID，例如 `a01_a002_a003`
 * @returns 章节编号，例如 `1`
 */
export function convertToChapterId(storyletId: string): number {
  return parseInt(storyletId.split("_", 2)[0]!.replaceAll(/\D/g, ""), 10);
}
