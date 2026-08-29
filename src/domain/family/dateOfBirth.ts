import type { AgeBand } from './models';

type DateOnlyParts = Readonly<{ day: number; month: number; year: number }>;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value: string): DateOnlyParts | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day, 12);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return { day, month, year };
}

export function dateOnlyFromDate(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateOnlyToDate(value: string): Date | null {
  const parts = parseDateOnly(value);
  return parts ? new Date(parts.year, parts.month - 1, parts.day, 12) : null;
}

export function isFutureDateOnly(value: string, asOf: Date = new Date()): boolean {
  const parts = parseDateOnly(value);
  if (!parts) return false;
  const today = dateOnlyFromDate(asOf);
  return value > today;
}

export function calculateFullAge(dateOfBirth: string, asOf: Date = new Date()): number | null {
  const birth = parseDateOnly(dateOfBirth);
  if (!birth || isFutureDateOnly(dateOfBirth, asOf)) return null;
  let age = asOf.getFullYear() - birth.year;
  const birthdayHasPassed =
    asOf.getMonth() + 1 > birth.month ||
    (asOf.getMonth() + 1 === birth.month && asOf.getDate() >= birth.day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

export function ageBandFromDateOfBirth(
  dateOfBirth: string,
  asOf: Date = new Date(),
): AgeBand | null {
  const age = calculateFullAge(dateOfBirth, asOf);
  if (age === null) return null;
  if (age >= 4 && age <= 6) return '4_6';
  if (age >= 7 && age <= 11) return '7_11';
  return null;
}

export function formatDateOfBirth(dateOfBirth: string): string {
  const value = dateOnlyToDate(dateOfBirth);
  if (!value) return dateOfBirth;
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}
