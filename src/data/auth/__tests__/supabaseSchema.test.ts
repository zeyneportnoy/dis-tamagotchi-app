import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Supabase M3.5 schema contract', () => {
  const sql = readFileSync(
    resolve('supabase/migrations/202608080001_m35_parent_auth_profiles.sql'),
    'utf8',
  );

  it('enables RLS and binds parent/child ownership to auth.uid()', () => {
    expect(sql).toContain('alter table public.parent_profiles enable row level security');
    expect(sql).toContain('alter table public.child_profiles enable row level security');
    expect(sql).toContain('(select auth.uid()) = id');
    expect(sql).toContain('(select auth.uid()) = parent_id');
    expect(sql).toContain('revoke all on public.child_profiles from anon');
  });

  it('does not duplicate auth email or include child birthdate fields', () => {
    const childTable = sql.slice(sql.indexOf('create table if not exists public.child_profiles'));
    expect(childTable).not.toMatch(/birth|email|phone/i);
    const parentTable = sql.slice(
      sql.indexOf('create table if not exists public.parent_profiles'),
      sql.indexOf('create table if not exists public.child_profiles'),
    );
    expect(parentTable).not.toMatch(/email/i);
  });
});
