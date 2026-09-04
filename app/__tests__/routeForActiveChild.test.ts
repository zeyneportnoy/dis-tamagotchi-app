/**
 * Direct, fast unit coverage for the exact function that caused the reported
 * physical-device bug: `routeForActiveChild` (app/index.tsx) evaluated the
 * PERSISTED "active" child's profile-completeness BEFORE checking whether the
 * family has multiple children, so a stale/incomplete active child (DOB null)
 * routed the whole bootstrap straight into DOB onboarding, bypassing
 * /select-child entirely. These tests exercise the function directly (no
 * React rendering) so a 100x repeat is fast and deterministic — see
 * BootstrapRoute.test.tsx for the full-component integration proof of the
 * same fix.
 */
import { routeForActiveChild, routeForProfile } from '../index';

type FakeProfile = { id: string; dateOfBirth: string | null; ageBand: string };

const profileA: FakeProfile = { id: 'child-A', dateOfBirth: '2019-01-10', ageBand: '4_6' };
const profileB: FakeProfile = { id: 'child-B', dateOfBirth: null, ageBand: '4_6' };
const profileC: FakeProfile = { id: 'child-C', dateOfBirth: '2018-05-02', ageBand: '4_6' };
const profileD: FakeProfile = { id: 'child-D', dateOfBirth: null, ageBand: '4_6' };
const fourChildFamily = [profileA, profileB, profileC, profileD];

const familyWith = (profiles: readonly FakeProfile[]) => ({
  listProfiles: jest.fn().mockResolvedValue(profiles),
});

describe('routeForProfile — single-profile completeness (unchanged)', () => {
  it('routes to age-band-update when DOB is null', () => {
    expect(routeForProfile(profileB)).toBe('age-band-update');
  });

  it('routes to child when DOB is present and age band is current', () => {
    expect(routeForProfile(profileA)).toBe('child');
  });

  it('routes to age-band-update for a legacy age band even with a DOB', () => {
    expect(routeForProfile({ dateOfBirth: '2015-01-01', ageBand: '6_8' })).toBe('age-band-update');
  });
});

describe('routeForActiveChild — multi-child accounts always resolve to child-select first', () => {
  it.each([
    ['A (DOB present)', profileA],
    ['B (DOB null)', profileB],
    ['C (DOB present)', profileC],
    ['D (DOB null)', profileD],
  ])('persisted active child = %s -> child-select, never age-band-update', async (_label, active) => {
    const family = familyWith(fourChildFamily);
    await expect(routeForActiveChild(family, active)).resolves.toBe('child-select');
  });

  it('B) persisted last-selected child = B (DOB null): repeated calls (simulating logout/login) always resolve to child-select', async () => {
    const family = familyWith(fourChildFamily);
    for (let i = 0; i < 5; i += 1) {
      await expect(routeForActiveChild(family, profileB)).resolves.toBe('child-select');
    }
  });

  it('C) persisted last-selected child = A (DOB present): repeated calls still resolve to child-select, never auto-opens child A', async () => {
    const family = familyWith(fourChildFamily);
    for (let i = 0; i < 5; i += 1) {
      const destination = await routeForActiveChild(family, profileA);
      expect(destination).toBe('child-select');
      expect(destination).not.toBe('child');
    }
  });

  it('D) fresh install + cloud recovery shape: listProfiles reflects the just-recovered family, still child-select', async () => {
    const family = familyWith(fourChildFamily); // as populated by recoverFromCloud() before this call
    await expect(routeForActiveChild(family, profileB)).resolves.toBe('child-select');
  });

  it('E) repeated login/bootstrap 100 times never routes to age-band-update before child-select', async () => {
    const family = familyWith(fourChildFamily);
    for (let i = 0; i < 100; i += 1) {
      const destination = await routeForActiveChild(family, profileB);
      expect(destination).toBe('child-select');
      expect(destination).not.toBe('age-band-update');
    }
  });

  it("a complete sibling (C) selected later is unaffected by B/D's missing DOB — this call alone still only proves selection is offered, not a specific child's route", async () => {
    const family = familyWith(fourChildFamily);
    await expect(routeForActiveChild(family, profileC)).resolves.toBe('child-select');
  });
});

describe('routeForActiveChild — single-child accounts preserve existing behavior', () => {
  it('a single complete profile routes straight to child (no selection screen)', async () => {
    const family = familyWith([profileA]);
    await expect(routeForActiveChild(family, profileA)).resolves.toBe('child');
  });

  it('a single incomplete profile (DOB null) still routes to age-band-update directly — recovery must have resolved listProfiles first, but with exactly one child there is nothing to select between', async () => {
    const family = familyWith([profileB]);
    await expect(routeForActiveChild(family, profileB)).resolves.toBe('age-band-update');
  });
});
