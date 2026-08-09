import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { getProfileSyncUseCases } from '@/application/sync';
import { Button, Screen, Text, colors, radii, spacing } from '@/design-system';
import { CharacterAvatar } from '@/features/character';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';
import { useAuth } from '@/features/auth';

export default function SummaryScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const { session } = useAuth();
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
      const sync = await getProfileSyncUseCases();
      if (sync && session) await sync.claimLegacyProfiles(session.userId);
      draft.reset();
      router.replace('/(child)');
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.sparkleLeft}>✦</Text>
        <Text style={styles.sparkleRight}>★</Text>
        {draft.avatarId ? (
          <CharacterAvatar characterKey={draft.avatarId} size="large" surface="plain" />
        ) : null}
        <View style={styles.pedestal} />
      </View>
      <Text style={styles.center} variant="title">
        {t('onboarding.summary.title')}
      </Text>
      <View style={styles.card}>
        <Text style={styles.nickname}>
          {t('onboarding.summary.nickname', { nickname: draft.nickname })}
        </Text>
        <View style={styles.chip}>
          <Text>
            {t(`onboarding.ageBand.${draft.ageBand === '7_11' ? 'sevenEleven' : 'fourSix'}`)}
          </Text>
        </View>
        <Text style={styles.center}>
          {draft.avatarId ? t(`onboarding.character.options.${draft.avatarId}`) : ''}
        </Text>
      </View>
      {failed ? <Text>{t('onboarding.summary.error')}</Text> : null}
      <Button
        disabled={saving || !draft.nickname || !draft.ageBand || !draft.avatarId}
        label={saving ? t('common.saving') : t('onboarding.summary.create')}
        onPress={() => void createProfile()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  center: { textAlign: 'center' },
  chip: {
    backgroundColor: '#DDF8F3',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: '#F9D7E5',
    borderRadius: 32,
    height: 260,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nickname: { fontSize: 22, fontWeight: '900', lineHeight: 28 },
  pedestal: {
    backgroundColor: '#D17AC0',
    borderRadius: radii.pill,
    height: 24,
    marginTop: -28,
    width: 150,
  },
  screen: { justifyContent: 'space-between' },
  sparkleLeft: {
    color: colors.brandHighlight,
    fontSize: 28,
    left: spacing.lg,
    position: 'absolute',
    top: spacing.lg,
  },
  sparkleRight: {
    color: colors.brandSecondary,
    fontSize: 28,
    position: 'absolute',
    right: spacing.lg,
    top: 58,
  },
});
