/**
 * Phase 3 cloud sync contract for a child's customization + preferences:
 * selected brush / background / effect, room configuration, voice guide and the
 * morning / evening / dentist reminder preferences.
 *
 * Best-effort persistence + recovery only. Selection stays governed by the
 * existing current-Mine-Puan unlock guards — nothing here can activate a locked
 * item.
 */

export type CloudVoiceGuide = 'gokce' | 'samet' | 'off';

export type CloudReminderPreference = Readonly<{
  enabled: boolean;
  /** "HH:MM" 24h local time, or null when unknown. */
  time: string | null;
}>;

/**
 * Field-scoped patch for a child's four brushing-reminder columns — the ONLY
 * shape the client may use to change a cloud reminder value (sent through the
 * production `patch_child_preferences` RPC with just these keys). A key that is
 * ABSENT is left untouched; a key set to `null` clears that column. Carries the
 * exact value the parent chose at edit time — it is never derived from
 * `defaultReminderSettings` or any other ambient local state. Keys are the raw
 * `child_preferences` column names.
 */
export type ChildReminderPatch = Readonly<
  Partial<{
    morning_reminder_enabled: boolean;
    morning_reminder_time: string | null;
    evening_reminder_enabled: boolean;
    evening_reminder_time: string | null;
  }>
>;

export type CloudChildPreferences = Readonly<{
  /** public.child_profiles.id of the owned child. */
  childId: string;
  selectedBrushId: string | null;
  selectedBackgroundId: string | null;
  selectedEffectId: string | null;
  /** Opaque JSON mirror of the local CustomizationState (placements + room materials). */
  roomConfiguration: unknown;
  voiceGuide: CloudVoiceGuide | null;
  /**
   * Reminder preferences are READ-ONLY on this snapshot type: `recover()` still
   * hydrates them from the cloud, but the whole-row `upsert()` below never
   * sends them back. The only cloud reminder write is `patchReminders()`, fed by
   * a genuine parent edit and routed through `patch_child_preferences` with just
   * the changed reminder key(s). This prevents an ambient
   * `defaultReminderSettings` (08:00 / 20:30) rebuild from clobbering a real
   * custom time on a foreground sync.
   */
  morningReminder: CloudReminderPreference;
  eveningReminder: CloudReminderPreference;
  dentistReminderEnabled: boolean;
  dentistLastVisitDate: string | null;
  /** Parent-entered next dentist appointment ('YYYY-MM-DD'), or null. */
  dentistNextAppointmentDate: string | null;
  /** Whether brushing should say the child's name. `null` only when no parent
   * context exists to read it from (never a real "off" value). */
  nicknamePersonalizationEnabled: boolean | null;
  /** Supabase `updated_at`; used to decide whether the cloud is newer. */
  updatedAt?: string;
}>;

export type CustomizationSyncMeta = Readonly<{
  /** Last successful push timestamp, or null when never pushed from this device. */
  syncedAt: string | null;
  /** True when the local customization state changed since that push. */
  dirty: boolean;
}>;

export interface CloudChildPreferencesRepository {
  /**
   * Whole-row upsert of a child's voice + dentist + nickname columns. The four
   * `*_reminder_*` columns are deliberately NOT written here even though they are
   * present on the `CloudChildPreferences` argument — pass them for
   * recovery/typing only.
   *
   * The customization columns (`selected_brush_id` / `selected_background_id` /
   * `selected_effect_id` / `room_configuration`) are written ONLY when
   * `opts.includeCustomization` is true — i.e. when the calling device actually
   * holds an unpushed customization change. A stale foreground push must not
   * rewrite them, or it would clobber another device's newer selection.
   */
  upsert(
    preferences: CloudChildPreferences,
    opts?: Readonly<{ includeCustomization?: boolean }>,
  ): Promise<void>;
  /**
   * Field-scoped write of a genuine parent reminder edit, routed through the
   * production `patch_child_preferences` RPC with only the reminder key(s) in
   * `patch`. Updates only those columns; every other column and every other
   * child row is untouched. Creates the child's preference row first if it does
   * not exist yet.
   */
  patchReminders(childId: string, patch: ChildReminderPatch): Promise<void>;
  /** Current cloud row for one child, or null when none exists yet. */
  get(childId: string): Promise<CloudChildPreferences | null>;
  listOwned(): Promise<readonly CloudChildPreferences[]>;
}

export interface LocalChildPreferenceSyncRepository {
  /** Remote child id, or null while the child profile itself is not synced yet. */
  resolveRemoteChildId(profileId: string): Promise<string | null>;
  /** Local profile ids whose child profile is already cloud-synced. */
  listSyncedProfileIds(): Promise<readonly string[]>;
  /** The Supabase auth user id that owns this profile (the per-parent prefs key). */
  resolveParentUserId(profileId: string): Promise<string | null>;
  readCustomizationForPush(profileId: string): Promise<
    Readonly<{
      selectedBrushId: string | null;
      selectedBackgroundId: string | null;
      selectedEffectId: string | null;
      roomConfiguration: unknown;
    }>
  >;
  /**
   * True once ANY local `dentist_reminders` row exists for this child — set at
   * child-creation time on the creating device, or by
   * `ChildPreferenceAccessors.applyRecoveredDentist` during recovery on any
   * other device. Doubles as the cloud-push value (`dentist_reminder_enabled`)
   * and as the recovery gate: a child with no row yet has not resolved its
   * dentist state on this device at all.
   */
  dentistReminderEnabled(profileId: string): Promise<boolean>;
  /** Real local dentist dates for a push snapshot — never fabricated/null. */
  readDentistDatesForPush(
    profileId: string,
  ): Promise<Readonly<{ lastVisitDate: string | null; nextAppointmentDate: string | null }>>;
  /** The child's current nickname, for the recovered-dentist notification copy. */
  resolveNickname(profileId: string): Promise<string>;
  hasLocalCustomization(profileId: string): Promise<boolean>;
  /**
   * Hydrates the recovered selection into BOTH local stores: the customization
   * AsyncStorage state (DEV) and the `inventory_items` equipped rows that
   * production reads (only for selections the current Mine Puan already
   * unlocks). Written verbatim — the render-time unlock guards still govern
   * activation, so a locked cloud selection can never become active.
   */
  hydrateCustomization(profileId: string, preferences: CloudChildPreferences): Promise<void>;
  /** Local profile that maps to `remoteChildId`, or null when none is owned. */
  findProfileByRemoteChildId(remoteChildId: string): Promise<string | null>;

  /** Records what was just pushed so a later recovery can compare timestamps. */
  markCustomizationSynced(profileId: string, roomConfiguration: unknown): Promise<void>;
  /** Whether the local customization is newer than the last push, and when that was. */
  readCustomizationSyncMeta(profileId: string): Promise<CustomizationSyncMeta>;
}
