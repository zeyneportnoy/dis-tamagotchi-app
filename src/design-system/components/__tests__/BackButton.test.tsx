import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { minimumTouchTarget } from '../../theme';
import { BackButton } from '../BackButton';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

describe('BackButton', () => {
  it('has a Turkish label, 48 dp target and custom navigation action', async () => {
    const onPress = jest.fn();
    const view = await render(<BackButton onPress={onPress} />);
    const button = view.getByRole('button', { name: 'Geri' });
    const style = StyleSheet.flatten(button.props.style);
    expect(style.height).toBeGreaterThanOrEqual(minimumTouchTarget);
    expect(style.width).toBeGreaterThanOrEqual(minimumTouchTarget);
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
