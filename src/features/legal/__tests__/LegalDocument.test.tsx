import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { spacing } from '@/design-system';

import { LegalDocument } from '../LegalDocument';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual<typeof import('react-native-safe-area-context')>(
    'react-native-safe-area-context',
  );
  return {
    ...actual,
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 44 }),
  };
});

describe('LegalDocument', () => {
  it('keeps the back button below the safe area and all legal sections scrollable', async () => {
    const view = await render(
      <LegalDocument
        incomplete="Eksik"
        placeholder="Uyarı"
        sections={['Bölüm 1', 'Bölüm 2']}
        title="KVKK"
      />,
    );

    expect(StyleSheet.flatten(view.getByTestId('legal-back-safe-area').props.style).top).toBe(
      44 + spacing.sm,
    );
    expect(view.getByTestId('legal-document-scroll')).toBeTruthy();
    expect(view.getByText('Bölüm 1')).toBeTruthy();
    expect(view.getByText('Bölüm 2')).toBeTruthy();
  });
});
