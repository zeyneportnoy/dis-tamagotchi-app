import { router } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import { syncAllChildPreferences } from '@/application/sync';
import { Button, Screen, ScreenHeader, Text, colors, radii, spacing } from '@/design-system';
import { ageBandFromDateOfBirth } from '@/domain/family';
import { useAuth } from '@/features/auth';
import {
  brushingVoiceCues,
  getBrushingVoiceProfile,
  setBrushingVoiceProfile,
  type BrushingVoiceProfile,
} from '@/features/brushing';
import { DateOfBirthField } from '@/features/child-profile';
import { isMoodLabAvailable } from '@/features/mood-lab/availability';

const voiceProfiles: BrushingVoiceProfile[] = ['gokce', 'samet', 'off'];

export default function ParentSettingsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [voiceProfile, setVoiceProfile] = useState<BrushingVoiceProfile | null>(null);
  const [childProfile, setChildProfile] = useState<ChildProfileViewModel | null>(null);
  const [dateError, setDateError] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const gokcePreview = useAudioPlayer(brushingVoiceCues.gokce[0].source);
  const sametPreview = useAudioPlayer(brushingVoiceCues.samet[0].source);

  useEffect(() => {
    const userId = session?.userId;
    if (!userId) return;
    void getFamilyUseCases()
      .then((useCases) => useCases.getActiveProfile())
      .then(async (activeProfile) => {
        setChildProfile(activeProfile);
        if (activeProfile) setVoiceProfile(await getBrushingVoiceProfile(userId, activeProfile.id));
      })
      .catch(() => setDateError(true));
  }, [session?.userId]);

  const updateDateOfBirth = async (dateOfBirth: string): Promise<void> => {
    if (!childProfile || savingDate) return;
    const ageBand = ageBandFromDateOfBirth(dateOfBirth);
    if (!ageBand) {
      setDateError(true);
      return;
    }
    const previous = childProfile;
    setDateError(false);
    setSavingDate(true);
    setChildProfile({ ...childProfile, dateOfBirth, ageBand });
    try {
      const useCases = await getFamilyUseCases();
      setChildProfile(await useCases.updateProfile(childProfile.id, { dateOfBirth }));
    } catch {
      setChildProfile(previous);
      setDateError(true);
    } finally {
      setSavingDate(false);
    }
  };

  const selectVoiceProfile = (nextProfile: BrushingVoiceProfile): void => {
    if (!session?.userId || !childProfile || voiceProfile === null) return;
    const previousProfile = voiceProfile;
    setVoiceProfile(nextProfile);
    void setBrushingVoiceProfile(session.userId, childProfile.id, nextProfile)
      .then(() => syncAllChildPreferences())
      .catch(() => {
        setVoiceProfile(previousProfile);
      });
  };

  const playPreview = (profile: Exclude<BrushingVoiceProfile, 'off'>): void => {
    const activePlayer = profile === 'gokce' ? gokcePreview : sametPreview;
    const inactivePlayer = profile === 'gokce' ? sametPreview : gokcePreview;
    inactivePlayer.pause();
    void activePlayer.seekTo(0).then(() => activePlayer.play());
  };

  return (
    <Screen style={styles.screen} testID="parent-settings-screen">
      <ScreenHeader
        backTestID="parent-settings-back-button"
        fallbackHref="/(parent)"
        onBackPress={() => router.replace('/(parent)')}
        title={t('parent.settings.title')}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {childProfile ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('parent.settings.childProfile.title')}</Text>
            <Text style={styles.sectionBody}>
              {t('parent.settings.childProfile.body', { name: childProfile.nickname })}
            </Text>
            <DateOfBirthField
              cancelLabel={t('common.cancel')}
              confirmLabel={t('common.done')}
              dateOfBirth={childProfile.dateOfBirth}
              label={t('parent.settings.childProfile.dateOfBirth')}
              onChange={(dateOfBirth) => void updateDateOfBirth(dateOfBirth)}
              placeholder={t('onboarding.dateOfBirth.placeholder')}
              testID="parent-date-of-birth"
            />
            {savingDate ? <Text>{t('common.saving')}</Text> : null}
            {dateError ? (
              <Text style={styles.error}>{t('parent.settings.childProfile.error')}</Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.section}>
          <Button
            label={t('parent.reminders.title')}
            onPress={() => router.push('/(parent)/reminders')}
            variant="secondary"
          />
        </View>
        <View style={styles.section}>
          <Button
            label={t('parent.dentistVisits.settingsItem')}
            onPress={() => router.push('/(parent)/dentist-visits')}
            testID="open-dentist-visits"
            variant="secondary"
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('parent.settings.voiceGuide.title')}</Text>
          <Text style={styles.sectionBody}>{t('parent.settings.voiceGuide.body')}</Text>
          <View accessibilityRole="radiogroup" style={styles.voiceOptions}>
            {voiceProfiles.map((profile) => {
              const selected = voiceProfile === profile;
              return (
                <View
                  key={profile}
                  style={[styles.voiceOption, selected && styles.voiceOptionSelected]}
                >
                  <Pressable
                    accessibilityLabel={t(`parent.settings.voiceGuide.options.${profile}.title`)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: voiceProfile === null }}
                    disabled={voiceProfile === null}
                    onPress={() => selectVoiceProfile(profile)}
                    style={({ pressed }) => [
                      styles.voiceSelection,
                      pressed && styles.voiceOptionPressed,
                    ]}
                    testID={`voice-profile-${profile}`}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={[styles.voiceTitle, selected && styles.voiceTitleSelected]}>
                      {t(`parent.settings.voiceGuide.options.${profile}.title`)}
                    </Text>
                  </Pressable>
                  {profile !== 'off' ? (
                    <Pressable
                      accessibilityLabel={t('parent.settings.voiceGuide.listenTo', {
                        name: t(`parent.settings.voiceGuide.options.${profile}.title`),
                      })}
                      accessibilityRole="button"
                      onPress={() => playPreview(profile)}
                      style={({ pressed }) => [
                        styles.previewButton,
                        pressed && styles.previewButtonPressed,
                      ]}
                    >
                      <View style={styles.previewIcon} />
                      <Text style={styles.previewLabel}>
                        {t('parent.settings.voiceGuide.listen')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
        {isMoodLabAvailable(__DEV__) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('parent.settings.developerTools')}</Text>
            <Button
              label={t('parent.moodLab.open')}
              onPress={() => router.push('/(parent)/mood-lab')}
              variant="secondary"
            />
          </View>
        ) : null}
        <Text style={styles.trustStatement}>{t('parent.settings.trustStatement')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  error: { color: colors.brandSecondary },
  screen: { justifyContent: 'flex-start' },
  section: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: { color: colors.brandPrimary, fontSize: 19, fontWeight: '900' },
  sectionBody: { color: colors.textPrimary, lineHeight: 20, opacity: 0.72 },
  trustStatement: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.58,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  previewButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#D8CCF5',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  previewButtonPressed: { opacity: 0.68 },
  previewIcon: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 6,
    borderLeftColor: colors.brandPrimary,
    borderLeftWidth: 9,
    borderTopColor: 'transparent',
    borderTopWidth: 6,
    height: 0,
    width: 0,
  },
  previewLabel: { color: colors.brandPrimary, fontSize: 14, fontWeight: '800' },
  voiceOption: {
    alignItems: 'center',
    backgroundColor: '#FFF9FC',
    borderColor: '#E8E0F5',
    borderRadius: radii.lg,
    borderWidth: 2,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  voiceOptionPressed: { opacity: 0.78 },
  voiceOptionSelected: { backgroundColor: '#F3ECFF', borderColor: colors.brandPrimary },
  voiceOptions: { gap: spacing.sm },
  voiceSelection: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
  },
  voiceTitle: { fontSize: 17, fontWeight: '800' },
  voiceTitleSelected: { color: colors.brandPrimary },
  radio: {
    alignItems: 'center',
    borderColor: '#BDB4C9',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  radioDot: { backgroundColor: colors.brandPrimary, borderRadius: 6, height: 12, width: 12 },
  radioSelected: { borderColor: colors.brandPrimary },
});
