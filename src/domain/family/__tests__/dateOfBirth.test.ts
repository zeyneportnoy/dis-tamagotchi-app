import {
  ageBandFromDateOfBirth,
  calculateFullAge,
  dateOnlyFromDate,
  dateOnlyToDate,
  parseDateOnly,
} from '../dateOfBirth';

describe('child date of birth rules', () => {
  it('uses month and day when calculating the full age', () => {
    const dayBeforeBirthday = new Date(2026, 7, 28, 12);
    const birthday = new Date(2026, 7, 29, 12);

    expect(calculateFullAge('2019-08-29', dayBeforeBirthday)).toBe(6);
    expect(calculateFullAge('2019-08-29', birthday)).toBe(7);
    expect(ageBandFromDateOfBirth('2019-08-29', dayBeforeBirthday)).toBe('4_6');
    expect(ageBandFromDateOfBirth('2019-08-29', birthday)).toBe('7_11');
  });

  it('validates real calendar dates and round-trips a date-only value', () => {
    expect(parseDateOnly('2020-02-29')).toEqual({ day: 29, month: 2, year: 2020 });
    expect(parseDateOnly('2021-02-29')).toBeNull();
    expect(parseDateOnly('2020-2-9')).toBeNull();

    const date = dateOnlyToDate('2020-02-29');
    expect(date).not.toBeNull();
    expect(dateOnlyFromDate(date!)).toBe('2020-02-29');
  });

  it('rejects future and unsupported ages', () => {
    const today = new Date(2026, 7, 29, 12);
    expect(calculateFullAge('2026-08-30', today)).toBeNull();
    expect(ageBandFromDateOfBirth('2023-08-29', today)).toBeNull();
    expect(ageBandFromDateOfBirth('2014-08-29', today)).toBeNull();
  });
});
