import { render } from '@testing-library/react-native';

import PrivacyScreen from '../privacy';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual<typeof import('react-native-safe-area-context')>(
    'react-native-safe-area-context',
  );
  return {
    ...actual,
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 44 }),
  };
});

describe('PrivacyScreen', () => {
  it('renders the complete supplied KVKK disclosure as a scrollable document', async () => {
    const view = await render(<PrivacyScreen />);

    expect(
      view.getByText('Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni'),
    ).toBeTruthy();
    expect(view.getByTestId('legal-document-scroll')).toBeTruthy();
    expect(view.getByText('VERİ SORUMLUSU')).toBeTruthy();
    expect(view.getByText('İŞLENEN KİŞİSEL VERİLER')).toBeTruthy();
    expect(view.getByText('KVKK KAPSAMINDA HAKLARINIZ')).toBeTruthy();
    expect(view.getAllByText(/Zeynep Öztürkmen/)).toHaveLength(1);
    expect(
      view.getByText(
        'KVKK kapsamındaki talepler DentHero’nun kullanıcı iletişim kanalları üzerinden veri sorumlusuna iletilebilir.',
      ),
    ).toBeTruthy();
    expect(view.queryByText('[YAYIN ÖNCESİ TAMAMLANACAK]')).toBeNull();
  });
});
