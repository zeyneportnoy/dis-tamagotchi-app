import { growthCompletionMessageKey } from '../growthMessage';

describe('completion growth message', () => {
  it('celebrates only when the session actually crosses a stage threshold', () => {
    expect(growthCompletionMessageKey(50, 60)).toBe('brushing.growthUnlocked');
    expect(growthCompletionMessageKey(110, 120)).toBe('brushing.growthUnlocked');
  });

  it('uses encouragement while staying in the same stage', () => {
    expect(growthCompletionMessageKey(60, 70)).toBe('brushing.growthSteady');
    expect(growthCompletionMessageKey(120, 140)).toBe('brushing.growthSteady');
  });
});
