import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getBrushingVoiceProfile,
  getNicknamePersonalizationEnabled,
  hasStoredVoiceProfile,
  setBrushingVoiceProfile,
  setNicknamePersonalizationEnabled,
} from '../preferences';

describe('per-child brushing voice profile', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to Gökçe per child and persists across reads', async () => {
    await expect(getBrushingVoiceProfile('parent-a', 'child-a')).resolves.toBe('gokce');
    await setBrushingVoiceProfile('parent-a', 'child-a', 'samet');
    await expect(getBrushingVoiceProfile('parent-a', 'child-a')).resolves.toBe('samet');
  });

  it('keeps each child choice isolated within and across parents', async () => {
    await setBrushingVoiceProfile('parent-a', 'child-a', 'off');
    await setBrushingVoiceProfile('parent-a', 'child-b', 'samet');
    await setBrushingVoiceProfile('parent-b', 'child-a', 'gokce');
    await expect(getBrushingVoiceProfile('parent-a', 'child-a')).resolves.toBe('off');
    await expect(getBrushingVoiceProfile('parent-a', 'child-b')).resolves.toBe('samet');
    await expect(getBrushingVoiceProfile('parent-b', 'child-a')).resolves.toBe('gokce');
  });

  it('seeds a new child from the legacy parent-level value without deleting it', async () => {
    await AsyncStorage.setItem('preferences.parent.parent-a.brushing.voice-profile', 'samet');
    await expect(hasStoredVoiceProfile('parent-a', 'child-a')).resolves.toBe(false);
    await expect(getBrushingVoiceProfile('parent-a', 'child-a')).resolves.toBe('samet');
    await expect(hasStoredVoiceProfile('parent-a', 'child-a')).resolves.toBe(true);
    // Legacy parent key untouched.
    await expect(
      AsyncStorage.getItem('preferences.parent.parent-a.brushing.voice-profile'),
    ).resolves.toBe('samet');
    // A different child of the same parent still seeds from the same legacy value.
    await expect(getBrushingVoiceProfile('parent-a', 'child-b')).resolves.toBe('samet');
    // Once a child value exists it is the source of truth, not the legacy value.
    await setBrushingVoiceProfile('parent-a', 'child-a', 'off');
    await expect(getBrushingVoiceProfile('parent-a', 'child-a')).resolves.toBe('off');
  });

  it('migrates the legacy disabled choice without enabling audio', async () => {
    await AsyncStorage.setItem('preferences.brushing.voice-guidance-enabled', 'false');
    await expect(getBrushingVoiceProfile('parent-a', 'child-a')).resolves.toBe('off');
  });

  it('defaults nickname personalization off and isolates it by parent and child', async () => {
    await expect(getNicknamePersonalizationEnabled('parent-a', 'child-a')).resolves.toBe(false);
    await setNicknamePersonalizationEnabled('parent-a', 'child-a', true);
    await expect(getNicknamePersonalizationEnabled('parent-a', 'child-a')).resolves.toBe(true);
    await expect(getNicknamePersonalizationEnabled('parent-a', 'child-b')).resolves.toBe(false);
    await expect(getNicknamePersonalizationEnabled('parent-b', 'child-a')).resolves.toBe(false);
  });
});
