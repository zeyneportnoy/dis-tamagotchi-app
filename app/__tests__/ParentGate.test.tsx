import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Keyboard, StyleSheet } from 'react-native';

import ParentGateScreen from '../parent-gate';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 47 }),
  };
});
jest.mock('@/features/parent-gate/challenge', () => ({
  createParentChallenge: () => ({ left: 8, right: 9, answer: 17 }),
}));

describe('parent gate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps a wrong answer in the gate and advances as soon as the answer is correct', async () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    const view = await render(<ParentGateScreen />);
    const input = view.getByLabelText('Toplama sorusunun cevabı');
    await fireEvent.changeText(input, '16');
    await fireEvent.press(view.getByRole('button', { name: 'Kontrol et' }));
    expect(view.getByText('Bir kez daha sakince deneyebiliriz.')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.changeText(input, '17');

    expect(dismissKeyboard).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(parent)');
  });

  it('keeps the back control below the safe area and content scrollable with the keyboard', async () => {
    const view = await render(<ParentGateScreen />);
    const back = view.getByTestId('parent-gate-back-safe-area');
    const scroll = view.getByTestId('parent-gate-scroll');

    expect(StyleSheet.flatten(back.props.style).top).toBe(55);
    expect(scroll.props.keyboardDismissMode).toBe('interactive');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('provides an accessible back control on the detail screen', async () => {
    const view = await render(<ParentGateScreen />);
    await fireEvent.press(view.getByRole('button', { name: 'Geri' }));
    expect(router.back).toHaveBeenCalled();
  });
});
