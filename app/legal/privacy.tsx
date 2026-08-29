import { useTranslation } from 'react-i18next';

import { LegalDocument, type LegalDocumentSection } from '@/features/legal';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const sections: readonly LegalDocumentSection[] = [
    { paragraphs: [t('legal.privacyDocument.intro')] },
    {
      heading: t('legal.privacyDocument.controllerTitle'),
      paragraphs: [t('legal.privacyDocument.controllerBody')],
    },
    {
      heading: t('legal.privacyDocument.dataTitle'),
      paragraphs: [
        t('legal.privacyDocument.dataIntro'),
        t('legal.privacyDocument.dataParent'),
        t('legal.privacyDocument.dataChild'),
        t('legal.privacyDocument.dataCharacter'),
        t('legal.privacyDocument.dataBrushing'),
        t('legal.privacyDocument.dataProgress'),
        t('legal.privacyDocument.dataCustomization'),
        t('legal.privacyDocument.dataVoice'),
        t('legal.privacyDocument.dataDentist'),
        t('legal.privacyDocument.dataTechnical'),
        t('legal.privacyDocument.dataOutro'),
      ],
    },
    {
      heading: t('legal.privacyDocument.purposesTitle'),
      paragraphs: [
        t('legal.privacyDocument.purposesIntro'),
        t('legal.privacyDocument.purposeAccount'),
        t('legal.privacyDocument.purposeSecurity'),
        t('legal.privacyDocument.purposeExperience'),
        t('legal.privacyDocument.purposeBrushing'),
        t('legal.privacyDocument.purposeRewards'),
        t('legal.privacyDocument.purposePreferences'),
        t('legal.privacyDocument.purposeSync'),
        t('legal.privacyDocument.purposeReminders'),
        t('legal.privacyDocument.purposeTechnical'),
        t('legal.privacyDocument.purposeFunctionality'),
        t('legal.privacyDocument.purposeLegal'),
        t('legal.privacyDocument.purposesOutro'),
      ],
    },
    {
      heading: t('legal.privacyDocument.legalReasonsTitle'),
      paragraphs: [
        t('legal.privacyDocument.legalReasonsBody'),
        t('legal.privacyDocument.legalReasonsConsent'),
      ],
    },
    {
      heading: t('legal.privacyDocument.childDataTitle'),
      paragraphs: [
        t('legal.privacyDocument.childDataAccount'),
        t('legal.privacyDocument.childDataProfiles'),
        t('legal.privacyDocument.childDataPurpose'),
      ],
    },
    {
      heading: t('legal.privacyDocument.transfersTitle'),
      paragraphs: [
        t('legal.privacyDocument.transfersIntro'),
        t('legal.privacyDocument.transferHosting'),
        t('legal.privacyDocument.transferAuth'),
        t('legal.privacyDocument.transferEmail'),
        t('legal.privacyDocument.transferSecurity'),
        t('legal.privacyDocument.transferAuthorities'),
        t('legal.privacyDocument.transfersOutro'),
        t('legal.privacyDocument.transfersAdvertising'),
        t('legal.privacyDocument.transfersAbroad'),
      ],
    },
    {
      heading: t('legal.privacyDocument.collectionTitle'),
      paragraphs: [
        t('legal.privacyDocument.collectionIntro'),
        t('legal.privacyDocument.collectionDirect'),
        t('legal.privacyDocument.collectionAccount'),
        t('legal.privacyDocument.collectionUsage'),
        t('legal.privacyDocument.collectionOutro'),
      ],
    },
    {
      heading: t('legal.privacyDocument.retentionTitle'),
      paragraphs: [
        t('legal.privacyDocument.retentionBody'),
        t('legal.privacyDocument.retentionDeletion'),
      ],
    },
    {
      heading: t('legal.privacyDocument.rightsTitle'),
      paragraphs: [
        t('legal.privacyDocument.rightsIntro'),
        t('legal.privacyDocument.rightProcessing'),
        t('legal.privacyDocument.rightInformation'),
        t('legal.privacyDocument.rightPurpose'),
        t('legal.privacyDocument.rightRecipients'),
        t('legal.privacyDocument.rightCorrection'),
        t('legal.privacyDocument.rightDeletion'),
        t('legal.privacyDocument.rightNotification'),
        t('legal.privacyDocument.rightOther'),
        t('legal.privacyDocument.rightsOutro'),
      ],
    },
    { paragraphs: [t('legal.privacyDocument.contact')] },
  ];

  return <LegalDocument documentSections={sections} title={t('legal.privacyTitle')} />;
}
