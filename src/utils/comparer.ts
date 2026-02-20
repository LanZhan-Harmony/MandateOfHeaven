/**
 * 深度数组相等性比较
 * @param arr1 第一个数组
 * @param arr2 第二个数组
 * @returns 是否深度相等
 */
export function deepArrayEquals(arr1: any[] | null | undefined, arr2: any[] | null | undefined): boolean {
  if (arr1 === arr2) return true;
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;

  for (let i = 0; i < arr1.length; i++) {
    if (!isDeepEqual(arr1[i], arr2[i])) return false;
  }

  return true;
}

/**
 * 内部深度对比辅助函数
 */
function isDeepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  // 如果其中一个为 null 或不是对象，则必定不相等（前面已排除 obj1 === obj2）
  if (obj1 === null || obj2 === null || typeof obj1 !== "object" || typeof obj2 !== "object") {
    return false;
  }

  // 1. 处理数组
  const isArr1 = Array.isArray(obj1);
  const isArr2 = Array.isArray(obj2);
  if (isArr1 !== isArr2) return false;

  if (isArr1 && isArr2) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!isDeepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  // 2. 处理日期
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }

  // 3. 处理普通对象
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(obj2, key) || !isDeepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}
