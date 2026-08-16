import { characterSafeViewport } from '../CharacterAvatar';

describe('character motion-safe viewport', () => {
  it('reserves motion and accessory clearance without shrinking the rendered character', () => {
    expect(characterSafeViewport.large).toEqual({ height: 282, width: 250 });
    expect(characterSafeViewport.hero).toEqual({ height: 354, width: 320 });
    expect(characterSafeViewport.large.height - 224).toBeGreaterThanOrEqual(58);
    expect(characterSafeViewport.hero.height - 294).toBeGreaterThanOrEqual(60);
    expect(characterSafeViewport.large.width - 186).toBeGreaterThanOrEqual(64);
    expect(characterSafeViewport.hero.width - 244).toBeGreaterThanOrEqual(76);
  });
});
