import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { minimumTouchTarget } from '@/design-system';

import ParentSettingsScreen from '../settings';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

describe('Parent Settings navigation header', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps a full-size back target and returns to Parent Account', async () => {
    const view = await render(<ParentSettingsScreen />);
    const back = view.getByTestId('parent-settings-back-button');

    expect(StyleSheet.flatten(back.props.style).height).toBeGreaterThanOrEqual(minimumTouchTarget);
    expect(StyleSheet.flatten(back.props.style).width).toBeGreaterThanOrEqual(minimumTouchTarget);

    fireEvent.press(back);
    expect(router.replace).toHaveBeenCalledWith('/(parent)');
  });
});
