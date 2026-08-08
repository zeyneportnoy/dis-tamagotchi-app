import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import WelcomeScreen from '../index';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('Welcome route', () => {
  it('renders Turkish content from i18n', async () => {
    const view = await render(<WelcomeScreen />);
    expect(view.getByTestId('welcome-screen')).toBeTruthy();
    expect(view.getByText('Diş arkadaşınla tanış!')).toBeTruthy();
  });

  it('continues to the accountless explanation', async () => {
    const view = await render(<WelcomeScreen />);
    fireEvent.press(view.getByRole('button', { name: 'Başlayalım' }));
    expect(router.push).toHaveBeenCalledWith('/onboarding/accountless');
  });
});
