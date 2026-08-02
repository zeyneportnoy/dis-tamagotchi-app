import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Button, Screen, Text } from '@/design-system';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';

export default function SummaryScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const createProfile = async () => {
    if (!draft.ageBand || !draft.avatarId || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const useCases = await getFamilyUseCases();
      await useCases.createProfile({
        nickname: draft.nickname,
        ageBand: draft.ageBand,
        avatarId: draft.avatarId,
      });
      draft.reset();
      router.replace('/(child)');
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text variant="title">{t('onboarding.summary.title')}</Text>
      <Text>{t('onboarding.summary.nickname', { nickname: draft.nickname })}</Text>
      <Text>{t(`onboarding.ageBand.${draft.ageBand === '9_10' ? 'nineTen' : 'sixEight'}`)}</Text>
      <Text>{draft.avatarId ? t(`onboarding.character.options.${draft.avatarId}`) : ''}</Text>
      {failed ? <Text>{t('onboarding.summary.error')}</Text> : null}
      <Button
        disabled={saving || !draft.nickname || !draft.ageBand || !draft.avatarId}
        label={saving ? t('common.saving') : t('onboarding.summary.create')}
        onPress={() => void createProfile()}
      />
    </Screen>
  );
}
