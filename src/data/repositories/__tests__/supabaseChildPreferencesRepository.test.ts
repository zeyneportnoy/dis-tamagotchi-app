import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseChildPreferencesRepository } from '../SupabaseChildPreferencesRepository';

const baseRow = {
  child_id: 'child-1',
  selected_brush_id: null,
  selected_background_id: null,
  selected_effect_id: null,
  room_configuration: null,
  voice_guide: null,
  morning_reminder_enabled: true,
  morning_reminder_time: '08:05:00',
  evening_reminder_enabled: true,
  evening_reminder_time: '20:35:00',
  dentist_reminder_enabled: false,
  dentist_last_visit_date: null,
  dentist_next_appointment_date: null,
  nickname_personalization_enabled: null,
  updated_at: '2026-09-09T09:00:00.000Z',
};

/** Minimal stub of the supabase-js chains this repo uses. */
const stubClient = (row: Record<string, unknown>) => {
  const rpc = jest.fn().mockResolvedValue({ error: null });
  const client = {
    from: () => ({
      select: () => {
        const listResult = { data: [row], error: null };
        return {
          // get(): .select().eq().maybeSingle()
          eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
          // listOwned(): await .select()
          then: (resolve: (v: typeof listResult) => unknown) => resolve(listResult),
        };
      },
    }),
    rpc,
  } as unknown as SupabaseClient;
  return { client, rpc };
};

describe('SupabaseChildPreferencesRepository — cloud reminder time normalization', () => {
  it('get() trims Postgres HH:MM:SS reminder times to HH:MM', async () => {
    const { client } = stubClient(baseRow);
    const pref = await new SupabaseChildPreferencesRepository(client).get('child-1');
    expect(pref?.morningReminder).toEqual({ enabled: true, time: '08:05' });
    expect(pref?.eveningReminder).toEqual({ enabled: true, time: '20:35' });
  });

  it('listOwned() trims HH:MM:SS too', async () => {
    const { client } = stubClient(baseRow);
    const rows = await new SupabaseChildPreferencesRepository(client).listOwned();
    expect(rows[0]?.morningReminder.time).toBe('08:05');
    expect(rows[0]?.eveningReminder.time).toBe('20:35');
  });

  it('leaves an already-HH:MM value and null untouched', async () => {
    const { client } = stubClient({
      ...baseRow,
      morning_reminder_time: '07:15',
      evening_reminder_time: null,
      evening_reminder_enabled: false,
    });
    const pref = await new SupabaseChildPreferencesRepository(client).get('child-1');
    expect(pref?.morningReminder.time).toBe('07:15');
    expect(pref?.eveningReminder.time).toBeNull();
  });

  it('patchReminders() sends the reminder patch through patch_child_preferences', async () => {
    const { client, rpc } = stubClient(baseRow);
    await new SupabaseChildPreferencesRepository(client).patchReminders('child-1', {
      morning_reminder_enabled: true,
      morning_reminder_time: '08:05',
    });
    expect(rpc).toHaveBeenCalledWith('patch_child_preferences', {
      p_child_id: 'child-1',
      p_patch: { morning_reminder_enabled: true, morning_reminder_time: '08:05' },
    });
  });
});
