import AsyncStorage from '@react-native-async-storage/async-storage';

import { brushingVoiceProfiles, type BrushingVoiceProfile } from './voiceGuidance';

const legacyVoiceGuidanceKey = 'preferences.brushing.voice-guidance-enabled';
/** Pre-per-child key: still read as a seed value, never deleted. */
const legacyParentVoiceKey = (parentUserId: string): string =>
  `preferences.parent.${parentUserId}.brushing.voice-profile`;
const childVoiceKey = (parentUserId: string, childProfileId: string): string =>
  `preferences.parent.${parentUserId}.child.${childProfileId}.brushing.voice-profile`;
const nicknamePersonalizationKey = (parentUserId: string, childProfileId: string): string =>
  `preferences.parent.${parentUserId}.child.${childProfileId}.brushing.nickname-personalization`;

const isVoiceProfile = (value: string | null): value is BrushingVoiceProfile =>
  value !== null && brushingVoiceProfiles.some((profile) => profile === value);

/**
 * Voice guide is now per child. When no child-specific choice exists yet it is
 * seeded from the legacy parent-level value (or the even older on/off flag) and
 * that becomes the child's source of truth from then on. The legacy parent key
 * is never deleted.
 */
export async function getBrushingVoiceProfile(
  parentUserId: string,
  childProfileId: string,
): Promise<BrushingVoiceProfile> {
  const stored = await AsyncStorage.getItem(childVoiceKey(parentUserId, childProfileId));
  if (isVoiceProfile(stored)) return stored;

  const legacyParent = await AsyncStorage.getItem(legacyParentVoiceKey(parentUserId));
  if (isVoiceProfile(legacyParent)) {
    await AsyncStorage.setItem(childVoiceKey(parentUserId, childProfileId), legacyParent);
    return legacyParent;
  }

  const legacyEnabled = await AsyncStorage.getItem(legacyVoiceGuidanceKey);
  const migrated: BrushingVoiceProfile = legacyEnabled === 'false' ? 'off' : 'gokce';
  await AsyncStorage.setItem(childVoiceKey(parentUserId, childProfileId), migrated);
  return migrated;
}

export async function setBrushingVoiceProfile(
  parentUserId: string,
  childProfileId: string,
  profile: BrushingVoiceProfile,
): Promise<void> {
  await AsyncStorage.setItem(childVoiceKey(parentUserId, childProfileId), profile);
}

/** True once a child-specific voice profile has been stored (gates cloud recovery). */
export async function hasStoredVoiceProfile(
  parentUserId: string,
  childProfileId: string,
): Promise<boolean> {
  return (await AsyncStorage.getItem(childVoiceKey(parentUserId, childProfileId))) !== null;
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
