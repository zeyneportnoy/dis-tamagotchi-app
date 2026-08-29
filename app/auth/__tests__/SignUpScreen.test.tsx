import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import SignUpScreen from '../signup';

const mockSignUp = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/features/auth', () => {
  const { Acknowledgement } = jest.requireActual<typeof import('@/features/auth/Acknowledgement')>(
    '@/features/auth/Acknowledgement',
  );
  const { AuthScaffold } = jest.requireActual<typeof import('@/features/auth/AuthScaffold')>(
    '@/features/auth/AuthScaffold',
  );
  return {
    Acknowledgement,
    AuthScaffold,
    useAuth: () => ({ configured: true, useCases: { signUp: mockSignUp } }),
  };
});

describe('SignUpScreen legal acknowledgements', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps account creation disabled until both existing acknowledgements are selected', async () => {
    const view = await render(<SignUpScreen />);

    expect(view.getByRole('button', { name: 'Hesap Oluştur' })).toBeDisabled();
    await fireEvent.press(
      view.getByRole('checkbox', { name: 'Kullanım Koşulları’nı kabul ediyorum.' }),
    );
    expect(view.getByRole('button', { name: 'Hesap Oluştur' })).toBeDisabled();
    await fireEvent.press(
      view.getByRole('checkbox', {
        name: 'KVKK Aydınlatma Metni’ni okudum ve bilgilendirildim.',
      }),
    );
    expect(view.getByRole('button', { name: 'Hesap Oluştur' })).not.toBeDisabled();
  });

  it('opens both existing legal document routes from their links', async () => {
    const view = await render(<SignUpScreen />);

    await fireEvent.press(
      view.getByRole('link', { name: 'Kullanım Koşulları’nı kabul ediyorum.' }),
    );
    await fireEvent.press(
      view.getByRole('link', {
        name: 'KVKK Aydınlatma Metni’ni okudum ve bilgilendirildim.',
      }),
    );

    expect(router.push).toHaveBeenNthCalledWith(1, '/legal/terms');
    expect(router.push).toHaveBeenNthCalledWith(2, '/legal/privacy');
  });
});
