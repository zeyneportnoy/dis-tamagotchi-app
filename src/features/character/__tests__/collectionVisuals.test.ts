import { starterAvatarKeys } from '@/domain/family';

import { collectionPreviewBottomForStage, collectionVisualPalette } from '../collectionVisuals';

describe('collection preview visuals', () => {
  it('provides a distinct palette for all eight characters', () => {
    expect(Object.keys(collectionVisualPalette)).toEqual(expect.arrayContaining(starterAvatarKeys));
    expect(new Set(starterAvatarKeys.map((key) => collectionVisualPalette[key].hero)).size).toBe(8);
  });

  it('keeps every growth stage inside the shared preview safe range', () => {
    const bottoms = ([0, 1, 2, 3, 4] as const).map(collectionPreviewBottomForStage);
    expect(bottoms).toEqual([22, 22, 26, 28, 30]);
    expect(bottoms.every((bottom) => bottom >= 0 && bottom <= 32)).toBe(true);
  });
});
