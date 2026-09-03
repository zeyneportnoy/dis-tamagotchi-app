import type {
  CloudChildPreferences,
  CloudChildPreferencesRepository,
  CloudReminderPreference,
  CloudVoiceGuide,
  LocalChildPreferenceSyncRepository,
} from '@/domain/sync';

/**
 * Voice + morning/evening reminder preferences are now stored per child. These
 * accessors keep this use case free of feature-module imports; every call is
 * scoped to a specific `(parentUserId, childProfileId)`.
 */
export type PreferenceSyncMeta = Readonly<{ syncedAt: string | null; dirty: boolean }>;

export type ChildPreferenceAccessors = Readonly<{
  readVoice(parentUserId: string, childProfileId: string): Promise<CloudVoiceGuide>;
  hasStoredVoice(parentUserId: string, childProfileId: string): Promise<boolean>;
  writeVoice(parentUserId: string, childProfileId: string, voice: CloudVoiceGuide): Promise<void>;
  markVoiceSynced(
    parentUserId: string,
    childProfileId: string,
    voice: CloudVoiceGuide,
  ): Promise<void>;
  readVoiceSyncMeta(parentUserId: string, childProfileId: string): Promise<PreferenceSyncMeta>;
  readReminders(
    parentUserId: string,
    childProfileId: string,
  ): Promise<Readonly<{ morning: CloudReminderPreference; evening: CloudReminderPreference }>>;
  hasStoredReminders(parentUserId: string, childProfileId: string): Promise<boolean>;
  /** Persists recovered reminder values; the grouped device schedule rebuilds afterward. */
  applyRecoveredReminders(
    parentUserId: string,
    childProfileId: string,
    values: Readonly<{
      morning: Readonly<{ enabled: boolean; time: string }>;
      evening: Readonly<{ enabled: boolean; time: string }>;
    }>,
  ): Promise<void>;
  markRemindersSynced(parentUserId: string, childProfileId: string): Promise<void>;
  readRemindersSyncMeta(parentUserId: string, childProfileId: string): Promise<PreferenceSyncMeta>;
}>;

export class ChildPreferencesSyncUseCases {
  constructor(
    private readonly local: LocalChildPreferenceSyncRepository,
    private readonly cloud: CloudChildPreferencesRepository,
    private readonly prefs: ChildPreferenceAccessors,
  ) {}

  private async buildSnapshot(
    profileId: string,
    childId: string,
  ): Promise<CloudChildPreferences> {
    const [customization, parentUserId, dentistEnabled] = await Promise.all([
      this.local.readCustomizationForPush(profileId),
      this.local.resolveParentUserId(profileId),
      this.local.dentistReminderEnabled(profileId),
    ]);
    const voiceGuide = parentUserId
      ? await this.prefs.readVoice(parentUserId, profileId)
      : null;
    const reminders = parentUserId
      ? await this.prefs.readReminders(parentUserId, profileId)
      : { morning: { enabled: false, time: null }, evening: { enabled: false, time: null } };
    return {
      childId,
      selectedBrushId: customization.selectedBrushId,
      selectedBackgroundId: customization.selectedBackgroundId,
      selectedEffectId: customization.selectedEffectId,
      roomConfiguration: customization.roomConfiguration,
      voiceGuide,
      morningReminder: reminders.morning,
      eveningReminder: reminders.evening,
      dentistReminderEnabled: dentistEnabled,
      dentistLastVisitDate: null,
    };
  }

  private async pushSnapshot(profileId: string, childId: string): Promise<void> {
    const parentUserId = await this.local.resolveParentUserId(profileId);
    const snapshot = await this.buildSnapshot(profileId, childId);
    await this.cloud.upsert(snapshot);
    await this.local.markCustomizationSynced(profileId, snapshot.roomConfiguration);
    if (parentUserId) {
      if (snapshot.voiceGuide) {
        await this.prefs.markVoiceSynced(parentUserId, profileId, snapshot.voiceGuide);
      }
      await this.prefs.markRemindersSynced(parentUserId, profileId);
    }
  }

  async pushForProfile(profileId: string): Promise<void> {
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    await this.pushSnapshot(profileId, childId);
  }

  async pushForAllSyncedChildren(): Promise<void> {
    for (const profileId of await this.local.listSyncedProfileIds()) {
      const childId = await this.local.resolveRemoteChildId(profileId);
      if (!childId) continue;
      await this.pushSnapshot(profileId, childId);
    }
  }

  /**
   * Multi-device recovery. Cloud customization only seeds a profile that has no
   * local customization yet. Once the per-child local record exists it remains
   * authoritative: a row-wide cloud `updated_at` can also change because of
   * voice/reminder writes, so using it to replace the whole room configuration
   * could restore stale or empty placements. Voice / reminder preferences keep
   * their existing recovery rules below. Customization is written verbatim; the
   * current-Mine-Puan unlock guards still decide what activates, so a locked
   * cloud selection can never become active.
   */
  async recover(): Promise<void> {
    for (const row of await this.cloud.listOwned()) {
      const profileId = await this.local.findProfileByRemoteChildId(row.childId);
      if (!profileId) continue;

      if (!(await this.local.hasLocalCustomization(profileId))) {
        await this.local.hydrateCustomization(profileId, row);
      }

      const parentUserId = await this.local.resolveParentUserId(profileId);
      if (!parentUserId) continue;

      if (row.voiceGuide) {
        if (!(await this.prefs.hasStoredVoice(parentUserId, profileId))) {
          await this.prefs.writeVoice(parentUserId, profileId, row.voiceGuide);
          await this.prefs.markVoiceSynced(parentUserId, profileId, row.voiceGuide);
        } else {
          const meta = await this.prefs.readVoiceSyncMeta(parentUserId, profileId);
          if (!meta.dirty && cloudRowNewerThan(row.updatedAt, meta.syncedAt)) {
            await this.prefs.writeVoice(parentUserId, profileId, row.voiceGuide);
            await this.prefs.markVoiceSynced(parentUserId, profileId, row.voiceGuide);
          }
        }
      }

      // Reminder times: the local per-child record is authoritative. The cloud
      // only seeds a child that has NO saved reminder record yet on this device
      // (a genuinely new child). Once a child has any saved record, recovery
      // never touches it again — no stale / default / null / clock-skewed cloud
      // value can revert a user's custom HH:mm hours after they set it.
      if (!(await this.prefs.hasStoredReminders(parentUserId, profileId))) {
        await this.prefs.applyRecoveredReminders(parentUserId, profileId, {
          morning: reminderValues(row.morningReminder, '08:00'),
          evening: reminderValues(row.eveningReminder, '20:30'),
        });
        await this.prefs.markRemindersSynced(parentUserId, profileId);
      }
    }
  }
}

const reminderValues = (
  preference: CloudReminderPreference,
  fallbackTime: string,
): Readonly<{ enabled: boolean; time: string }> => ({
  enabled: preference.enabled,
  time: preference.time ?? fallbackTime,
});

const cloudRowNewerThan = (
  cloudUpdatedAt: string | undefined,
  localSyncedAt: string | null,
): boolean => Boolean(cloudUpdatedAt && localSyncedAt && cloudUpdatedAt > localSyncedAt);
