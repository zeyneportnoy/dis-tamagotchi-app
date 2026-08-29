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
export type ChildPreferenceAccessors = Readonly<{
  readVoice(parentUserId: string, childProfileId: string): Promise<CloudVoiceGuide>;
  hasStoredVoice(parentUserId: string, childProfileId: string): Promise<boolean>;
  writeVoice(parentUserId: string, childProfileId: string, voice: CloudVoiceGuide): Promise<void>;
  readReminders(
    parentUserId: string,
    childProfileId: string,
  ): Promise<Readonly<{ morning: CloudReminderPreference; evening: CloudReminderPreference }>>;
  hasStoredReminders(parentUserId: string, childProfileId: string): Promise<boolean>;
  /** Persists recovered reminder values AND reschedules any enabled slot on device. */
  applyRecoveredReminders(
    parentUserId: string,
    childProfileId: string,
    values: Readonly<{
      morning: Readonly<{ enabled: boolean; time: string }>;
      evening: Readonly<{ enabled: boolean; time: string }>;
    }>,
  ): Promise<void>;
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
    const snapshot = await this.buildSnapshot(profileId, childId);
    await this.cloud.upsert(snapshot);
    await this.local.markCustomizationSynced(profileId, snapshot.roomConfiguration);
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
   * Multi-device recovery. Customization is hydrated when local is missing, or
   * when local is clean (unchanged since the last push) and the cloud row is
   * newer than that push — local unpushed edits are never overwritten. Voice /
   * reminder preferences hydrate only when nothing is stored locally yet;
   * enabled reminders are rescheduled on device. Customization is written
   * verbatim; the current-Mine-Puan unlock guards still decide what activates,
   * so a locked cloud selection can never become active.
   */
  async recover(): Promise<void> {
    for (const row of await this.cloud.listOwned()) {
      const profileId = await this.local.findProfileByRemoteChildId(row.childId);
      if (!profileId) continue;

      if (!(await this.local.hasLocalCustomization(profileId))) {
        await this.local.hydrateCustomization(profileId, row);
      } else {
        const meta = await this.local.readCustomizationSyncMeta(profileId);
        const cloudNewer = Boolean(row.updatedAt && meta.syncedAt && row.updatedAt > meta.syncedAt);
        if (!meta.dirty && cloudNewer) {
          await this.local.hydrateCustomization(profileId, row);
        }
      }

      const parentUserId = await this.local.resolveParentUserId(profileId);
      if (!parentUserId) continue;

      if (row.voiceGuide && !(await this.prefs.hasStoredVoice(parentUserId, profileId))) {
        await this.prefs.writeVoice(parentUserId, profileId, row.voiceGuide);
      }
      if (!(await this.prefs.hasStoredReminders(parentUserId, profileId))) {
        await this.prefs.applyRecoveredReminders(parentUserId, profileId, {
          morning: reminderValues(row.morningReminder, '08:00'),
          evening: reminderValues(row.eveningReminder, '20:30'),
        });
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
