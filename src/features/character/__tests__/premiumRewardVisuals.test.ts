import { rewardCatalog } from '@/domain/rewards';

import { collectionBackgroundKeys, premiumRewardSource } from '../premiumRewardVisuals';

describe('premium collection reward visuals', () => {
  it('provides a visible raster source for every reward item', () => {
    for (const reward of rewardCatalog) {
      expect(premiumRewardSource(reward.key)).toBeDefined();
    }
  });

  it('exposes exactly six distinct collection backgrounds', () => {
    expect(collectionBackgroundKeys).toEqual([
      'pastel-playroom',
      'cloud-room',
      'rainbow-room',
      'space-room',
      'undersea-room',
      'rainbow-cape',
    ]);
    expect(new Set(collectionBackgroundKeys.map(premiumRewardSource)).size).toBe(6);
  });
});
