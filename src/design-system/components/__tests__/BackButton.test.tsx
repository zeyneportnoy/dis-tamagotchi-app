import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { minimumTouchTarget } from '../../theme';
import { BackButton } from '../BackButton';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
}));

describe('BackButton', () => {
  it('has a Turkish label, 48 dp target and custom navigation action', async () => {
    const onPress = jest.fn();
    const view = await render(<BackButton onPress={onPress} />);
    const button = view.getByRole('button', { name: 'Geri' });
    const style = StyleSheet.flatten(button.props.style);
    expect(style.height).toBeGreaterThanOrEqual(minimumTouchTarget);
    expect(style.width).toBeGreaterThanOrEqual(minimumTouchTarget);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses back when possible and a safe fallback for a direct route', async () => {
    const view = await render(<BackButton fallbackHref="/onboarding" />);
    await fireEvent.press(view.getByRole('button', { name: 'Geri' }));
    expect(router.back).toHaveBeenCalledTimes(1);

    jest.mocked(router.canGoBack).mockReturnValueOnce(false);
    await fireEvent.press(view.getByRole('button', { name: 'Geri' }));
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
  });
});
