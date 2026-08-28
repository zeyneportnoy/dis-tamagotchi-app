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
            expect(points).toHaveLength(9);
            expect(new Set(points.map(({ x, y }) => `${x}:${y}`)).size).toBeGreaterThanOrEqual(8);
            expect(points.every(({ x, y }) => x >= 98 && x <= 172 && y >= 85 && y <= 202)).toBe(
              true,
            );
            expect(
              Math.max(...points.map(({ x }) => x)) - Math.min(...points.map(({ x }) => x)),
            ).toBeGreaterThanOrEqual(28);
            expect(
              Math.max(...points.map(({ y }) => y)) - Math.min(...points.map(({ y }) => y)),
            ).toBeGreaterThan(8);
          }
        }
      }
    },
  );

  it.each(brushMotionCharacterKeys)('varies the full-surface sweep for each %s segment', (key) => {
    const paths = [0, 1, 2, 3].map((segmentIndex) => brushPathFor(key, 2, 0, segmentIndex));
    expect(paths[0]).not.toEqual(paths[1]);
    expect(paths[1]).not.toEqual(paths[2]);
    expect(paths[2]).not.toEqual(paths[3]);
  });

  it('rotates through distinct natural movement patterns', () => {
    expect(brushPathFor('inci', 4, 0)).not.toEqual(brushPathFor('inci', 4, 1));
    expect(brushPathFor('inci', 4, 1)).not.toEqual(brushPathFor('inci', 4, 2));
  });

  it('centres the sweep on the measured character artwork without the legacy X bias', () => {
    const renderedCentre = { x: 133, y: 150 };
    const points = brushPathFor('inci', 2, 0, 0, renderedCentre);
    const minX = Math.min(...points.map(({ x }) => x));
    const maxX = Math.max(...points.map(({ x }) => x));
    const minY = Math.min(...points.map(({ y }) => y));
    const maxY = Math.max(...points.map(({ y }) => y));

    expect((minX + maxX) / 2).toBe(renderedCentre.x);
    expect((minY + maxY) / 2).toBeCloseTo(renderedCentre.y, 0);
  });
});
