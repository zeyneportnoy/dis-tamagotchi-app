import { render, waitFor } from '@testing-library/react-native';

import Index from '../index';

type MockProfile = { id: string; nickname: string; dateOfBirth: string | null; ageBand: string };

const mockGetActiveProfile = jest.fn();
const mockListProfiles = jest.fn();

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: mockGetActiveProfile,
      listProfiles: mockListProfiles,
    }),
}));
jest.mock('@/application/sync', () => ({
  getProfileSyncUseCases: () =>
    Promise.resolve({
      countLegacyProfiles: () => Promise.resolve(0),
      recoverFromCloud: () => Promise.resolve(0),
    }),
  ensureChildDataRecovered: () => Promise.resolve(),
  recoverChildPreferences: () => Promise.resolve(),
  retryPendingCloudSync: () => Promise.resolve(),
}));
jest.mock('@/features/auth', () => ({
  useAuth: () => ({
    configured: true,
    loading: false,
    session: { emailVerified: true, userId: 'parent-1' },
  }),
}));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: 'redirect' }, href),
  };
});

const profileA: MockProfile = { id: 'child-A', nickname: 'A', dateOfBirth: '2019-01-10', ageBand: '4_6' };
const profileB: MockProfile = { id: 'child-B', nickname: 'B', dateOfBirth: null, ageBand: '4_6' };
const fourChildFamily: MockProfile[] = [
  profileA,
  profileB,
  { id: 'child-C', nickname: 'C', dateOfBirth: '2018-05-02', ageBand: '4_6' },
  { id: 'child-D', nickname: 'D', dateOfBirth: null, ageBand: '4_6' },
];

describe('bootstrap route — single child', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveProfile.mockResolvedValue({
      id: 'profile-1',
      nickname: 'Ege',
      dateOfBirth: '2020-01-15',
      ageBand: '4_6',
    });
    mockListProfiles.mockResolvedValue([
      { id: 'profile-1', nickname: 'Ege', dateOfBirth: '2020-01-15', ageBand: '4_6' },
    ]);
  });

  it('opens Child Home when a single complete profile exists', async () => {
    const view = await render(<Index />);
    await waitFor(() => {
      expect(view.getByText('/(child)')).toBeTruthy();
    });
  });

  it('requires age-band reselection for a single legacy/incomplete profile (unchanged behavior)', async () => {
    mockGetActiveProfile.mockResolvedValue({
      id: 'profile-legacy',
      nickname: 'Ege',
      dateOfBirth: null,
      ageBand: '6_8',
    });
    mockListProfiles.mockResolvedValue([
      { id: 'profile-legacy', nickname: 'Ege', dateOfBirth: null, ageBand: '6_8' },
    ]);
    const view = await render(<Index />);
    await waitFor(() => {
      expect(view.getByText('/age-band-update')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// End-to-end reproduction of the reported physical-device bug: a multi-child
// account must ALWAYS see /select-child first, regardless of which child
// happens to be the persisted "active" one or whether that child's own DOB
// is missing. See routeForActiveChild.test.ts for the fast, exhaustive unit
// coverage (repeated-login / 100x scenarios) of the underlying routing
// function this wires up.
// ---------------------------------------------------------------------------
describe('bootstrap route — multi-child account never skips selection for DOB onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListProfiles.mockResolvedValue(fourChildFamily);
  });

  it('persisted active child has a null DOB (child B) — opens child selection FIRST, never DOB onboarding', async () => {
    mockGetActiveProfile.mockResolvedValue(profileB);
    const view = await render(<Index />);
    await waitFor(() => {
      expect(view.getByText('/select-child')).toBeTruthy();
    });
    expect(view.queryByText('/age-band-update')).toBeNull();
  });

  it('persisted active child is complete (child A) — still opens child selection first (selection precedes any specific child route)', async () => {
    mockGetActiveProfile.mockResolvedValue(profileA);
    const view = await render(<Index />);
    await waitFor(() => {
      expect(view.getByText('/select-child')).toBeTruthy();
    });
    expect(view.queryByText('/(child)')).toBeNull();
  });

  it('fresh install shape (no local active profile until cloud recovery resolves it) — still selection first', async () => {
    mockGetActiveProfile.mockResolvedValueOnce(null).mockResolvedValue(profileB);
    const view = await render(<Index />);
    await waitFor(() => {
      expect(view.getByText('/select-child')).toBeTruthy();
    });
    expect(view.queryByText('/age-band-update')).toBeNull();
  });
});
