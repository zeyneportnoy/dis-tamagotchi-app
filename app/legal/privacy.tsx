import { useTranslation } from 'react-i18next';

import { LegalDocument } from '@/features/legal';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const keys = [
    'controller',
    'data',
    'purposes',
    'transfers',
    'collection',
    'retention',
    'rights',
    'contact',
  ] as const;
  return (
    <LegalDocument
      incomplete={t('legal.incomplete')}
      placeholder={t('legal.placeholder')}
      sections={keys.map((key) => t(`legal.privacySections.${key}`))}
      title={t('legal.privacyTitle')}
    />
  );
}
