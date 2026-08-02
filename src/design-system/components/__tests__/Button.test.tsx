import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('has an accessible label and handles presses', async () => {
    const onPress = jest.fn();
    const view = await render(<Button label="Devam et" onPress={onPress} />);
    await fireEvent.press(view.getByRole('button', { name: 'Devam et' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
