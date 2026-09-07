export function previousLocalDayKey(localDayKey: string): string {
  const date = new Date(`${localDayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function nextFullDayStreak(previousDayStreak: number | null): number {
  return previousDayStreak === null ? 1 : previousDayStreak + 1;
}

/**
 * Deterministic daily streak: the number of distinct, consecutive local
 * calendar days — ending on `todayKey` or the day before it — on which the
 * child completed a full day (both slots).
 *
 * Derived purely from the SET of full-day date keys, never from a running
 * counter or a session count, so it is identical on every device regardless of
 * how that device assembled its local history (brushed here, or hydrated from
 * the cloud). All keys are `toLocalDateKey` strings, so the comparison is a
 * plain calendar-day comparison with no timezone drift.
 *
 * A run whose most recent full day is older than yesterday has lapsed and
 * reads as 0. A run that reaches today or yesterday counts every consecutive
 * day back from its most recent day.
 */
export function deriveStreak(fullDayKeys: Iterable<string>, todayKey: string): number {
  const days = [...new Set(fullDayKeys)].sort();
  const yesterdayKey = previousLocalDayKey(todayKey);
  let streak = 0;
  let expectedKey: string | null = null;
  // Walk newest → oldest. The run is only alive if its newest full day is
  // today or later, or exactly yesterday; from there it counts every day that
  // is exactly the calendar day before the last one counted.
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const dayKey = days[index];
    if (dayKey === undefined) break;
    if (expectedKey === null) {
      if (dayKey < yesterdayKey) return 0;
    } else if (dayKey !== expectedKey) {
      break;
    }
    streak += 1;
    expectedKey = previousLocalDayKey(dayKey);
  }
  return streak;
}
