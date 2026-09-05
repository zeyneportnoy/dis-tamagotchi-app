import { router } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { getProfileSyncUseCases, syncAllChildPreferences } from '@/application/sync';
import { Button, Screen, SelectionCard, Text, colors, radii, spacing } from '@/design-system';
import {
  brushingVoiceCues,
  brushingVoiceProfiles,
  ensureVoicePreviewAudioMode,
  setBrushingVoiceProfile,
  type BrushingVoiceProfile,
} from '@/features/brushing';
import { CharacterAvatar } from '@/features/character';
import { useOnboardingDraft } from '@/features/onboarding/OnboardingDraftContext';
import { useAuth } from '@/features/auth';
import {
  dentistReminderService,
  dentistVisitService,
  reminderSettingsService,
  syncGroupedBrushingReminders,
} from '@/features/reminders';

export default function SummaryScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const { session } = useAuth();
  // Voice is per-child and the child does not exist until this screen creates
  // it. Selection is a local highlight only; the choice is persisted with the
  // new profile id when the user confirms via the bottom CTA below. Starts
  // unselected so "Onayla" stays disabled until the user picks a voice.
  const [voiceProfile, setVoiceProfile] = useState<BrushingVoiceProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const gokcePreview = useAudioPlayer(brushingVoiceCues.gokce[0].source);
  const sametPreview = useAudioPlayer(brushingVoiceCues.samet[0].source);

  const createProfile = async (selectedVoiceProfile: BrushingVoiceProfile) => {
    if (saving) return;
    if (!draft.nickname.trim()) return router.replace('/onboarding/nickname');
    if (!draft.dateOfBirth || !draft.ageBand) return router.replace('/onboarding/age-band');
    if (!draft.avatarId) return router.replace('/onboarding/character');
    if (!session?.userId) return setFailed(true);
    const parentUserId = session.userId;
    setSaving(true);
    setFailed(false);
    try {
      const useCases = await getFamilyUseCases();
      const profile = await useCases.createProfile({
        nickname: draft.nickname,
        dateOfBirth: draft.dateOfBirth,
        avatarId: draft.avatarId,
      });
      await setBrushingVoiceProfile(parentUserId, profile.id, selectedVoiceProfile);
      if (draft.remindersEnabled) {
        for (const slot of ['morning', 'evening'] as const) {
          await reminderSettingsService
            .update(parentUserId, profile.id, slot, {
              enabled: true,
              time: slot === 'morning' ? draft.morningReminderTime : draft.eveningReminderTime,
            })
            .catch(() => undefined);
        }
      }
      // Fold this child's brushing reminders into the device's grouped schedule
      // alongside any siblings that already have reminders at the same time.
      await useCases
        .listProfiles()
        .then((profiles) =>
          syncGroupedBrushingReminders(
            parentUserId,
            profiles.map((child) => ({ id: child.id, nickname: child.nickname })),
          ),
        )
        .catch(() => undefined);
      if (draft.dentistLastVisitDate) {
        // Parent entered a real last-visit date: schedule the single 6-month
        // routine reminder from it instead of the placeholder auto reminder.
        await dentistVisitService
          .setLastVisitDate(
            { id: profile.id, nickname: profile.nickname },
            draft.dentistLastVisitDate,
          )
          .catch(() => undefined);
      } else {
        await dentistReminderService.ensureScheduledForProfile(profile).catch(() => undefined);
      }
      draft.reset();
      router.replace('/(child)');
      void getProfileSyncUseCases()
        .then((sync) => {
          if (sync && session) return sync.claimLegacyProfiles(session.userId);
          return undefined;
        })
        .then(() => syncAllChildPreferences())
        .catch(() => {
          // Local profile creation is the offline-first success boundary. Sync retries later.
        });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  const playPreview = (profile: Exclude<BrushingVoiceProfile, 'off'>): void => {
    const activePlayer = profile === 'gokce' ? gokcePreview : sametPreview;
    const inactivePlayer = profile === 'gokce' ? sametPreview : gokcePreview;
    inactivePlayer.pause();
    // Must play as media even with the iOS silent switch on — see
    // ensureVoicePreviewAudioMode for why this can't rely on brushing.tsx's
    // own audio-mode activation (this screen is reached before any brushing
    // session has ever started).
    void ensureVoicePreviewAudioMode().then(() =>
      activePlayer.seekTo(0).then(() => activePlayer.play()),
    );
  };

  // Tapping a voice card only highlights it locally — no save, no navigation.
  // Persisting + advancing happens exclusively when the user taps "Onayla".
  const selectVoiceProfile = (profile: BrushingVoiceProfile): void => {
    if (saving) return;
    setVoiceProfile(profile);
  };

  return (
    <Screen style={styles.screen} testID="profile-summary-screen">
      <ScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        style={styles.screenScroll}
        testID="voice-onboarding-scroll"
      >
        <View style={styles.hero}>
          <Text style={styles.sparkleLeft}>✦</Text>
          <Text style={styles.sparkleRight}>★</Text>
          {draft.avatarId ? (
            <CharacterAvatar characterKey={draft.avatarId} size="large" surface="plain" />
          ) : null}
          <View style={styles.pedestal} />
        </View>
        <Text style={styles.center} variant="title">
          {t('onboarding.voice.title')}
        </Text>
        <Text style={styles.center}>{t('onboarding.voice.body')}</Text>
        <View accessibilityRole="radiogroup" style={styles.card}>
          {brushingVoiceProfiles.map((profile) => (
            <View key={profile} style={styles.voiceOption}>
              <View style={styles.voiceSelectionCard}>
                <SelectionCard
                  label={t(`parent.settings.voiceGuide.options.${profile}.title`)}
                  onPress={() => selectVoiceProfile(profile)}
                  selected={voiceProfile === profile}
                  testID={`onboarding-voice-${profile}`}
                />
              </View>
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
                  testID={`onboarding-voice-preview-${profile}`}
                >
                  <View style={styles.previewIcon} />
                  <Text style={styles.previewLabel}>
                    {t('parent.settings.voiceGuide.listen')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
        {failed ? <Text>{t('onboarding.voice.error')}</Text> : null}
        <Button
          disabled={saving || voiceProfile === null}
          label={saving ? t('common.saving') : t('onboarding.voice.confirm')}
          onPress={() => {
            if (voiceProfile) void createProfile(voiceProfile);
          }}
          testID="create-profile-button"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  center: { textAlign: 'center' },
  hero: {
    alignItems: 'center',
    backgroundColor: '#F9D7E5',
    borderRadius: 32,
    height: 300,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pedestal: {
    backgroundColor: '#D17AC0',
    borderRadius: radii.pill,
    height: 24,
    marginTop: -28,
    width: 150,
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
  screen: { justifyContent: 'flex-start' },
  screenContent: {
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  screenScroll: { flex: 1 },
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
  voiceOption: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  voiceSelectionCard: { flex: 1 },
});
