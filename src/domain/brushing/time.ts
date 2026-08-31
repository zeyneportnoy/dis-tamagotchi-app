import type { BrushingPeriod } from '@/domain/family';

export const BRUSHING_SEGMENT_SECONDS = 30;
export const BRUSHING_SEGMENT_COUNT = 4;
export const BRUSHING_TOTAL_SECONDS = BRUSHING_SEGMENT_SECONDS * BRUSHING_SEGMENT_COUNT;

export type BrushingSlotWindow = Readonly<{
  localDayKey: string;
  period: BrushingPeriod;
  opensAt: Date;
  closesAt: Date;
}>;

export function classifyBrushingSlot(date: Date): BrushingPeriod | null {
  const hour = date.getHours();
  if (hour >= 4 && hour < 12) return 'morning';
  if (hour >= 18) return 'evening';
  return null;
}

export const determineBrushingPeriod = classifyBrushingSlot;

export function toLocalDateKey(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function closedBrushingSlotsSince(profileCreatedAt: Date, now: Date): BrushingSlotWindow[] {
  const slots: BrushingSlotWindow[] = [];
  const cursor = new Date(
    profileCreatedAt.getFullYear(),
    profileCreatedAt.getMonth(),
    profileCreatedAt.getDate(),
  );
  const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  while (cursor <= lastDay) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const day = cursor.getDate();
    const localDayKey = toLocalDateKey(cursor);
    const windows: readonly BrushingSlotWindow[] = [
      {
        localDayKey,
        period: 'morning',
        opensAt: new Date(year, month, day, 4),
        closesAt: new Date(year, month, day, 12),
      },
      {
        localDayKey,
        period: 'evening',
        opensAt: new Date(year, month, day, 18),
        closesAt: new Date(year, month, day + 1),
      },
    ];
    slots.push(...windows.filter(({ closesAt }) => closesAt <= now && closesAt > profileCreatedAt));
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

/** The next instant at which one of the two canonical brushing slots closes. */
export function nextBrushingSlotCloseAfter(now: Date): Date {
  const morningClose = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (now < morningClose) return morningClose;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}
