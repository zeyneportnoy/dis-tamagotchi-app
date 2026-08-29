import { growthCompletionMessageKey } from '../growthMessage';

describe('completion growth message', () => {
  it('celebrates only when the session actually crosses a stage threshold', () => {
    expect(growthCompletionMessageKey(150, 160)).toBe('brushing.growthUnlocked');
    expect(growthCompletionMessageKey(390, 400)).toBe('brushing.growthUnlocked');
  });

  it('uses encouragement while staying in the same stage', () => {
    expect(growthCompletionMessageKey(160, 170)).toBe('brushing.growthSteady');
    expect(growthCompletionMessageKey(400, 420)).toBe('brushing.growthSteady');
  });
});
