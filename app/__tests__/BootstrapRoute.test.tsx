import { render, waitFor } from '@testing-library/react-native';

import Index from '../index';

const mockGetActiveProfile = jest.fn();

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: mockGetActiveProfile,
    }),
}));
jest.mock('@/application/sync', () => ({
  getProfileSyncUseCases: () =>
    Promise.resolve({
      countLegacyProfiles: () => Promise.resolve(0),
      recoverFromCloud: () => Promise.resolve(0),
    }),
  recoverChildCloudProgress: () => Promise.resolve(),
  recoverChildBrushingHistory: () => Promise.resolve(),
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

describe('bootstrap route', () => {
  beforeEach(() => {
    mockGetActiveProfile.mockResolvedValue({
      id: 'profile-1',
      nickname: 'Ege',
      dateOfBirth: '2020-01-15',
      ageBand: '4_6',
    });
  });

  it('opens Child Home when a profile exists', async () => {
    const view = await render(<Index />);
    await waitFor(() => {
      expect(view.getByText('/(child)')).toBeTruthy();
    });
  });

  it('requires age-band reselection for a legacy profile', async () => {
    mockGetActiveProfile.mockResolvedValue({
      id: 'profile-legacy',
      nickname: 'Ege',
      dateOfBirth: null,
      ageBand: '6_8',
    });
    const view = await render(<Index />);
    await waitFor(() => {
      expect(view.getByText('/age-band-update')).toBeTruthy();
    });
  });
});
