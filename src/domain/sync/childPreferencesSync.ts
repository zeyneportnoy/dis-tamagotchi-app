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

export type CloudChildPreferences = Readonly<{
  /** public.child_profiles.id of the owned child. */
  childId: string;
  selectedBrushId: string | null;
  selectedBackgroundId: string | null;
  selectedEffectId: string | null;
  /** Opaque JSON mirror of the local CustomizationState (placements + room materials). */
  roomConfiguration: unknown;
  voiceGuide: CloudVoiceGuide | null;
  morningReminder: CloudReminderPreference;
  eveningReminder: CloudReminderPreference;
  dentistReminderEnabled: boolean;
  dentistLastVisitDate: string | null;
}>;

export interface CloudChildPreferencesRepository {
  upsert(preferences: CloudChildPreferences): Promise<void>;
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
  dentistReminderEnabled(profileId: string): Promise<boolean>;
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
}
