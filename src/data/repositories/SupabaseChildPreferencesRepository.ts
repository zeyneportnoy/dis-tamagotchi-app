import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CloudChildPreferences,
  CloudChildPreferencesRepository,
  CloudVoiceGuide,
} from '@/domain/sync';

const VOICE_GUIDES: readonly CloudVoiceGuide[] = ['gokce', 'samet', 'off'];

const asVoiceGuide = (value: unknown): CloudVoiceGuide | null =>
  typeof value === 'string' && (VOICE_GUIDES as readonly string[]).includes(value)
    ? (value as CloudVoiceGuide)
    : null;

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
    time: row.morning_reminder_time,
  },
  eveningReminder: {
    enabled: row.evening_reminder_enabled === true,
    time: row.evening_reminder_time,
  },
  dentistReminderEnabled: row.dentist_reminder_enabled === true,
  dentistLastVisitDate: row.dentist_last_visit_date,
});

/**
 * Writes a child's customization + preference snapshot to Supabase as a single
 * idempotent upsert keyed on `child_id`. RLS scopes every row to the owning
 * parent. Audio assets and notification scheduling are never touched — only the
 * preference values.
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
        morning_reminder_enabled: preferences.morningReminder.enabled,
        morning_reminder_time: preferences.morningReminder.time,
        evening_reminder_enabled: preferences.eveningReminder.enabled,
        evening_reminder_time: preferences.eveningReminder.time,
        dentist_reminder_enabled: preferences.dentistReminderEnabled,
        dentist_last_visit_date: preferences.dentistLastVisitDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'child_id' },
    );
    if (error) throw new Error('CLOUD_PREFERENCES_UPSERT_FAILED');
  }

  async listOwned(): Promise<readonly CloudChildPreferences[]> {
    const { data, error } = await this.client.from('child_preferences').select('*');
    if (error) throw new Error('CLOUD_PREFERENCES_LIST_FAILED');
    return (data as PreferencesRow[]).map(mapRow);
  }
}
