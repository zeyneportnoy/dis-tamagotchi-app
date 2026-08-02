import { render, waitFor } from '@testing-library/react-native';

import Index from '../index';

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () => Promise.resolve({ id: 'profile-1', nickname: 'Ege' }),
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
  it('opens Child Home when a profile exists', async () => {
    const view = await render(<Index />);
    await waitFor(() => {
      expect(view.getByText('/(child)')).toBeTruthy();
    });
  });
});
