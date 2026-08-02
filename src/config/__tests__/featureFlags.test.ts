import { featureFlags } from '../featureFlags';

describe('feature flags', () => {
  it('are disabled by default', () => {
    expect(featureFlags).toEqual({
      analytics: false,
      cloud: false,
      subscriptions: false,
      purchases: false,
    });
  });
});
