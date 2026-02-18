/** 以指定概率返回 true */
export function randomChance(probability: number): boolean {
  return Math.random() <= probability;
}

/** 将数值约束在 [min, max] 范围内 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}