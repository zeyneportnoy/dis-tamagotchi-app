import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { starterAvatarKeys } from '@/domain/family';

const readMigration = (file: string): string =>
  readFileSync(resolve('supabase/migrations', file), 'utf8');

// The repo migration chain must represent the real backend's final state for
// public.child_profiles: DOB column present, age_band limited to the two
// supported bands, and avatar_id constrained to the 8 canonical character ids.
const parentAuthProfiles = readMigration('202608080001_m35_parent_auth_profiles.sql');
const characterIdentityKeys = readMigration('202608090001_m4_character_identity_keys.sql');
const childDateOfBirth = readMigration('202608100001_m5_child_date_of_birth.sql');
const childDataRls = readMigration('202608110001_m6_child_data_rls.sql');
const slotEvaluationAppliedPenalty = readMigration(
  '202608120001_m7_slot_evaluation_applied_penalty.sql',
);
const dentistNextAppointmentDate = readMigration(
  '202608130001_m8_dentist_next_appointment_date.sql',
);
const nicknamePersonalizationEnabled = readMigration(
  '202608140001_m9_nickname_personalization_enabled.sql',
);

// Remote temporarily still accepts these for two old test rows, but they are NOT
// part of the app's canonical schema and must never be persisted by new records.
const legacyAvatarIds = ['cheerful-incisor', 'sleepy-molar', 'brave-canine'] as const;

const canonicalAvatarConstraint = characterIdentityKeys.slice(
  characterIdentityKeys.lastIndexOf('check (avatar_id in ('),
);

describe('Supabase repo schema contract — child_profiles', () => {
  it('enables RLS and binds parent/child ownership to auth.uid()', () => {
    expect(parentAuthProfiles).toContain(
      'alter table public.parent_profiles enable row level security',
    );
    expect(parentAuthProfiles).toContain(
      'alter table public.child_profiles enable row level security',
    );
    expect(parentAuthProfiles).toContain('(select auth.uid()) = id');
    expect(parentAuthProfiles).toContain('(select auth.uid()) = parent_id');
    expect(parentAuthProfiles).toContain('revoke all on public.child_profiles from anon');
    expect(parentAuthProfiles).toContain(
      'parent_id uuid not null references public.parent_profiles(id) on delete cascade',
    );
  });

  it('restricts age_band to the two supported bands only', () => {
    expect(parentAuthProfiles).toContain(
      "age_band text not null check (age_band in ('4_6', '7_11'))",
    );
    expect(parentAuthProfiles).not.toMatch(/'(6_8|9_10)'/);
  });

  it('defines child_profiles.date_of_birth as a nullable date column', () => {
    expect(childDateOfBirth).toMatch(/alter table public\.child_profiles/);
    expect(childDateOfBirth).toMatch(/add column if not exists date_of_birth date;/);
    expect(childDateOfBirth).not.toMatch(/date_of_birth date[^;]*not null/i);
  });

  it('makes the 8 canonical character ids the final avatar_id constraint', () => {
    for (const key of starterAvatarKeys) {
      expect(canonicalAvatarConstraint).toContain(`'${key}'`);
    }
    expect(canonicalAvatarConstraint.match(/'[a-z]+'/g)).toHaveLength(starterAvatarKeys.length);
  });

  it('keeps the legacy avatar ids out of the canonical app schema', () => {
    for (const legacy of legacyAvatarIds) {
      expect(canonicalAvatarConstraint).not.toContain(`'${legacy}'`);
    }
    // The rename migration still maps old ids forward — without keeping them valid.
    expect(characterIdentityKeys).toContain("when 'cheerful-incisor' then 'inci'");
    expect(characterIdentityKeys).toContain('drop constraint if exists child_profiles_avatar_id_check');
  });

  it('does not duplicate the auth email or phone on either profile table', () => {
    expect(parentAuthProfiles).not.toMatch(/\b(email|phone)\b/i);
  });
});

