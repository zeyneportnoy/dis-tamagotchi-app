import AsyncStorage from '@react-native-async-storage/async-storage';

import { brushingVoiceProfiles, type BrushingVoiceProfile } from './voiceGuidance';

const legacyVoiceGuidanceKey = 'preferences.brushing.voice-guidance-enabled';
const voiceProfileKey = (parentUserId: string): string =>
  `preferences.parent.${parentUserId}.brushing.voice-profile`;
const nicknamePersonalizationKey = (parentUserId: string, childProfileId: string): string =>
  `preferences.parent.${parentUserId}.child.${childProfileId}.brushing.nickname-personalization`;

const isVoiceProfile = (value: string | null): value is BrushingVoiceProfile =>
  value !== null && brushingVoiceProfiles.some((profile) => profile === value);

export async function getBrushingVoiceProfile(parentUserId: string): Promise<BrushingVoiceProfile> {
  const stored = await AsyncStorage.getItem(voiceProfileKey(parentUserId));
  if (isVoiceProfile(stored)) return stored;

  const legacyEnabled = await AsyncStorage.getItem(legacyVoiceGuidanceKey);
  const migrated: BrushingVoiceProfile = legacyEnabled === 'false' ? 'off' : 'gokce';
  await AsyncStorage.setItem(voiceProfileKey(parentUserId), migrated);
  return migrated;
}

export async function setBrushingVoiceProfile(
  parentUserId: string,
  profile: BrushingVoiceProfile,
): Promise<void> {
  await AsyncStorage.setItem(voiceProfileKey(parentUserId), profile);
}

/** True once a voice profile has been explicitly stored (used to gate cloud recovery). */
export async function hasStoredVoiceProfile(parentUserId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(voiceProfileKey(parentUserId))) !== null;
}

export async function getNicknamePersonalizationEnabled(
  parentUserId: string,
  childProfileId: string,
): Promise<boolean> {
  return (
    (await AsyncStorage.getItem(nicknamePersonalizationKey(parentUserId, childProfileId))) ===
    'true'
  );
}

export async function setNicknamePersonalizationEnabled(
  parentUserId: string,
  childProfileId: string,
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    nicknamePersonalizationKey(parentUserId, childProfileId),
    enabled ? 'true' : 'false',
  );
}
