export function carouselIndexFromOffset(
  offset: number,
  slideWidth: number,
  itemCount: number,
): number {
  if (slideWidth <= 0 || itemCount <= 0) return 0;
  return Math.max(0, Math.min(itemCount - 1, Math.round(offset / slideWidth)));
}

export function carouselIndexFromWheel(
  currentIndex: number,
  deltaX: number,
  deltaY: number,
  itemCount: number,
  threshold = 8,
): number {
  if (itemCount <= 0) return 0;
  const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  if (Math.abs(delta) < threshold) return Math.max(0, Math.min(itemCount - 1, currentIndex));
  return Math.max(0, Math.min(itemCount - 1, currentIndex + (delta > 0 ? 1 : -1)));
}
