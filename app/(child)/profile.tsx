import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import {
  Button,
  ErrorState,
  LoadingState,
  Screen,
  Text,
  colors,
  radii,
  spacing,
  typography,
} from '@/design-system';
import { CharacterAvatar } from '@/features/character';
import {
  isBrushingVoiceGuidanceEnabled,
  setBrushingVoiceGuidanceEnabled,
} from '@/features/brushing';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChildProfileViewModel | null>(null);
  const [failed, setFailed] = useState(false);
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabledState] = useState(true);

  useEffect(() => {
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then((active) => setProfile(active))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    void isBrushingVoiceGuidanceEnabled()
      .then(setVoiceGuidanceEnabledState)
      .catch(() => setVoiceGuidanceEnabledState(true));
  }, []);

  if (failed) return <ErrorState />;
  if (!profile) return <LoadingState />;

  return (
    <Screen style={styles.screen} testID="profile-screen">
      <Text style={styles.heading} variant="title">
        {t('placeholders.profileTitle')}
      </Text>
      <View style={styles.hero}>
        <Text style={styles.sparkleLeft}>✦</Text>
        <Text style={styles.sparkleRight}>★</Text>
        <CharacterAvatar characterKey={profile.avatarId} size="large" surface="plain" />
        <View style={styles.pedestal} />
      </View>
      <Text style={styles.nickname}>{profile.nickname}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.nickname')}</Text>
          <Text>{profile.nickname}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.ageBand')}</Text>
          <Text>
            {t(
              profile.ageBand === '7_11'
                ? 'onboarding.ageBand.sevenEleven'
                : 'onboarding.ageBand.fourSix',
            )}
          </Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('settings.title')}</Text>
        <View style={styles.row}>
          <View style={styles.settingCopy}>
            <Text style={styles.label}>{t('settings.brushingVoice')}</Text>
            <Text style={styles.settingBody}>{t('settings.brushingVoiceBody')}</Text>
          </View>
          <Switch
            accessibilityLabel={t('settings.brushingVoice')}
            onValueChange={(enabled) => {
              setVoiceGuidanceEnabledState(enabled);
              void setBrushingVoiceGuidanceEnabled(enabled).catch(() => {
                setVoiceGuidanceEnabledState(!enabled);
              });
            }}
            trackColor={{ false: '#D8D3CF', true: '#B9A5F7' }}
            value={voiceGuidanceEnabled}
          />
        </View>
      </View>
      <Button
        label={t('childHome.parentArea')}
        onPress={() => router.push('/parent-gate')}
        variant="secondary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
  heading: { textAlign: 'center' },
  hero: {
    alignItems: 'center',
    backgroundColor: '#BFEFEB',
    borderRadius: 34,
    height: 260,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  label: { flex: 1, fontWeight: '800' },
  nickname: { fontSize: 26, fontWeight: '900', lineHeight: 32 },
  pedestal: {
    backgroundColor: '#A16DCE',
    borderRadius: radii.pill,
    height: 24,
    marginTop: -28,
    width: 150,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  sectionTitle: { fontFamily: typography.family.display, fontSize: 20, fontWeight: '700' },
  settingBody: { color: colors.textPrimary, fontSize: 14, lineHeight: 19, opacity: 0.72 },
  settingCopy: { flex: 1, gap: spacing.xs },
  screen: { alignItems: 'center', gap: spacing.md },
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
    top: 60,
  },
});
