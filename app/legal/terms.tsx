import { useTranslation } from 'react-i18next';

import { LegalDocument, type LegalDocumentSection } from '@/features/legal';

export default function TermsScreen() {
  const { t } = useTranslation();
  const sections: readonly LegalDocumentSection[] = [
    { paragraphs: [t('legal.termsDocument.intro')] },
    {
      heading: t('legal.termsDocument.purposeTitle'),
      paragraphs: [
        t('legal.termsDocument.purposeP1'),
        t('legal.termsDocument.purposeP2'),
        t('legal.termsDocument.purposeP3'),
      ],
    },
    {
      heading: t('legal.termsDocument.guardianTitle'),
      paragraphs: [
        t('legal.termsDocument.guardianP1'),
        t('legal.termsDocument.guardianP2'),
        t('legal.termsDocument.guardianP3'),
      ],
    },
    {
      heading: t('legal.termsDocument.securityTitle'),
      paragraphs: [t('legal.termsDocument.securityP1'), t('legal.termsDocument.securityP2')],
    },
    {
      heading: t('legal.termsDocument.rewardsTitle'),
      paragraphs: [t('legal.termsDocument.rewardsP1'), t('legal.termsDocument.rewardsP2')],
    },
    {
      heading: t('legal.termsDocument.remindersTitle'),
      paragraphs: [
        t('legal.termsDocument.remindersP1'),
        t('legal.termsDocument.remindersP2'),
        t('legal.termsDocument.remindersP3'),
      ],
    },
    {
      heading: t('legal.termsDocument.usageTitle'),
      paragraphs: [
        t('legal.termsDocument.usageP1'),
        t('legal.termsDocument.usageP2'),
        t('legal.termsDocument.usageBullet1'),
        t('legal.termsDocument.usageBullet2'),
        t('legal.termsDocument.usageBullet3'),
        t('legal.termsDocument.usageBullet4'),
        t('legal.termsDocument.usageP3'),
      ],
    },
    {
      heading: t('legal.termsDocument.ipTitle'),
      paragraphs: [t('legal.termsDocument.ipP1'), t('legal.termsDocument.ipP2')],
    },
    {
      heading: t('legal.termsDocument.dataTitle'),
      paragraphs: [t('legal.termsDocument.dataP1'), t('legal.termsDocument.dataP2')],
    },
    {
      heading: t('legal.termsDocument.deletionTitle'),
      paragraphs: [t('legal.termsDocument.deletionP1'), t('legal.termsDocument.deletionP2')],
    },
    {
      heading: t('legal.termsDocument.changesTitle'),
      paragraphs: [t('legal.termsDocument.changesP1'), t('legal.termsDocument.changesP2')],
    },
    {
      heading: t('legal.termsDocument.availabilityTitle'),
      paragraphs: [
        t('legal.termsDocument.availabilityP1'),
        t('legal.termsDocument.availabilityP2'),
      ],
    },
    {
      heading: t('legal.termsDocument.liabilityTitle'),
      paragraphs: [
        t('legal.termsDocument.liabilityP1'),
        t('legal.termsDocument.liabilityP2'),
        t('legal.termsDocument.liabilityP3'),
      ],
    },
    {
      heading: t('legal.termsDocument.lawTitle'),
      paragraphs: [t('legal.termsDocument.lawP1'), t('legal.termsDocument.lawP2')],
    },
  ];

  return <LegalDocument documentSections={sections} title={t('legal.termsTitle')} />;
}
