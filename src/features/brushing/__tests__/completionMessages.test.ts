import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '@/i18n';

import {
  completionMessageKeysFourSix,
  completionMessageKeysSevenEleven,
  nextCompletionMessageKey,
} from '../completionMessages';

describe('brushing completion messages', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => jest.restoreAllMocks());

  it('provides localized age-adapted celebration pools', () => {
    expect(completionMessageKeysFourSix.every((key) => i18n.exists(key))).toBe(true);
    expect(completionMessageKeysSevenEleven.every((key) => i18n.exists(key))).toBe(true);
  });

  it('uses the centralized user-facing reward currency name', () => {
    expect(i18n.t('common.rewardCurrencyName')).toBe('Mine');
    expect(i18n.t('childHome.xp', { current: 20, target: 60 })).toBe('20 / 60 Mine');
    expect(i18n.t('brushing.rewardAmount', { amount: 20 })).toBe('+20 Mine');
    expect(i18n.t('brushing.rewardProgress', { current: 20, target: 60 })).toBe('20 / 60 Mine');
    expect(i18n.t('growth.remainingXp', { count: 30, stage: 'Bebek diş' })).toBe(
      'Bebek diş evresine 30 Mine kaldı',
    );
    expect(i18n.t('collection.unlockAt', { xp: 400 })).toBe('400 Mine’de açılır');
  });

  it('does not repeat the same celebration on consecutive completions', async () => {
    const first = await nextCompletionMessageKey('4_6');
    const second = await nextCompletionMessageKey('4_6');
    expect(first).not.toBe(second);
  });
});
