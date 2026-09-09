import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ChildReminderPatch,
  CloudChildPreferences,
  CloudChildPreferencesRepository,
  CloudVoiceGuide,
} from '@/domain/sync';

const VOICE_GUIDES: readonly CloudVoiceGuide[] = ['gokce', 'samet', 'off'];

const asVoiceGuide = (value: unknown): CloudVoiceGuide | null =>
  typeof value === 'string' && (VOICE_GUIDES as readonly string[]).includes(value)
    ? (value as CloudVoiceGuide)
    : null;

/**
 * Postgres `time` columns serialize as `HH:MM:SS` (e.g. `08:05:00`). Everything
 * downstream — `ReminderSettingsService.sanitizeTime`'s `HH:MM` regex, the local
 * AsyncStorage record, the reminder screen, the grouped scheduler — expects
 * `HH:MM`. Without this trim, `sanitizeTime` rejects the `HH:MM:SS` string and
 * silently substitutes the 08:00 / 20:30 default, so recover() can never make a
 * device converge to a real cloud reminder time.
 */
const toHHmm = (time: string | null): string | null =>
  time == null ? null : /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : time;

type PreferencesRow = {
  child_id: string;
  selected_brush_id: string | null;
  selected_background_id: string | null;
  selected_effect_id: string | null;
  room_configuration: unknown;
  voice_guide: string | null;
  morning_reminder_enabled: boolean | null;
  morning_reminder_time: string | null;
  evening_reminder_enabled: boolean | null;
  evening_reminder_time: string | null;
  dentist_reminder_enabled: boolean | null;
  dentist_last_visit_date: string | null;
  dentist_next_appointment_date: string | null;
  nickname_personalization_enabled: boolean | null;
  updated_at: string | null;
};

const mapRow = (row: PreferencesRow): CloudChildPreferences => ({
  childId: row.child_id,
  selectedBrushId: row.selected_brush_id,
  selectedBackgroundId: row.selected_background_id,
  selectedEffectId: row.selected_effect_id,
  roomConfiguration: row.room_configuration ?? null,
  voiceGuide: asVoiceGuide(row.voice_guide),
  morningReminder: {
    enabled: row.morning_reminder_enabled === true,
    time: toHHmm(row.morning_reminder_time),
  },
  eveningReminder: {
    enabled: row.evening_reminder_enabled === true,
    time: toHHmm(row.evening_reminder_time),
  },
  dentistReminderEnabled: row.dentist_reminder_enabled === true,
  dentistLastVisitDate: row.dentist_last_visit_date,
  dentistNextAppointmentDate: row.dentist_next_appointment_date,
  nicknamePersonalizationEnabled: row.nickname_personalization_enabled,
  updatedAt: row.updated_at ?? undefined,
});

/**
 * Writes a child's customization + preference snapshot to Supabase as a single
 * idempotent upsert keyed on `child_id`. RLS scopes every row to the owning
 * parent. Audio assets and notification scheduling are never touched — only the
 * preference values.
 *
 * The four `*_reminder_*` columns are intentionally excluded from the whole-row
 * upsert: a snapshot rebuilt from ambient local state (`defaultReminderSettings`,
 * the legacy seed, seed-on-read) must never be able to revert a real custom time
 * on a foreground sync. Every genuine reminder edit goes through
 * `patchReminders()`, which is the ONLY path that writes a reminder column and
 * only ever sends the field(s) the parent actually changed.
 *
 * (A follow-up migration will additionally revoke the client's column-level
 * INSERT/UPDATE grant on the four reminder columns as defense in depth, once the
 * reminder-only client is verified on real devices. `patch_child_preferences`
 * already exists in production as of migration m11 Phase 1.)
 */
export class SupabaseChildPreferencesRepository implements CloudChildPreferencesRepository {
  constructor(private readonly client: SupabaseClient) {}

  async upsert(preferences: CloudChildPreferences): Promise<void> {
    const { error } = await this.client.from('child_preferences').upsert(
      {
        child_id: preferences.childId,
        selected_brush_id: preferences.selectedBrushId,
        selected_background_id: preferences.selectedBackgroundId,
        selected_effect_id: preferences.selectedEffectId,
        room_configuration: preferences.roomConfiguration ?? null,
        voice_guide: preferences.voiceGuide,
        dentist_reminder_enabled: preferences.dentistReminderEnabled,
        dentist_last_visit_date: preferences.dentistLastVisitDate,
        dentist_next_appointment_date: preferences.dentistNextAppointmentDate,
        nickname_personalization_enabled: preferences.nicknamePersonalizationEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'child_id' },
    );
    if (error) throw new Error('CLOUD_PREFERENCES_UPSERT_FAILED');
  }

  /**
   * Field-scoped write of a genuine parent reminder edit via the production
   * `patch_child_preferences(child_id, patch)` RPC (migration m11 Phase 1). Only
   * the reminder key(s) present in `patch` are sent — every one is on that RPC's
   * whitelist — and the RPC updates only those columns, leaving every other
   * column and every other child untouched. An empty patch is never sent (the
   * RPC rejects `{}` with `bad_patch`).
   */
  async patchReminders(childId: string, patch: ChildReminderPatch): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    const { error } = await this.client.rpc('patch_child_preferences', {
      p_child_id: childId,
      p_patch: patch,
    });
    if (error) throw new Error('CLOUD_REMINDERS_PATCH_FAILED');
  }

  async listOwned(): Promise<readonly CloudChildPreferences[]> {
    const { data, error } = await this.client
      .from('child_preferences')
      .select(
        'child_id, selected_brush_id, selected_background_id, selected_effect_id, room_configuration, voice_guide, morning_reminder_enabled, morning_reminder_time, evening_reminder_enabled, evening_reminder_time, dentist_reminder_enabled, dentist_last_visit_date, dentist_next_appointment_date, nickname_personalization_enabled, updated_at',
      );
    if (error) throw new Error('CLOUD_PREFERENCES_LIST_FAILED');
    return (data as PreferencesRow[]).map(mapRow);
  }

  async get(childId: string): Promise<CloudChildPreferences | null> {
    const { data, error } = await this.client
      .from('child_preferences')
      .select(
        'child_id, selected_brush_id, selected_background_id, selected_effect_id, room_configuration, voice_guide, morning_reminder_enabled, morning_reminder_time, evening_reminder_enabled, evening_reminder_time, dentist_reminder_enabled, dentist_last_visit_date, dentist_next_appointment_date, nickname_personalization_enabled, updated_at',
      )
      .eq('child_id', childId)
      .maybeSingle();
    if (error) throw new Error('CLOUD_PREFERENCES_GET_FAILED');
    return data ? mapRow(data as PreferencesRow) : null;
  }
}
