import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { starterAvatarKeys } from '@/domain/family';

const readMigration = (file: string): string =>
  readFileSync(resolve('supabase/migrations', file), 'utf8');

// The repo migration chain must represent the real backend's final state for
// public.child_profiles: DOB column present, age_band limited to the two
// supported bands, and avatar_id constrained to the 8 canonical character ids.
const parentAuthProfiles = readMigration('202608080001_m35_parent_auth_profiles.sql');
const characterIdentityKeys = readMigration('202608090001_m4_character_identity_keys.sql');
const childDateOfBirth = readMigration('202608100001_m5_child_date_of_birth.sql');

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