describe('Supabase repo schema contract — child game-data tables', () => {
  const dataTables = [
    'child_progress',
    'brushing_sessions',
    'brushing_slot_evaluations',
    'child_preferences',
  ] as const;

  it('enables row level security on every child game-data table', () => {
    for (const table of dataTables) {
      expect(childDataRls).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('scopes every row to a child_profiles row owned by the authenticated parent', () => {
    // Ownership predicate: child_id -> child_profiles.parent_id == auth.uid().
    expect(childDataRls).toContain('cp.parent_id = (select auth.uid())');
    expect(childDataRls).toContain('references public.child_profiles(id) on delete cascade');
    for (const table of dataTables) {
      expect(childDataRls).toContain(`create policy "${table}_owned" on public.${table}`);
      expect(childDataRls).toMatch(
        new RegExp(`policy "${table}_owned"[\\s\\S]*?using \\(public\\.owns_child\\(child_id\\)\\)`),
      );
    }
  });

  it('gives anon no access to any child game-data table', () => {
    for (const table of dataTables) {
      expect(childDataRls).toContain(`revoke all on public.${table} from anon`);
    }
  });

  it('constrains reward_mine / penalty_mine / period / voice_guide to the product values', () => {
    expect(childDataRls).toContain("reward_mine in (0, 20)");
    expect(childDataRls).toContain("penalty_mine in (0, -10)");
    expect(childDataRls).toContain("status in ('completed', 'interrupted')");
    expect(childDataRls).toContain("voice_guide in ('gokce', 'samet', 'off')");
  });

  it('adds the actual applied slot-penalty delta as a purely additive, nullable column', () => {
    expect(slotEvaluationAppliedPenalty).toContain(
      'alter table public.brushing_slot_evaluations',
    );
    expect(slotEvaluationAppliedPenalty).toContain(
      'add column if not exists applied_penalty_mine integer',
    );
    // Nullable (no "not null"), and range-constrained when present — legacy
    // rows stay NULL rather than being backfilled with a guessed value.
    expect(slotEvaluationAppliedPenalty).not.toMatch(/applied_penalty_mine[^;]*not null/i);
    expect(slotEvaluationAppliedPenalty).toContain(
      'check (applied_penalty_mine is null or applied_penalty_mine between -10 and 0)',
    );
    expect(slotEvaluationAppliedPenalty).not.toMatch(/\bupdate\s+public\.brushing_slot_evaluations/i);
    expect(slotEvaluationAppliedPenalty).not.toMatch(/\bdelete\s+from\b/i);
  });

  it('adds dentist_next_appointment_date as a purely additive, nullable column', () => {
    expect(dentistNextAppointmentDate).toContain('alter table public.child_preferences');
    expect(dentistNextAppointmentDate).toContain(
      'add column if not exists dentist_next_appointment_date date;',
    );
    expect(dentistNextAppointmentDate).not.toMatch(
      /dentist_next_appointment_date date[^;]*not null/i,
    );
  });

  it('adds nickname_personalization_enabled as a purely additive, nullable column', () => {
    expect(nicknamePersonalizationEnabled).toContain('alter table public.child_preferences');
    expect(nicknamePersonalizationEnabled).toContain(
      'add column if not exists nickname_personalization_enabled boolean;',
    );
    expect(nicknamePersonalizationEnabled).not.toMatch(
      /nickname_personalization_enabled boolean[^;]*not null/i,
    );
  });
});

describe('client source contains no server secrets', () => {
  const forbidden = [
    /service[_-]?role/i,
    /SUPABASE_SERVICE_ROLE/i,
    /SERVICE_ROLE_KEY/i,
    /postgres:\/\/[^"'\s]*:[^"'\s]+@/i, // db connection string with password
    /db[_-]?password/i,
  ];

  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        out.push(...walk(full));
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\.[tj]sx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  };

  it('never references a service-role key or database password', () => {
    const files = [...walk(resolve('src')), ...walk(resolve('app'))];
    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, 'utf8');
      if (forbidden.some((pattern) => pattern.test(contents))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('reads only the publishable/client-safe Supabase key from env', () => {
    const config = readFileSync(resolve('src/config/supabase.ts'), 'utf8');
    expect(config).toContain('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    expect(config).not.toMatch(/anon[_-]?key/i);
    expect(config).not.toMatch(/service[_-]?role/i);
  });
});
