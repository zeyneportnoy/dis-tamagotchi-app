import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '@/i18n';

import {
  brushingVoicePromptKeysFourSix,
  brushingVoicePromptKeysSevenEleven,
  isBrushingVoiceGuidanceEnabled,
  setBrushingVoiceGuidanceEnabled,
} from '../preferences';

describe('brushing voice guidance preferences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is enabled by default and persists an explicit choice', async () => {
    await expect(isBrushingVoiceGuidanceEnabled()).resolves.toBe(true);
    await setBrushingVoiceGuidanceEnabled(false);
    await expect(isBrushingVoiceGuidanceEnabled()).resolves.toBe(false);
  });

  it('keeps one Turkish prompt for each brushing quadrant in order', () => {
    expect(brushingVoicePromptKeysFourSix.map((key) => i18n.t(key))).toEqual([
      'Şimdi sağ üst bölgeyi fırçalayalım.',
      'Harika! Şimdi sol üst bölgeye geçelim.',
      'Süper gidiyorsun! Şimdi sağ alt bölgeyi fırçalayalım.',
      'Son bölüm! Şimdi sol alt bölgeyi fırçalayalım.',
    ]);
    expect(brushingVoicePromptKeysSevenEleven.map((key) => i18n.t(key))).toEqual([
      'Şimdi sağ üst bölgeyi fırçalayalım.',
      'Harika! Şimdi sol üst bölgeye geçelim.',
      'Süper gidiyorsun! Şimdi sağ alt bölgeyi fırçalayalım.',
      'Son bölüm! Şimdi sol alt bölgeyi fırçalayalım.',
    ]);
  });
});
