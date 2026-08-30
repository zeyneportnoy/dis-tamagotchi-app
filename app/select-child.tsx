import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import {
  ErrorState,
  LoadingState,
  Screen,
  Text,
  colors,
  radii,
  spacing,
} from '@/design-system';
import { isLegacyAgeBand } from '@/domain/family';

/**
 * Post-login child picker. `app/index.tsx` only routes here when the signed-in
 * family has 2+ child profiles; with a single child it redirects straight to the
 * child home as before. Tapping a row uses the existing child-switching logic
 * (`selectActiveProfile`) and then hands off to the same home/age-band route the
 * app entry would pick for that child.
 */
export default function SelectChildScreen() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<readonly ChildProfileViewModel[] | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const choosing = useRef(false);

  useEffect(() => {
    let mounted = true;
    void getFamilyUseCases()
      .then(async (family) => {
        const [listed, active] = await Promise.all([
          family.listProfiles(),
          family.getActiveProfile(),
        ]);
        if (!mounted) return;
        // A family that is no longer multi-child doesn't need this screen.
        if (listed.length <= 1) {
          router.replace(listed.length === 1 ? '/(child)' : '/onboarding/nickname');
          return;
        }
        setProfiles(listed);
        setActiveProfileId(active?.id ?? null);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const chooseProfile = async (profile: ChildProfileViewModel): Promise<void> => {
    if (choosing.current) return;
    choosing.current = true;
    setActiveProfileId(profile.id);
    try {
      const family = await getFamilyUseCases();
      await family.selectActiveProfile(profile.id);
      router.replace(
        !profile.dateOfBirth || isLegacyAgeBand(profile.ageBand)
          ? '/age-band-update'
          : '/(child)',
      );
    } catch {
      choosing.current = false;
      setFailed(true);
    }
  };

  if (failed) return <ErrorState body={t('selectChild.error')} />;
  if (!profiles) return <LoadingState />;

  return (
    <Screen style={styles.screen} testID="select-child-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title} variant="title">
            {t('selectChild.title')}
          </Text>
          <Text style={styles.subtitle}>{t('selectChild.subtitle')}</Text>
        </View>
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>{t('selectChild.listTitle')}</Text>
          {profiles.map((profile) => {
            const selected = profile.id === activeProfileId;
            return (
              <Pressable
                accessibilityLabel={profile.nickname}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={profile.id}
                onPress={() => void chooseProfile(profile)}
                style={({ pressed }) => [
                  styles.childRow,
                  selected && styles.childRowSelected,
                  pressed && styles.childRowPressed,
                ]}
                testID={`select-child-row-${profile.id}`}
              >
                <Text style={styles.childName}>{profile.nickname}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  childName: { fontSize: 17, fontWeight: '800' },
  childRow: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.brandPrimary,
    borderRadius: radii.md,
    borderWidth: 2,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: spacing.md,
  },
  childRowPressed: { opacity: 0.72 },
  childRowSelected: { backgroundColor: '#E7E7FC', borderColor: colors.teal },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  header: {
    backgroundColor: '#F1ECFF',
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  listSection: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  screen: { justifyContent: 'flex-start' },
  sectionTitle: { color: colors.navy, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.textPrimary, lineHeight: 22, opacity: 0.72 },
  title: { color: colors.brandPrimary },
});
