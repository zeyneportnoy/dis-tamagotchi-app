import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { customizationStorageKey } from '@/features/customization';

import ProfileScreen from '../profile';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(() => callback(), [callback]),
  };
});

jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve({
          id: 'profile-1',
          nickname: 'Ege',
          dateOfBirth: '2016-01-15',
          ageBand: '7_11',
          avatarId: 'inci',
          createdAt: '2026-08-09T00:00:00.000Z',
        }),
    }),
}));

jest.mock('@/application/child', () => ({
  getChildExperienceUseCases: () =>
    Promise.resolve({
      getProgress: () => Promise.resolve({ totalXp: 5000, currentStreak: 4 }),
      listInventory: () =>
        Promise.resolve([
          {
            key: 'cloud-room',
            icon: '🏡',
            slot: 'background',
            unlockXp: 100,
            unlocked: true,
            equipped: true,
            unlockedAt: '2026-08-09T00:00:00.000Z',
          },
          {
            key: 'star-sparkle',
            icon: '✨',
            slot: 'effect',
            unlockXp: 200,
            unlocked: true,
            equipped: true,
            unlockedAt: '2026-08-09T00:00:00.000Z',
          },
          {
            key: 'classic-brush',
            icon: '🪥',
            slot: 'brush',
            unlockXp: 0,
            unlocked: true,
            equipped: true,
            unlockedAt: '2026-08-09T00:00:00.000Z',
          },
          {
            key: 'star-brush',
            icon: '🖌️',
            slot: 'brush',
            unlockXp: 300,
            unlocked: true,
            equipped: false,
            unlockedAt: '2026-08-09T00:00:00.000Z',
          },
        ]),
    }),
}));

describe('ProfileScreen summary card', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await AsyncStorage.setItem(
      customizationStorageKey('profile-1'),
      JSON.stringify({ selectedRoomMaterials: ['cloud-cloud-cushion'], version: 1 }),
    );
  });

  it('binds real profile, growth stage, background, effect and selected items to the card', async () => {
    const view = await render(<ProfileScreen />);

    await waitFor(() => expect(view.getByTestId('profile-summary-card')).toBeTruthy());

    // Real profile fields.
    expect(view.getAllByText('Ege').length).toBeGreaterThan(0);
    expect(view.getByText('7–11 yaş')).toBeTruthy();

    // Real growth / tooth stage derived from totalXp (5000 -> final stage).
    expect(view.getByTestId('profile-tooth-stage')).toHaveTextContent('Gelişmiş diş');

    // Selected collection visuals bound to the scene.
    expect(view.getByTestId('profile-background-cloud-room')).toBeTruthy();
    expect(view.getByTestId('profile-character-effect')).toBeTruthy();
    fireEvent(view.getByTestId('profile-summary-scene'), 'layout', {
      nativeEvent: { layout: { height: 236, width: 320, x: 0, y: 0 } },
    });
    await waitFor(() =>
      expect(view.getByTestId('profile-room-material-cloud-cloud-cushion')).toBeTruthy(),
    );

    // Equipped items + selected room material appear as chips; unequipped ones do not.
    expect(view.getByTestId('profile-item-chip-item:cloud-room')).toBeTruthy();
    expect(view.getByTestId('profile-item-chip-item:star-sparkle')).toBeTruthy();
    expect(view.getByTestId('profile-item-chip-item:classic-brush')).toBeTruthy();
    expect(view.getByTestId('profile-item-chip-material:cloud-cloud-cushion')).toBeTruthy();
    expect(view.queryByTestId('profile-item-chip-item:star-brush')).toBeNull();
  });
});
