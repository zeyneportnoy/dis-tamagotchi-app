import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { minimumTouchTarget } from '@/design-system';
import type { InventoryItem } from '@/domain/rewards';

import ChildHomeScreen from '../index';

const defaultProgress = {
  childProfileId: 'profile-1',
  statusDate: '2026-08-08',
  morningCompleted: false,
  eveningCompleted: false,
  currentStreak: 0,
  totalXp: 0,
  level: 1,
  mood: 50,
  lastInteractionAt: null,
  lastBrushingAt: null,
};
const mockGetProgress = jest.fn((_profileId: string) => Promise.resolve(defaultProgress));
const mockListInventory = jest.fn<Promise<readonly InventoryItem[]>, []>(() =>
  Promise.resolve([]),
);
const mockHomeProfiles = [
  { id: 'profile-1', nickname: 'Ege', ageBand: '4_6', avatarId: 'inci' },
  { id: 'profile-2', nickname: 'Ada', ageBand: '7_11', avatarId: 'kaan' },
] as const;
let mockActiveHomeProfileId = 'profile-1';
const mockSelectActiveProfile = jest.fn(async (profileId: string) => {
  mockActiveHomeProfileId = profileId;
});

jest.mock('@/application/child', () => ({
  getChildExperienceUseCases: () =>
    Promise.resolve({
      getProgress: mockGetProgress,
      listInventory: mockListInventory,
      unequipAccessorySlot: jest.fn(),
    }),
}));
jest.mock('@/application/family', () => ({
  getFamilyUseCases: () =>
    Promise.resolve({
      getActiveProfile: () =>
        Promise.resolve(
          mockHomeProfiles.find((profile) => profile.id === mockActiveHomeProfileId) ?? null,
        ),
      listProfiles: () => Promise.resolve(mockHomeProfiles),
      selectActiveProfile: mockSelectActiveProfile,
    }),
}));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { replace: jest.fn(), push: jest.fn() },
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(() => callback(), [callback]),
  };
});

