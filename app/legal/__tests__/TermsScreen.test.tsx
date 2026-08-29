import { render } from '@testing-library/react-native';

import TermsScreen from '../terms';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual<typeof import('react-native-safe-area-context')>(
    'react-native-safe-area-context',
  );
  return {
    ...actual,
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 44 }),
  };
});

describe('TermsScreen', () => {
  it('renders the complete supplied DentHero terms as a scrollable document', async () => {
    const view = await render(<TermsScreen />);

    expect(view.getByText('DentHero Kullanım Koşulları')).toBeTruthy();
    expect(view.getByTestId('legal-document-scroll')).toBeTruthy();
    expect(view.getByText('1. DentHero’nun Amacı')).toBeTruthy();
    expect(view.getByText('6. Uygulamanın Kullanımı')).toBeTruthy();
    expect(view.getByText('13. Uygulanacak Hukuk')).toBeTruthy();
    expect(
      view.getByText(
        'Bu Kullanım Koşulları, DentHero mobil uygulamasının kullanımına ilişkin kuralları düzenler. Uygulamayı kullanarak bu koşulları kabul etmiş olursunuz.',
      ),
    ).toBeTruthy();
    expect(
      view.getByText(
        'Kullanıcının tüketici mevzuatı ve diğer emredici hukuk kurallarından kaynaklanan hakları saklıdır.',
      ),
    ).toBeTruthy();
    expect(view.queryByText('[YAYIN ÖNCESİ TAMAMLANACAK]')).toBeNull();
    expect(view.queryByText(/hukuk danışmanı tarafından nihai hale getirilecektir/)).toBeNull();
    expect(view.queryByText(/Zeynep Öztürkmen/)).toBeNull();
  });
});
