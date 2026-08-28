import { addCalendarMonths } from '../dentistReminder';

describe('dentist reminder calendar cycle', () => {
  it('creates six-month dates without changing the local clock time', () => {
    expect(addCalendarMonths('2026-08-28T09:30:00.000Z', 6)).toBe('2027-02-28T09:30:00.000Z');
    expect(addCalendarMonths('2026-08-28T09:30:00.000Z', 12)).toBe('2027-08-28T09:30:00.000Z');
  });

  it('clamps end-of-month profiles to the final valid day', () => {
    expect(addCalendarMonths('2026-08-31T12:00:00.000Z', 6)).toBe('2027-02-28T12:00:00.000Z');
  });
});
