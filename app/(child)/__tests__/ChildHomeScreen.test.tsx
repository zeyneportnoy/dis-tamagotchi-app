import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { minimumTouchTarget } from '@/design-system';

import ChildHomeScreen from '../index';

const mockSetBrushingCompleted = jest.fn(() =>
  Promise.resolve({
    childProfileId: 'profile-1',
    statusDate: '2026-08-08',
    morningCompleted: true,
    eveningCompleted: false,
    currentStreak: 0,
    lastInteractionAt: '2026-08-08T07:30:00.000Z',
    lastBrushingAt: '2026-08-08T07:30:00.000Z',
  }),
);

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
      setBrushingCompleted: mockSetBrushingCompleted,
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
      listProfiles: () => Promise.resolve([]),
    }),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

describe('Child Home route', () => {
  it('shows the active profile character, brushing cards and primary action', async () => {
    const view = await render(<ChildHomeScreen />);
    await waitFor(() => expect(view.getByTestId('child-home-screen')).toBeTruthy());

    expect(view.getByText('Merhaba, Ege!')).toBeTruthy();
    expect(
      view.getAllByTestId('character-cheerful-incisor', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(view.getByText('Sabah fırçalama')).toBeTruthy();
    expect(view.getByText('Akşam fırçalama')).toBeTruthy();
    const brushButton = view.getByRole('button', { name: 'Fırçalayalım' });
    expect(StyleSheet.flatten(brushButton.props.style).minHeight).toBeGreaterThanOrEqual(
      minimumTouchTarget,
    );
  });

  it('persists a morning task interaction through the use case', async () => {
    const view = await render(<ChildHomeScreen />);
    await waitFor(() => expect(view.getByTestId('morning-task')).toBeTruthy());
    await act(async () => fireEvent.press(view.getByTestId('morning-task')));
    await waitFor(() =>
      expect(mockSetBrushingCompleted).toHaveBeenCalledWith('profile-1', 'morning', true),
    );
  });
});
