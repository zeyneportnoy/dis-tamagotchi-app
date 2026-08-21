import { starterAvatarKeys } from '@/domain/family';

import { accessoryAnchorFor } from '../CharacterAvatar';

const stages = ['egg', 'cracking', 'baby', 'growing', 'developed'] as const;

describe('character accessory anchors', () => {
  it('keeps head and face accessories in safe stage-specific bands for every character', () => {
    for (const character of starterAvatarKeys) {
      for (const stage of stages) {
        const head = accessoryAnchorFor(character, stage, 'head', 'hero');
        const face = accessoryAnchorFor(character, stage, 'face', 'hero');
        const headTop = Number.parseInt(head.top, 10);
        const faceTop = Number.parseInt(face.top, 10);

        expect(headTop).toBeGreaterThanOrEqual(-6);
        expect(headTop).toBeLessThanOrEqual(4);
        expect(faceTop).toBeGreaterThanOrEqual(28);
        expect(faceTop).toBeLessThanOrEqual(34);
        expect(Math.abs(head.translateX)).toBeLessThanOrEqual(8);
        expect(Math.abs(face.translateX)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('scales accessories with the rendered character instead of using one global size', () => {
    const tiny = accessoryAnchorFor('inci', 'growing', 'head', 'tiny');
    const large = accessoryAnchorFor('inci', 'growing', 'head', 'large');
    const hero = accessoryAnchorFor('inci', 'growing', 'head', 'hero');

    expect(tiny.scale).toBeLessThan(large.scale);
    expect(large.scale).toBeLessThan(hero.scale);
  });

  it('keeps Pırıl head wearables clear of her built-in bow', () => {
    expect(accessoryAnchorFor('piril', 'developed', 'head', 'hero')).toMatchObject({
      top: '3%',
      translateX: -8,
    });
  });
});
