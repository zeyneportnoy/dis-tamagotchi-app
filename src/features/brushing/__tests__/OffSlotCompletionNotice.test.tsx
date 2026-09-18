import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  OffSlotCompletionNotice,
  shouldShowOffSlotCompletionNotice,
} from '../OffSlotCompletionNotice';

const localTime = (hour: number): string => new Date(2026, 8, 18, hour).toISOString();

describe('off-slot brushing completion notice', () => {
  it('shows for a completed 14:00 brushing, whose existing slot classification earns no points', () => {
    expect(shouldShowOffSlotCompletionNotice(true, localTime(14))).toBe(true);
  });

  it.each([10, 20])('stays hidden for a completed %s:00 reward-slot brushing', (hour) => {
    expect(shouldShowOffSlotCompletionNotice(true, localTime(hour))).toBe(false);
  });

  it('stays hidden for an incomplete brushing', () => {
    expect(shouldShowOffSlotCompletionNotice(false, localTime(14))).toBe(false);
  });

  it('renders automatically above the page without requiring its scroll position', async () => {
    const view = await render(<OffSlotCompletionNotice onDismiss={jest.fn()} visible />);

    expect(view.getByTestId('brushing-off-slot-popup')).toBeTruthy();
    expect(view.getByText('Harika fırçaladın! 🦷')).toBeTruthy();
    expect(
      view.getByText('Bu fırçalama puan saatlerinin dışında olduğu için bu kez puan eklenmedi.'),
    ).toBeTruthy();
    expect(view.getByText('20 puan kazanabileceğin saatler:')).toBeTruthy();
    expect(view.getByText('04.00–11.59')).toBeTruthy();
    expect(view.getByText('18.00–23.59')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Tamam' })).toBeTruthy();
  });

  it('dismisses only when the confirm button is pressed', async () => {
    const onDismiss = jest.fn();
    const view = await render(<OffSlotCompletionNotice onDismiss={onDismiss} visible />);

    await fireEvent.press(view.getByRole('button', { name: 'Tamam' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not leave a second card in page content after dismissal', async () => {
    const view = await render(<OffSlotCompletionNotice onDismiss={jest.fn()} visible={false} />);

    expect(view.queryByTestId('brushing-off-slot-popup')).toBeNull();
    expect(view.queryByTestId('brushing-off-slot-notice')).toBeNull();
  });

  it('keeps the copy scrollable and the confirm button visible on a small iPhone', async () => {
    const view = await render(<OffSlotCompletionNotice onDismiss={jest.fn()} visible />);

    expect(
      StyleSheet.flatten(view.getByTestId('brushing-off-slot-notice').props.style),
    ).toMatchObject({
      maxHeight: '90%',
      width: '100%',
    });
    expect(view.getByTestId('brushing-off-slot-confirm')).toBeTruthy();
  });
});
