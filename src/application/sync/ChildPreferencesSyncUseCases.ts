import type {
  CloudChildPreferences,
  CloudChildPreferencesRepository,
  CloudReminderPreference,
  CloudVoiceGuide,
  LocalChildPreferenceSyncRepository,
} from '@/domain/sync';

/**
 * Voice + morning/evening reminder preferences are stored per parent locally,
 * while `child_preferences` is per child — so the parent's current values are
 * mirrored onto every synced child. These accessors keep this use case free of
 * feature-module imports.
 */
export type ParentPreferenceAccessors = Readonly<{
  readVoice(parentUserId: string): Promise<CloudVoiceGuide>;
  hasStoredVoice(parentUserId: string): Promise<boolean>;
  writeVoice(parentUserId: string, voice: CloudVoiceGuide): Promise<void>;
  readReminders(
    parentUserId: string,
  ): Promise<Readonly<{ morning: CloudReminderPreference; evening: CloudReminderPreference }>>;
  hasStoredReminders(parentUserId: string): Promise<boolean>;
  writeReminders(
    parentUserId: string,
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
    private readonly parents: ParentPreferenceAccessors,
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
    const voiceGuide = parentUserId ? await this.parents.readVoice(parentUserId) : null;
    const reminders = parentUserId
      ? await this.parents.readReminders(parentUserId)
      : {
          morning: { enabled: false, time: null },
          evening: { enabled: false, time: null },
        };
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

  async pushForProfile(profileId: string): Promise<void> {
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    await this.cloud.upsert(await this.buildSnapshot(profileId, childId));
  }

  async pushForAllSyncedChildren(): Promise<void> {
    for (const profileId of await this.local.listSyncedProfileIds()) {
      const childId = await this.local.resolveRemoteChildId(profileId);
      if (!childId) continue;
      await this.cloud.upsert(await this.buildSnapshot(profileId, childId));
    }
  }

  /**
   * Fresh-install recovery: hydrate customization for children with no local
   * customization row, and per-parent voice / reminder preferences when nothing
   * is stored locally. Existing local values are never overwritten. The
   * customization is written verbatim — the current-Mine-Puan unlock guards at
   * render time still decide what activates, so a locked cloud selection can
   * never become active.
   */
  async recover(): Promise<void> {
    const rows = await this.cloud.listOwned();
    const seenParents = new Set<string>();
    for (const row of rows) {
      const profileId = await this.local.findProfileByRemoteChildId(row.childId);
      if (!profileId) continue;

      if (!(await this.local.hasLocalCustomization(profileId))) {
        await this.local.hydrateCustomization(profileId, row.roomConfiguration);
      }

      const parentUserId = await this.local.resolveParentUserId(profileId);
      if (!parentUserId || seenParents.has(parentUserId)) continue;
      seenParents.add(parentUserId);

      if (row.voiceGuide && !(await this.parents.hasStoredVoice(parentUserId))) {
        await this.parents.writeVoice(parentUserId, row.voiceGuide);
      }
      if (!(await this.parents.hasStoredReminders(parentUserId))) {
        await this.parents.writeReminders(parentUserId, {
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
