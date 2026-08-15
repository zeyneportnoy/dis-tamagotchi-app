export function previousLocalDayKey(localDayKey: string): string {
  const date = new Date(`${localDayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function nextFullDayStreak(previousDayStreak: number | null): number {
  return previousDayStreak === null ? 1 : previousDayStreak + 1;
}
