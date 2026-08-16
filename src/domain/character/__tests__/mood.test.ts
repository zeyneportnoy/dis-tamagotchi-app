import { deriveHomeCharacterMood } from '../mood';

const progress = {
  eveningCompleted: false,
  lastBrushingAt: null,
  morningCompleted: false,
};

describe('home character mood', () => {
  it('moves from neutral to waiting and sad as a task becomes due', () => {
    expect(deriveHomeCharacterMood(progress, new Date(2026, 7, 16, 7))).toBe('neutral');
    expect(deriveHomeCharacterMood(progress, new Date(2026, 7, 16, 8))).toBe('waiting');
    expect(deriveHomeCharacterMood(progress, new Date(2026, 7, 16, 12))).toBe('sad');
    expect(deriveHomeCharacterMood(progress, new Date(2026, 7, 16, 18))).toBe('waiting');
  });

  it('uses happy, proud and sleepy after successful brushing', () => {
    expect(
      deriveHomeCharacterMood({ ...progress, morningCompleted: true }, new Date(2026, 7, 16, 12)),
    ).toBe('happy');
    expect(
      deriveHomeCharacterMood(
        { ...progress, eveningCompleted: true, morningCompleted: true },
        new Date(2026, 7, 16, 20),
      ),
    ).toBe('proud');
    expect(
      deriveHomeCharacterMood(
        { ...progress, eveningCompleted: true, morningCompleted: true },
        new Date(2026, 7, 16, 23),
      ),
    ).toBe('sleepy');
  });

  it('reserves crying for prolonged absence', () => {
    expect(
      deriveHomeCharacterMood(
        { ...progress, lastBrushingAt: '2026-08-13T08:00:00.000Z' },
        new Date('2026-08-16T12:00:00.000Z'),
      ),
    ).toBe('crying');
  });
});
