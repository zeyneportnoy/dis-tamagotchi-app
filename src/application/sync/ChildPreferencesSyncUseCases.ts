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
  /**
   * Cloud-recovery entry point for a child with no local dentist_reminders row
   * yet (see `LocalChildPreferenceSyncRepository.dentistReminderEnabled`).
   * Persists the recovered dates and (re)schedules the routine / appointment
   * notifications using the exact same derivation as a live parent edit.
   */
  applyRecoveredDentist(
    childProfileId: string,
    nickname: string,
    values: Readonly<{ lastVisitDate: string | null; nextAppointmentDate: string | null }>,
  ): Promise<void>;
  readNicknamePersonalization(parentUserId: string, childProfileId: string): Promise<boolean>;
  hasStoredNicknamePersonalization(parentUserId: string, childProfileId: string): Promise<boolean>;
  writeNicknamePersonalization(
    parentUserId: string,
    childProfileId: string,
    enabled: boolean,
  ): Promise<void>;
  markNicknamePersonalizationSynced(
    parentUserId: string,
    childProfileId: string,
    enabled: boolean,
  ): Promise<void>;
  readNicknamePersonalizationSyncMeta(
    parentUserId: string,
    childProfileId: string,
  ): Promise<PreferenceSyncMeta>;
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
    const [customization, parentUserId, dentistEnabled, dentistDates] = await Promise.all([
      this.local.readCustomizationForPush(profileId),
      this.local.resolveParentUserId(profileId),
      this.local.dentistReminderEnabled(profileId),
      this.local.readDentistDatesForPush(profileId),
    ]);
    const voiceGuide = parentUserId
      ? await this.prefs.readVoice(parentUserId, profileId)
      : null;
    const reminders = parentUserId
      ? await this.prefs.readReminders(parentUserId, profileId)
      : { morning: { enabled: false, time: null }, evening: { enabled: false, time: null } };
    const nicknamePersonalizationEnabled = parentUserId
      ? await this.prefs.readNicknamePersonalization(parentUserId, profileId)
      : null;
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
      dentistLastVisitDate: dentistDates.lastVisitDate,
      dentistNextAppointmentDate: dentistDates.nextAppointmentDate,
      nicknamePersonalizationEnabled,
    };
  }

  /**
   * A child whose customization/reminders/voice have never been resolved
   * locally (neither hydrated from the cloud nor genuinely edited by a user
   * on this device) has no trustworthy snapshot yet: `buildSnapshot` would
   * fabricate empty/default values for the unresolved parts. Pushing that
   * default is safe ONLY when the cloud has no existing row to protect (a
   * genuinely brand-new child, e.g. mid-onboarding) — never when an existing
   * cloud row could be destructively overwritten by it. This is the guard
   * that stops a bootstrap/foreground sync pass from bulk-defaulting many
   * siblings' background/room/reminders before recovery has caught up.
   *
   * Nickname personalization is deliberately NOT part of this gate. Unlike
   * customization/reminders/voice/dentist — where an "unresolved" local read
   * is a fabricated placeholder (empty state / 08:00 default / etc.) that
   * must never overwrite a real cloud value — its unset local read (false)
   * already IS its real, correct value (there is currently no UI that ever
   * sets it to true), and it has no equivalent to dentist's "always created
   * at child-creation time" guarantee. Gating on it would risk permanently
   * blocking a child's ENTIRE snapshot (background/room/reminders/voice/
   * dentist too) the moment its cloud row already exists, since nothing in
   * the app currently causes it to become "stored" on its own. `recover()`
   * below still protects a genuinely resolved local value from ever being
   * overwritten by the cloud.
   */
  private async isSafeToPush(profileId: string, childId: string, parentUserId: string | null): Promise<boolean> {
    const [hasCustomization, hasReminders, hasVoice, hasDentist] = await Promise.all([
      this.local.hasLocalCustomization(profileId),
      parentUserId ? this.prefs.hasStoredReminders(parentUserId, profileId) : Promise.resolve(true),
      parentUserId ? this.prefs.hasStoredVoice(parentUserId, profileId) : Promise.resolve(true),
      this.local.dentistReminderEnabled(profileId),
    ]);
    if (hasCustomization && hasReminders && hasVoice && hasDentist) return true;
    const existing = await this.cloud.get(childId);
    return existing === null;
  }

  private async pushSnapshot(profileId: string, childId: string): Promise<void> {
    const parentUserId = await this.local.resolveParentUserId(profileId);
    if (!(await this.isSafeToPush(profileId, childId, parentUserId))) return;
    const snapshot = await this.buildSnapshot(profileId, childId);
    await this.cloud.upsert(snapshot);
    await this.local.markCustomizationSynced(profileId, snapshot.roomConfiguration);
    if (parentUserId) {
      if (snapshot.voiceGuide) {
        await this.prefs.markVoiceSynced(parentUserId, profileId, snapshot.voiceGuide);
      }
      await this.prefs.markRemindersSynced(parentUserId, profileId);
      if (snapshot.nicknamePersonalizationEnabled !== null) {
        await this.prefs.markNicknamePersonalizationSynced(
          parentUserId,
          profileId,
          snapshot.nicknamePersonalizationEnabled,
        );
      }
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

      // Dentist last-visit / next-appointment dates live purely on the child row
      // (no per-parent AsyncStorage scoping), so this does not need parentUserId
      // and must not be skipped by the `continue` below. Only seeds a child with
      // NO local dentist_reminders row yet (a second device, or a reinstall —
      // the creating device already has one from profile creation). Persisting
      // and (re)scheduling both go through the exact same DentistVisitService
      // path a live parent edit uses, so the routine (+6 months) and
      // appointment (-1 day) reminders come back correctly without
      // re-deriving any of that logic here.
      if (!(await this.local.dentistReminderEnabled(profileId))) {
        const nickname = await this.local.resolveNickname(profileId);
        await this.prefs.applyRecoveredDentist(profileId, nickname, {
          lastVisitDate: row.dentistLastVisitDate,
          nextAppointmentDate: row.dentistNextAppointmentDate,
        });
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

      // Nickname personalization (brushing says the child's name): same
      // seed-once-then-authoritative rule as voice, since it is exactly the
      // same shape of preference (a per-child AsyncStorage value with a
      // fingerprint sync marker).
      if (row.nicknamePersonalizationEnabled !== null) {
        if (!(await this.prefs.hasStoredNicknamePersonalization(parentUserId, profileId))) {
          await this.prefs.writeNicknamePersonalization(
            parentUserId,
            profileId,
            row.nicknamePersonalizationEnabled,
          );
          await this.prefs.markNicknamePersonalizationSynced(
            parentUserId,
            profileId,
            row.nicknamePersonalizationEnabled,
          );
        } else {
          const meta = await this.prefs.readNicknamePersonalizationSyncMeta(parentUserId, profileId);
          if (!meta.dirty && cloudRowNewerThan(row.updatedAt, meta.syncedAt)) {
            await this.prefs.writeNicknamePersonalization(
              parentUserId,
              profileId,
              row.nicknamePersonalizationEnabled,
            );
            await this.prefs.markNicknamePersonalizationSynced(
              parentUserId,
              profileId,
              row.nicknamePersonalizationEnabled,
            );
          }
        }
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
