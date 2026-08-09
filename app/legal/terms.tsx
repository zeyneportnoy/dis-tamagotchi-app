import { useTranslation } from 'react-i18next';

import { LegalDocument } from '@/features/legal';

export default function TermsScreen() {
  const { t } = useTranslation();
  const keys = [
    'scope',
    'parent',
    'children',
    'rules',
    'health',
    'ip',
    'deletion',
    'liability',
    'changes',
    'contact',
  ] as const;
  return (
    <LegalDocument
      incomplete={t('legal.incomplete')}
      placeholder={t('legal.placeholder')}
      sections={keys.map((key) => t(`legal.termsSections.${key}`))}
      title={t('legal.termsTitle')}
    />
  );
}
