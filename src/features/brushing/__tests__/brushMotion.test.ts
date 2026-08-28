import { brushContactAnchorsFor, brushMotionCharacterKeys, brushPathFor } from '../brushMotion';

describe('character-aware brushing motion', () => {
  it.each(brushMotionCharacterKeys)(
    'keeps every %s path on its visible body at every stage',
    (key) => {
      for (const stage of [0, 1, 2, 3, 4] as const) {
        const anchors = brushContactAnchorsFor(key, stage);
        expect(anchors).toHaveLength(6);
        expect(anchors[0]!.x).toBeLessThan(anchors[1]!.x);
        expect(anchors[2]!.x).toBeLessThan(anchors[3]!.x);
        expect(anchors[4]!.x).toBeLessThan(anchors[5]!.x);
        expect(Math.max(anchors[0]!.y, anchors[1]!.y)).toBeLessThan(
          Math.min(anchors[2]!.y, anchors[3]!.y),
        );
        expect(Math.max(anchors[2]!.y, anchors[3]!.y)).toBeLessThan(
          Math.min(anchors[4]!.y, anchors[5]!.y),
        );
        for (const segmentIndex of [0, 1, 2, 3]) {
          for (const variant of [0, 1, 2]) {
            const points = brushPathFor(key, stage, variant, segmentIndex);
            expect(points).toHaveLength(6);
            expect(new Set(points.map(({ x, y }) => `${x}:${y}`)).size).toBeGreaterThanOrEqual(4);
            expect(points.every(({ x, y }) => x >= 98 && x <= 172 && y >= 111 && y <= 202)).toBe(
              true,
            );
          }
        }
      }
    },
  );

  it.each(brushMotionCharacterKeys)('tracks each %s quadrant independently', (key) => {
    const average = (values: readonly number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    const paths = [0, 1, 2, 3].map((segmentIndex) => brushPathFor(key, 2, 0, segmentIndex));
    expect(average(paths[0]!.map(({ x }) => x))).toBeGreaterThan(
      average(paths[1]!.map(({ x }) => x)),
    );
    expect(average(paths[2]!.map(({ x }) => x))).toBeGreaterThan(
      average(paths[3]!.map(({ x }) => x)),
    );
    expect(average(paths[0]!.map(({ y }) => y))).toBeLessThan(average(paths[2]!.map(({ y }) => y)));
    expect(average(paths[1]!.map(({ y }) => y))).toBeLessThan(average(paths[3]!.map(({ y }) => y)));
  });

  it('rotates through distinct natural movement patterns', () => {
    expect(brushPathFor('inci', 4, 0)).not.toEqual(brushPathFor('inci', 4, 1));
    expect(brushPathFor('inci', 4, 1)).not.toEqual(brushPathFor('inci', 4, 2));
  });
});