describe('Child Home route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveHomeProfileId = 'profile-1';
    mockGetProgress.mockResolvedValue(defaultProgress);
    mockListInventory.mockResolvedValue([]);
  });

  it('reloads child-specific Home data after selecting another profile', async () => {
    mockGetProgress.mockImplementation((profileId?: string) =>
      Promise.resolve(
        profileId === 'profile-2'
          ? {
              ...defaultProgress,
              childProfileId: 'profile-2',
              currentStreak: 4,
              totalXp: 90,
              mood: 88,
            }
          : defaultProgress,
      ),
    );
    const view = await render(<ChildHomeScreen />);
    await view.findByText('Merhaba, Ege! 👋');

    await fireEvent.press(view.getByTestId('profile-switcher-trigger'));
    await fireEvent.press(await view.findByRole('radio', { name: 'Ada' }));

    await waitFor(() => expect(mockSelectActiveProfile).toHaveBeenCalledWith('profile-2'));
    await waitFor(() => expect(view.getByText('Merhaba, Ada! 👋')).toBeTruthy());
    expect(mockGetProgress).toHaveBeenLastCalledWith('profile-2');
    expect(view.getAllByTestId('character-kaan', { includeHiddenElements: true })).toHaveLength(2);
    expect(view.getByText('Bebek diş evresine 30 XP kaldı')).toBeTruthy();
  });

  it('shows the active profile character, brushing cards and primary action', async () => {
    const view = await render(<ChildHomeScreen />);
    await waitFor(() => expect(view.getByTestId('child-home-screen')).toBeTruthy());

    expect(view.getByText('Merhaba, Ege! 👋')).toBeTruthy();
    expect(view.getAllByTestId('character-inci', { includeHiddenElements: true })).toHaveLength(2);
    expect(
      view.getAllByTestId('character-phase-resting', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(view.getByText('Diş yumurtası')).toBeTruthy();
    expect(view.getByText('Çatlıyor evresine 60 XP kaldı')).toBeTruthy();
    expect(view.getByText('Yaklaşık 6 fırçalama')).toBeTruthy();
    expect(view.getByText('Sabah')).toBeTruthy();
    expect(view.getByText('Akşam')).toBeTruthy();
    const brushButton = view.getByRole('button', { name: 'Fırçalayalım!' });
    expect(StyleSheet.flatten(brushButton.props.style).minHeight).toBeGreaterThanOrEqual(
      minimumTouchTarget,
    );
    expect(view.queryByText('Profil seç')).toBeNull();
    const trigger = view.getByRole('button', {
      name: 'Aktif profil: Ege. Profil değiştirmek için dokun.',
    });
    expect(StyleSheet.flatten(trigger.props.style).minHeight).toBeGreaterThanOrEqual(
      minimumTouchTarget,
    );
    await fireEvent.press(view.getByTestId('profile-switcher-trigger'));
    await waitFor(() => expect(view.getByTestId('profile-switcher-modal')).toBeTruthy());
    expect(view.getByText('Profili değiştir')).toBeTruthy();
    expect(view.getByRole('radio', { name: 'Ada' })).toBeTruthy();
  });

  it('opens the real brushing session route', async () => {
    const view = await render(<ChildHomeScreen />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Fırçalayalım!' })).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Fırçalayalım!' }));
    expect(router.push).toHaveBeenCalledWith('/brushing');
  });

  it('keeps room items fixed until the explicit edit mode is opened', async () => {
    const view = await render(<ChildHomeScreen />);
    const edit = await view.findByRole('button', { name: 'Odamı Düzenle' });
    await fireEvent.press(edit);
    expect(view.getByRole('button', { name: 'Düzenlemeyi Bitir' })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Düzenlemeyi Bitir' }));
    expect(view.getByRole('button', { name: 'Odamı Düzenle' })).toBeTruthy();
  });

  it('renders the selected background as the full character scene backdrop', async () => {
    mockListInventory.mockResolvedValue([
      {
        equipped: true,
        icon: '🌊',
        key: 'undersea-room',
        slot: 'background',
        unlocked: true,
        unlockedAt: '2026-08-21T00:00:00.000Z',
        unlockXp: 560,
      },
    ]);
    const view = await render(<ChildHomeScreen />);
    const background = await view.findByTestId('home-background-undersea-room');
    expect(StyleSheet.flatten(background.props.style)).toMatchObject({
      bottom: 0,
      height: '100%',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      width: '100%',
    });
  });

  it('opens morning and evening brushing from the full accessible task cards', async () => {
    const view = await render(<ChildHomeScreen />);
    const morning = await view.findByRole('button', { name: 'Sabah. Seni bekliyor' });
    const evening = view.getByRole('button', { name: 'Akşam. Seni bekliyor' });
    expect(StyleSheet.flatten(morning.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(StyleSheet.flatten(evening.props.style).minHeight).toBeGreaterThanOrEqual(48);
    await fireEvent.press(morning);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/brushing',
      params: { slot: 'morning' },
    });
    await fireEvent.press(evening);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/brushing',
      params: { slot: 'evening' },
    });
  });

  it('shows persisted daily completion with the simplified 4–6 presentation', async () => {
    mockGetProgress.mockResolvedValue({
      ...defaultProgress,
      morningCompleted: true,
      eveningCompleted: true,
      currentStreak: 3,
    });
    const view = await render(<ChildHomeScreen />);
    expect(await view.findByRole('button', { name: 'Sabah. Tamamlandı' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Akşam. Tamamlandı' })).toBeTruthy();
    expect(view.getAllByText('✓')).toHaveLength(2);
    expect(view.getByText('Çatlıyor evresine 60 XP kaldı')).toBeTruthy();
    expect(view.getByText('Yaklaşık 6 fırçalama')).toBeTruthy();
    expect(view.queryByText('Seri: 3 gün')).toBeNull();
  });
});
