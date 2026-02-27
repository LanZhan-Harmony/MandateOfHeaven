/**
 * 让当前执行环境暂停指定的时间（毫秒）
 * @param delay 暂停的时间，单位为毫秒 
 * @returns 一个 Promise，在指定时间后 resolve
 */
export function sleep(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}
