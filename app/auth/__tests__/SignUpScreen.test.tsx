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

  it('keeps account creation disabled until every required acknowledgement is selected', async () => {
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
    expect(view.getByRole('button', { name: 'Hesap Oluştur' })).toBeDisabled();
    await fireEvent.press(
      view.getByRole('checkbox', {
        name: 'Çocuğun ebeveyni veya yasal velisi olduğumu onaylıyorum.',
      }),
    );
    expect(view.getByRole('button', { name: 'Hesap Oluştur' })).not.toBeDisabled();
  });

  it('makes only the document name in each acknowledgement a link, not the whole sentence', async () => {
    const view = await render(<SignUpScreen />);

    await fireEvent.press(view.getByRole('link', { name: 'Kullanım Koşulları' }));
    await fireEvent.press(view.getByRole('link', { name: 'KVKK Aydınlatma Metni' }));

    expect(router.push).toHaveBeenNthCalledWith(1, '/legal/terms');
    expect(router.push).toHaveBeenNthCalledWith(2, '/legal/privacy');
    // The rest of each sentence is plain text, not a link.
    expect(view.queryByRole('link', { name: 'Kullanım Koşulları’nı kabul ediyorum.' })).toBeNull();
    expect(
      view.queryByRole('link', { name: 'KVKK Aydınlatma Metni’ni okudum ve bilgilendirildim.' }),
    ).toBeNull();
    expect(
      view.queryByRole('link', {
        name: 'Çocuğun ebeveyni veya yasal velisi olduğumu onaylıyorum.',
      }),
    ).toBeNull();
  });

  it('no longer renders the long guardian consent heading or explanatory paragraphs', async () => {
    const view = await render(<SignUpScreen />);

    expect(view.queryByText('Ebeveyn / Yasal Veli Onayı')).toBeNull();
    expect(
      view.queryByText(
        'DentHero’da oluşturacağım çocuk profilinin ebeveyni veya yasal velisi olduğumu onaylıyorum.',
      ),
    ).toBeNull();
    expect(
      view.queryByText(
        'Çocuğa ait takma ad, doğum tarihi, yaş grubu, diş fırçalama kayıtları, ilerleme bilgileri ve uygulama tercihlerinin DentHero hizmetinin sunulması amacıyla işleneceği konusunda bilgilendirildiğimi kabul ediyorum.',
      ),
    ).toBeNull();
    expect(view.getAllByRole('checkbox')).toHaveLength(3);
  });
});
