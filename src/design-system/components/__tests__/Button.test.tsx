import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Button } from '../Button';
import { minimumTouchTarget } from '../../theme';

describe('Button', () => {
  it('has an accessible label and handles presses', async () => {
    const onPress = jest.fn();
    const view = await render(<Button label="Devam et" onPress={onPress} />);
    await fireEvent.press(view.getByRole('button', { name: 'Devam et' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('meets the minimum touch target', async () => {
    const view = await render(<Button label="Devam et" onPress={jest.fn()} />);
    const style = StyleSheet.flatten(view.getByRole('button').props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(minimumTouchTarget);
  });
});
