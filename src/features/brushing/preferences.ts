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

const voiceSyncMetaKey = (parentUserId: string, childProfileId: string): string =>
  `${childVoiceKey(parentUserId, childProfileId)}.sync-meta.v1`;

export type VoiceProfileSyncMeta = Readonly<{ syncedAt: string | null; dirty: boolean }>;

/** Records the value that was just pushed to the cloud, so a later recovery can compare. */
export async function markVoiceProfileSynced(
  parentUserId: string,
  childProfileId: string,
  value: BrushingVoiceProfile,
): Promise<void> {
  await AsyncStorage.setItem(
    voiceSyncMetaKey(parentUserId, childProfileId),
    JSON.stringify({ value, syncedAt: new Date().toISOString() }),
  );
}

/** Whether the local child voice differs from the last pushed value, and when that was. */
export async function readVoiceProfileSyncMeta(
  parentUserId: string,
  childProfileId: string,
): Promise<VoiceProfileSyncMeta> {
  const stored = await AsyncStorage.getItem(voiceSyncMetaKey(parentUserId, childProfileId));
  const current = await AsyncStorage.getItem(childVoiceKey(parentUserId, childProfileId));
  if (!stored) return { syncedAt: null, dirty: true };
  try {
    const parsed = JSON.parse(stored) as { value?: string; syncedAt?: string };
    return {
      syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : null,
      dirty: parsed.value !== current,
    };
  } catch {
    return { syncedAt: null, dirty: true };
  }
}

/**
 * Defaults to off and PERSISTS that default the first time it is read for a
 * child (mirroring getBrushingVoiceProfile's seed-on-first-read behavior) —
 * without this, `hasStoredNicknamePersonalization` (the cloud-recovery /
 * push-safety gate) would never observe a stored key for a child who has
 * never explicitly toggled this preference, permanently blocking that
 * child's ENTIRE preference snapshot (background/room/reminders/voice too)
 * from ever reaching the cloud.
 */
export async function getNicknamePersonalizationEnabled(
  parentUserId: string,
  childProfileId: string,
): Promise<boolean> {
  const key = nicknamePersonalizationKey(parentUserId, childProfileId);
  const stored = await AsyncStorage.getItem(key);
  if (stored === 'true' || stored === 'false') return stored === 'true';
  await AsyncStorage.setItem(key, 'false');
  return false;
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

/** True once a child-specific value has been stored (gates cloud recovery). */
export async function hasStoredNicknamePersonalization(
  parentUserId: string,
  childProfileId: string,
): Promise<boolean> {
  return (await AsyncStorage.getItem(nicknamePersonalizationKey(parentUserId, childProfileId))) !== null;
}

const nicknamePersonalizationSyncMetaKey = (parentUserId: string, childProfileId: string): string =>
  `${nicknamePersonalizationKey(parentUserId, childProfileId)}.sync-meta.v1`;

export type NicknamePersonalizationSyncMeta = Readonly<{ syncedAt: string | null; dirty: boolean }>;

/** Records the value that was just pushed to the cloud, so a later recovery can compare. */
export async function markNicknamePersonalizationSynced(
  parentUserId: string,
  childProfileId: string,
  value: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    nicknamePersonalizationSyncMetaKey(parentUserId, childProfileId),
    JSON.stringify({ value, syncedAt: new Date().toISOString() }),
  );
}

/** Whether the local value differs from the last pushed value, and when that was. */
export async function readNicknamePersonalizationSyncMeta(
  parentUserId: string,
  childProfileId: string,
): Promise<NicknamePersonalizationSyncMeta> {
  const stored = await AsyncStorage.getItem(nicknamePersonalizationSyncMetaKey(parentUserId, childProfileId));
  const current = await getNicknamePersonalizationEnabled(parentUserId, childProfileId);
  if (!stored) return { syncedAt: null, dirty: true };
  try {
    const parsed = JSON.parse(stored) as { value?: boolean; syncedAt?: string };
    return {
      syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : null,
      dirty: parsed.value !== current,
    };
  } catch {
    return { syncedAt: null, dirty: true };
  }
}
