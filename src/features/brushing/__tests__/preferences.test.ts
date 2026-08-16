import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getBrushingVoiceProfile,
  getNicknamePersonalizationEnabled,
  setBrushingVoiceProfile,
  setNicknamePersonalizationEnabled,
} from '../preferences';

describe('parent-scoped brushing voice profile', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to Gökçe and persists across reads', async () => {
    await expect(getBrushingVoiceProfile('parent-a')).resolves.toBe('gokce');
    await setBrushingVoiceProfile('parent-a', 'samet');
    await expect(getBrushingVoiceProfile('parent-a')).resolves.toBe('samet');
  });

  it('keeps each parent choice isolated and persists the off choice', async () => {
    await setBrushingVoiceProfile('parent-a', 'off');
    await setBrushingVoiceProfile('parent-b', 'samet');
    await expect(getBrushingVoiceProfile('parent-a')).resolves.toBe('off');
    await expect(getBrushingVoiceProfile('parent-b')).resolves.toBe('samet');
  });

  it('migrates the legacy disabled choice without enabling audio', async () => {
    await AsyncStorage.setItem('preferences.brushing.voice-guidance-enabled', 'false');
    await expect(getBrushingVoiceProfile('parent-a')).resolves.toBe('off');
  });

  it('defaults nickname personalization off and isolates it by parent and child', async () => {
    await expect(getNicknamePersonalizationEnabled('parent-a', 'child-a')).resolves.toBe(false);
    await setNicknamePersonalizationEnabled('parent-a', 'child-a', true);
    await expect(getNicknamePersonalizationEnabled('parent-a', 'child-a')).resolves.toBe(true);
    await expect(getNicknamePersonalizationEnabled('parent-a', 'child-b')).resolves.toBe(false);
    await expect(getNicknamePersonalizationEnabled('parent-b', 'child-a')).resolves.toBe(false);
  });
});
