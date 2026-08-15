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

  it('does not repeat the same celebration on consecutive completions', async () => {
    const first = await nextCompletionMessageKey('4_6');
    const second = await nextCompletionMessageKey('4_6');
    expect(first).not.toBe(second);
  });
});
