const lastDayOfMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

export function addCalendarMonths(isoDate: string, months: number): string {
  const source = new Date(isoDate);
  if (Number.isNaN(source.getTime())) throw new Error('INVALID_REMINDER_DATE');

  const target = new Date(source);
  const sourceDay = source.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  target.setDate(Math.min(sourceDay, lastDayOfMonth(target.getFullYear(), target.getMonth())));
  return target.toISOString();
}
