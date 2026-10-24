// Pure navigation shared by keyboard, wheel, touch gestures, and the Up Next rail.
// The 0-length guard makes filtering to no lessons safe.
export function wrapFeedIndex(index: number, count: number): number {
  if (!Number.isInteger(index) || !Number.isInteger(count) || count <= 0) return 0;
  return ((index % count) + count) % count;
}
export function moveFeedIndex(index: number, direction: number, count: number): number {
  if (!Number.isInteger(count) || count <= 0) return 0;
  return wrapFeedIndex(wrapFeedIndex(index, count) + Math.trunc(direction), count);
}
