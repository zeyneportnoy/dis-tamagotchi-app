import { brushMotionCharacterKeys, brushPathFor } from '../brushMotion';

describe('character-aware brushing motion', () => {
  it.each(brushMotionCharacterKeys)(
    'keeps every %s path on its visible body at every stage',
    (key) => {
      for (const stage of [0, 1, 2, 3, 4] as const) {
        const points = brushPathFor(key, stage, 0);
        expect(points).toHaveLength(6);
        expect(new Set(points.map(({ x }) => x)).size).toBeGreaterThan(3);
        expect(new Set(points.map(({ y }) => y)).size).toBeGreaterThan(3);
        expect(points.every(({ x, y }) => x >= 62 && x <= 183 && y >= 31 && y <= 151)).toBe(true);
      }
    },
  );

  it('rotates through distinct natural movement patterns', () => {
    expect(brushPathFor('inci', 4, 0)).not.toEqual(brushPathFor('inci', 4, 1));
    expect(brushPathFor('inci', 4, 1)).not.toEqual(brushPathFor('inci', 4, 2));
  });
});
