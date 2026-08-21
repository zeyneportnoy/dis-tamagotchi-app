import { rewardCatalog } from '@/domain/rewards';

import { premiumRewardSource } from '../premiumRewardVisuals';

describe('premium collection reward visuals', () => {
  it('provides a visible raster source for every reward item', () => {
    for (const reward of rewardCatalog) {
      expect(premiumRewardSource(reward.key)).toBeDefined();
    }
  });
});
