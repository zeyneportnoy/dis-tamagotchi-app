import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { minimumTouchTarget } from '@/design-system';

import ChildHomeScreen from '../index';

jest.mock('@/application/child', () => ({
  getChildExperienceUseCases: () =>
    Promise.resolve({
      getProgress: () =>
        Promise.resolve({
          childProfileId: 'profile-1',
          statusDate: '2026-08-08',
          morningCompleted: false,
          eveningCompleted: false,
          currentStreak: 0,
          lastInteractionAt: null,
          lastBrushingAt: null,
        }),
    }),
}));
jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve({
          id: 'profile-1',
          nickname: 'Ege',
          ageBand: '4_6',
          avatarId: 'cheerful-incisor',
        }),
      listProfiles: () =>
        Promise.resolve([
          {
            id: 'profile-1',
            nickname: 'Ege',
            ageBand: '4_6',
            avatarId: 'cheerful-incisor',
          },
          {
            id: 'profile-2',
            nickname: 'Ada',
            ageBand: '7_11',
            avatarId: 'brave-canine',
          },
        ]),
      selectActiveProfile: jest.fn(),
    }),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

describe('Child Home route', () => {
  it('shows the active profile character, brushing cards and primary action', async () => {
    const view = await render(<ChildHomeScreen />);
    await waitFor(() => expect(view.getByTestId('child-home-screen')).toBeTruthy());

    expect(view.getByText('Merhaba, Ege! 👋')).toBeTruthy();
    expect(
      view.getAllByTestId('character-cheerful-incisor', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(view.getByText('Sabah fırçalama')).toBeTruthy();
    expect(view.getByText('Akşam fırçalama')).toBeTruthy();
    const brushButton = view.getByRole('button', { name: 'Fırçalayalım!' });
    expect(StyleSheet.flatten(brushButton.props.style).minHeight).toBeGreaterThanOrEqual(
      minimumTouchTarget,
    );
  });

  it('opens the real brushing session route', async () => {
    const view = await render(<ChildHomeScreen />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Fırçalayalım!' })).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Fırçalayalım!' }));
    expect(router.push).toHaveBeenCalledWith('/brushing');
  });

  it('removes the large profile form but keeps profile switching accessible', async () => {
    const view = await render(<ChildHomeScreen />);
    await waitFor(() => expect(view.getByTestId('profile-switcher-trigger')).toBeTruthy());
    expect(view.queryByText('Profil seç')).toBeNull();
    const trigger = view.getByRole('button', {
      name: 'Aktif profil: Ege. Profil değiştirmek için dokun.',
    });
    expect(StyleSheet.flatten(trigger.props.style).minHeight).toBeGreaterThanOrEqual(
      minimumTouchTarget,
    );
    fireEvent.press(view.getByTestId('profile-switcher-trigger'));
    await waitFor(() => expect(view.getByTestId('profile-switcher-modal')).toBeTruthy());
    expect(view.getByText('Profili değiştir')).toBeTruthy();
    expect(view.getByRole('radio', { name: 'Ada' })).toBeTruthy();
  });
});
