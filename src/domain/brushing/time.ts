import type { BrushingPeriod } from '@/domain/family';

export const BRUSHING_SEGMENT_SECONDS = 30;
export const BRUSHING_SEGMENT_COUNT = 4;
export const BRUSHING_TOTAL_SECONDS = BRUSHING_SEGMENT_SECONDS * BRUSHING_SEGMENT_COUNT;

export function determineBrushingPeriod(date: Date): BrushingPeriod {
  const hour = date.getHours();
  return hour >= 4 && hour < 16 ? 'morning' : 'evening';
}

export function toLocalDateKey(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
