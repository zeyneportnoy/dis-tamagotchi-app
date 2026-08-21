import {
  categoryIconName,
  characterIconSource,
  characterIconThemeSet,
  rewardIconName,
} from '@/features/character/CharacterIconTheme';

describe('character icon themes', () => {
  it('uses the approved character to set mapping', () => {
    expect(characterIconThemeSet).toEqual({
      inci: 'set1',
      piril: 'set1',
      topi: 'set1',
      kaan: 'set1',
      akil: 'set1',
      uyku: 'set1',
      milo: 'set1',
      zipzip: 'set1',
    });
  });

  it('provides themed navigation, category and reward icon sources', () => {
    expect(characterIconSource('inci', 'home')).toBeDefined();
    expect(characterIconSource('kaan', categoryIconName('decor'))).toBeDefined();
    expect(characterIconSource('milo', rewardIconName('night-room', 'background'))).toBeDefined();
  });
});
