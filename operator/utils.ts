export function getRandomNumberInRange(min: number, max: number): number {
  return +(Math.random() * (max - min) + min).toFixed(3);
}
