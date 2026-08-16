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

  it('offers parent signup without a guest action', async () => {
    const view = await render(<WelcomeScreen />);
    await fireEvent.press(view.getByRole('button', { name: 'Hesap Oluştur' }));
    expect(router.push).toHaveBeenCalledWith('/auth/signup');
    expect(view.queryByText(/hesapsız/i)).toBeNull();
  });
});
