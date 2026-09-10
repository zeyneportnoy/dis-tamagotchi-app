import type {
  ChildReminderPatch,
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

  /** In-flight `recover()` pass, so concurrent callers share one run (see `recover`). */
  private recoverInFlight: Promise<void> | null = null;

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
    // Only send the customization columns when THIS device holds an unpushed
    // customization change. A stale foreground push would otherwise rewrite the
    // cloud's `selected_*` / `room_configuration` with our older local state and
    // clobber a selection another device just made.
    const customizationDirty = (await this.local.readCustomizationSyncMeta(profileId)).dirty;
    await this.cloud.upsert(snapshot, { includeCustomization: customizationDirty });
    if (customizationDirty) {
      await this.local.markCustomizationSynced(profileId, snapshot.roomConfiguration);
    }
    if (parentUserId) {
      if (snapshot.voiceGuide) {
        await this.prefs.markVoiceSynced(parentUserId, profileId, snapshot.voiceGuide);
      }
      // NOTE: no markRemindersSynced here. This whole-row upsert deliberately
      // excludes the four reminder columns (they go through patch_child_preferences
      // only), so stamping "reminders synced now" on every foreground would be a
      // lie — and it used to defeat recover()'s cloud-vs-local staleness check,
      // pinning a second device to its stale value.
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
   * Field-scoped push of ONE genuine parent reminder edit. `patch` carries only
   * the reminder key(s) the parent actually changed, each with the exact value
   * they chose — never a `defaultReminderSettings` fallback or any other ambient
   * local state. This is the only path that writes a cloud reminder value; the
   * whole-row snapshot push above never does. A child whose profile is not
   * cloud-synced yet is a no-op — the local reminder record is already the
   * source of truth and the edit re-flushes on the next call.
   */
  async pushReminderEdit(profileId: string, patch: ChildReminderPatch): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    const childId = await this.local.resolveRemoteChildId(profileId);
    if (!childId) return;
    await this.cloud.patchReminders(childId, patch);
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
    // Single-flight. Bootstrap and every foreground push path funnel through
    // `recover()` (via `ensureChildPreferencesRecovered`), and they fire as
    // separate unawaited effects off the same "session ready" signal. Without
    // this guard two or more recovery passes run concurrently and open
    // overlapping transactions on the single SQLite connection; expo-sqlite then
    // throws `cannot rollback - no transaction is active` mid-hydrate, which
    // aborted the whole pass and starved every child ordered after the failure.
    this.recoverInFlight ??= this.recoverAllChildren().finally(() => {
      this.recoverInFlight = null;
    });
    return this.recoverInFlight;
  }

  private async recoverAllChildren(): Promise<void> {
    for (const row of await this.cloud.listOwned()) {
      try {
        await this.recoverChild(row);
      } catch (err) {
        // Per-child isolation: one child's failure (e.g. a transient SQLite
        // contention error) must never stop the remaining children from
        // recovering. Logged rather than swallowed silently so it is visible.
        console.warn(`[childPreferencesSync] recover: skipped child ${row.childId}`, err);
      }
    }
  }

  private async recoverChild(row: CloudChildPreferences): Promise<void> {
    const profileId = await this.local.findProfileByRemoteChildId(row.childId);
    if (!profileId) return;

    // Customization (brush / background / effect / room layout): the cloud row
    // is authoritative once this device has no unpushed local change of its
    // own. Hydrate it whenever we are NOT dirty — a genuinely new child (no
    // local record) is seeded, an already-resolved but clean device converges
    // to whatever another device last pushed, and a device with a pending
    // local edit keeps it (that edit is pushed on the next sync).
    // `hydrateCustomization` is idempotent when local already equals the cloud.
    const hasLocalCustomization = await this.local.hasLocalCustomization(profileId);
    const customizationClean =
      !hasLocalCustomization || !(await this.local.readCustomizationSyncMeta(profileId)).dirty;
    if (customizationClean) {
      await this.local.hydrateCustomization(profileId, row);
    }

    // Dentist last-visit / next-appointment dates live purely on the child row
    // (no per-parent AsyncStorage scoping), so this does not need parentUserId
    // and must not be skipped by the `return` below. Only seeds a child with
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
    if (!parentUserId) return;

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

    // Reminder times: the cloud row is authoritative. Whenever the cloud
    // carries a real reminder value that DIFFERS from what this device
    // currently holds, converge the local record to it. recover() writes
    // LOCAL storage only — it never calls the cloud. The `08:00 / 20:30`
    // fallback is used ONLY when the cloud has no value for a slot, so a
    // default / seed / legacy / seed-on-read local value can never win over a
    // real cloud one.
    //
    // There is deliberately NO "synced once" / timestamp guard here. The
    // earlier `syncedAt` + `cloudRowNewerThan` gate meant a device that had
    // merely FOREGROUNDED since another device's edit (its own whole-row push
    // stamps a fresh `syncedAt`) would refuse to pull that edit forever. The
    // field-scoped write path (`patch_child_preferences`, real edits only)
    // makes the cloud value trustworthy enough to just take verbatim.
    const cloudHasReminderValue =
      row.morningReminder.enabled ||
      row.eveningReminder.enabled ||
      row.morningReminder.time !== null ||
      row.eveningReminder.time !== null;
    if (cloudHasReminderValue) {
      const cloudReminders = {
        morning: reminderValues(row.morningReminder, '08:00'),
        evening: reminderValues(row.eveningReminder, '20:30'),
      };
      const localReminders = await this.prefs.readReminders(parentUserId, profileId);
      const converged =
        localReminders.morning.enabled === cloudReminders.morning.enabled &&
        localReminders.morning.time === cloudReminders.morning.time &&
        localReminders.evening.enabled === cloudReminders.evening.enabled &&
        localReminders.evening.time === cloudReminders.evening.time;
      if (!converged) {
        await this.prefs.applyRecoveredReminders(parentUserId, profileId, cloudReminders);
      }
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
