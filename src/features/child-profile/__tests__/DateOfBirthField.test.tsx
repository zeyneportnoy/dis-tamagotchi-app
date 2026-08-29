import { fireEvent, render } from '@testing-library/react-native';

import { DateOfBirthField } from '../DateOfBirthField';

jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: object) => React.createElement(View, props),
  };
});

describe('DateOfBirthField', () => {
  it('uses the native date picker instead of a text input and prevents future dates', async () => {
    const onChange = jest.fn();
    const view = await render(
      <DateOfBirthField
        cancelLabel="Vazgeç"
        confirmLabel="Bitti"
        dateOfBirth={null}
        label="Doğum tarihi"
        onChange={onChange}
        placeholder="Tarih seç"
        testID="dob"
      />,
    );

    expect(view.queryByRole('textbox')).toBeNull();
    await fireEvent.press(view.getByTestId('dob'));

    const picker = view.getByTestId('dob-picker');
    expect(picker.props.maximumDate.getTime()).toBeLessThanOrEqual(Date.now());
    await fireEvent(picker, 'change', { type: 'set' }, new Date(2019, 7, 29, 12));
    await fireEvent.press(view.getByRole('button', { name: 'Bitti' }));

    expect(onChange).toHaveBeenCalledWith('2019-08-29');
  });
});
