import {
  sceneBackgroundForCharacter,
  sceneToneForCharacter,
} from '@/features/character/CharacterSceneDecor';

describe('character scene themes', () => {
  const expected = {
    inci: ['blue', '#B9DEFF'],
    piril: ['pink', '#F7C7E0'],
    kaan: ['green', '#BFE8CB'],
    milo: ['purple', '#D8C2F5'],
    zipzip: ['turquoise', '#AEE7E8'],
    topi: ['yellow', '#FFE6A1'],
    akil: ['orange', '#FFD0A3'],
    uyku: ['navy', '#A9B9E8'],
  } as const;

  it.each(Object.entries(expected))('%s uses its fixed full-screen palette', (key, value) => {
    expect(sceneToneForCharacter(key as keyof typeof expected)).toBe(value[0]);
    expect(sceneBackgroundForCharacter(key as keyof typeof expected)).toBe(value[1]);
  });
});
