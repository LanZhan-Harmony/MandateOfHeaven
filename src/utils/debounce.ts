export async function debounce(callback: () => any, delay: number) {
  return new Promise((resolve) => setTimeout(() => resolve(callback()), delay));
}
