import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '@/i18n';

import {
  completionMessageKeysFourSix,
  completionMessageKeysSevenEleven,
  completionRewardPresentation,
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
    expect(i18n.t('common.rewardCurrencyName')).toBe('Mine Puan');
    expect(i18n.t('childHome.xp', { current: 20, target: 60 })).toBe('20 / 60 Mine Puan');
    expect(i18n.t('brushing.rewardAmount', { amount: 20 })).toBe('+20 Mine Puan');
    expect(i18n.exists('brushing.moodGain')).toBe(false);
    expect(i18n.t('brushing.rewardProgress', { current: 20, target: 60 })).toBe('20 / 60 Mine Puan');
    expect(i18n.t('growth.remainingXp', { count: 30, stage: 'Bebek diş' })).toBe(
      'Bebek diş evresine 30 Mine Puan kaldı',
    );
    expect(i18n.t('growth.currentScore', { count: 40 })).toBe('Mine Puanın: 40');
    expect(i18n.t('collection.unlockAt', { xp: 240 })).toBe("240 Mine Puan'da açılır");
  });

  it('shows the off-slot explanation instead of a reward badge for a 13:00 completion', () => {
    const presentation = completionRewardPresentation(null, 0);
    expect(presentation.kind).toBe('notEarned');
    if (presentation.kind !== 'notEarned') throw new Error('EXPECTED_NO_REWARD_COPY');
    expect(i18n.t(presentation.titleKey)).toBe('Bu fırçalama puan kazandırmadı.');
    expect(i18n.t(presentation.detailKey)).toBe(
      'Mine Puan yalnızca 04:00–11:59 ve 18:00–23:59 arasında kazanılır.',
    );
  });

  it('shows the already-earned explanation for repeated morning and evening slots', () => {
    const morning = completionRewardPresentation('morning', 0);
    const evening = completionRewardPresentation('evening', 0);
    if (morning.kind !== 'notEarned' || evening.kind !== 'notEarned') {
      throw new Error('EXPECTED_NO_REWARD_COPY');
    }
    expect(i18n.t(morning.titleKey)).toBe('Bu zaman dilimindeki Mine Puan ödülünü zaten kazandın.');
    expect(i18n.t(morning.detailKey)).toBe('Bir sonraki puanlı dönem 18:00–23:59.');
    expect(i18n.t(evening.titleKey)).toBe('Bu zaman dilimindeki Mine Puan ödülünü zaten kazandın.');
    expect(i18n.t(evening.detailKey)).toBe(
      'Bugünün sabah ve akşam Mine Puan ödüllerini tamamladın.',
    );
  });

  it('keeps the reward badge presentation for a +20 main-slot completion', () => {
    expect(completionRewardPresentation('morning', 20)).toEqual({ kind: 'earned' });
  });

  it('does not repeat the same celebration on consecutive completions', async () => {
    const first = await nextCompletionMessageKey('4_6');
    const second = await nextCompletionMessageKey('4_6');
    expect(first).not.toBe(second);
  });
});
