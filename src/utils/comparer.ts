/**
 * 深度对象相等性比较
 * @param obj1 第一个对象
 * @param obj2 第二个对象
 * @returns 是否深度相等
 */
export function deepObjectEquals(obj1: any | null | undefined, obj2: any | null | undefined): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== "object" || typeof obj2 !== "object") return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepObjectEquals(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

/**
 * 深度数组相等性比较
 * @param arr1 第一个数组
 * @param arr2 第二个数组
 * @returns 是否深度相等
 */
export function deepArrayEquals(arr1: Array<any> | null | undefined, arr2: Array<any> | null | undefined): boolean {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;

  for (let i = 0; i < arr1.length; i++) {
    if (Array.isArray(arr1[i]) && Array.isArray(arr2[i])) {
      if (!deepArrayEquals(arr1[i], arr2[i])) return false;
    } else {
      return deepObjectEquals(arr1[i], arr2[i]);
    }
  }

  return true;
}
