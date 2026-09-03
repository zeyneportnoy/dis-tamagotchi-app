import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getChildExperienceUseCases, subscribeToChildProgressChanges } from '@/application/child';
import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import { perfMark, perfStep } from '@/config/perf';
import { deriveHomeCharacterMood } from '@/domain/character';
import type { ProfileProgress } from '@/domain/family';
import {
  Button,
  ErrorState,
  LoadingState,
  Screen,
  Text,
  colors,
  radii,
  spacing,
} from '@/design-system';
import {
  characterGrowthStageNames,
  growthProgressForXp,
  isBackgroundUnlockedForScore,
  isEffectUnlockedForScore,
  type CharacterGrowthStage,
  type InventoryItem,
} from '@/domain/rewards';
import { CharacterScreenBackdrop, sceneBackgroundForCharacter } from '@/features/character';
import {
  CharacterRoomScene,
  isCharacterSceneEffectKey,
  loadCustomizationState,
  presentCustomizationInventory,
  roomMaterialsForTheme,
  type CharacterSceneEffectKey,
  type CustomizationState,
  type RoomMaterial,
} from '@/features/customization';

type ProfileData = Readonly<{
  profile: ChildProfileViewModel;
  progress: ProfileProgress;
  totalXp: number;
  growthStage: CharacterGrowthStage;
  roomBackground: InventoryItem | undefined;
  roomEffectKey: CharacterSceneEffectKey | null;
  equippedItems: readonly InventoryItem[];
  selectedRoomMaterials: readonly RoomMaterial[];
  customization: CustomizationState;
}>;

async function readProfileData(): Promise<ProfileData | null> {
  const family = await getFamilyUseCases();
  const profile = await family.getActiveProfile();
  if (!profile) return null;

  const child = await getChildExperienceUseCases();
  const [progress, inventory, customization] = await Promise.all([
    child.getProgress(profile.id),
    child.listInventory(profile.id),
    loadCustomizationState(profile.id),
  ]);

  const totalXp =
    progress && typeof (progress as { totalXp?: number }).totalXp === 'number'
      ? (progress as { totalXp: number }).totalXp
      : 0;
  const growthStage = growthProgressForXp(totalXp).currentStage;

  const equippedItems = presentCustomizationInventory(inventory, customization, __DEV__).filter(
    (item) => item.equipped,
  );

  // A Mine Puan drop can re-lock a previously equipped background/effect; until
  // Collection reverts the pick, fall back to the always-open default here too.
  const equippedBackground = equippedItems.find((item) => item.slot === 'background');
  const roomBackground =
    equippedBackground && isBackgroundUnlockedForScore(equippedBackground.key, totalXp)
      ? equippedBackground
      : undefined;
  const equippedEffect = equippedItems.find((item) => item.slot === 'effect');
  const roomEffectKey =
    isCharacterSceneEffectKey(equippedEffect?.key) &&
    isEffectUnlockedForScore(equippedEffect.key, totalXp)
      ? equippedEffect.key
      : null;
  const selectedRoomMaterials = roomMaterialsForTheme(roomBackground?.key).filter((material) =>
    customization.selectedRoomMaterials.includes(material.key),
  );

  return {
    customization,
    equippedItems,
    growthStage,
    profile,
    progress,
    roomBackground,
    roomEffectKey,
    selectedRoomMaterials,
    totalXp,
  };
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProfileData | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      perfMark('profile:focus');
      void perfStep('profile:readProfileData', readProfileData)
        .then((next) => {
          if (mounted) setData(next);
          perfMark('profile:data-ready');
        })
        .catch(() => {
          if (mounted) setFailed(true);
        });
      return () => {
        mounted = false;
      };
    }, []),
  );

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeToChildProgressChanges((nextProgress) => {
      if (nextProgress.childProfileId !== data?.profile.id) return;
      void readProfileData().then((next) => {
        if (mounted) setData(next);
      });
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [data?.profile.id]);

  if (failed) return <ErrorState />;
  if (!data) return <LoadingState />;

  const {
    profile,
    growthStage,
    roomBackground,
    roomEffectKey,
    equippedItems,
    selectedRoomMaterials,
  } = data;
  const stageLabel = t(`growth.stages.${characterGrowthStageNames[growthStage]}`);
  const ageBandLabel = t(
    profile.ageBand === '7_11' ? 'onboarding.ageBand.sevenEleven' : 'onboarding.ageBand.fourSix',
  );
  const itemChips: { key: string; icon: string | null; label: string }[] = [
    ...equippedItems
      .filter((item) => item.slot !== 'decor' || item.equipped)
      .map((item) => ({
        key: `item:${item.key}`,
        icon: item.icon || null,
        label: t(`rewards.items.${item.key}`),
      })),
    ...selectedRoomMaterials.map((material) => ({
      key: `material:${material.key}`,
      icon: null,
      label: t(`collection.roomMaterials.${material.key}`),
    })),
  ].filter(
    (chip, index, chips) => chips.findIndex((candidate) => candidate.label === chip.label) === index,
  );

  return (
    <Screen
      style={[styles.screen, { backgroundColor: sceneBackgroundForCharacter(profile.avatarId) }]}
      testID="profile-screen"
    >
      <CharacterScreenBackdrop characterKey={profile.avatarId} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} variant="title">
          {t('placeholders.profileTitle')}
        </Text>

        <View style={styles.card} testID="profile-summary-card">
          <Text style={styles.cardTitle}>{t('profile.summaryTitle')}</Text>

          <CharacterRoomScene
            backgroundKey={roomBackground?.key}
            backgroundTestID={
              roomBackground ? `profile-background-${roomBackground.key}` : undefined
            }
            characterKey={profile.avatarId}
            effectKey={roomEffectKey}
            effectTestID="profile-character-effect"
            growthStage={growthStage}
            mood={deriveHomeCharacterMood(data.progress)}
            placements={data.customization.placements}
            roomMaterials={selectedRoomMaterials}
            roomMaterialTestID={(itemKey) => `profile-room-material-${itemKey}`}
            style={styles.hero}
            testID="profile-summary-scene"
          />

          <View style={styles.info}>
            <Text style={styles.nickname}>{profile.nickname}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.nickname')}</Text>
              <Text style={styles.value}>{profile.nickname}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.ageBand')}</Text>
              <Text style={styles.value}>{ageBandLabel}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.toothStage')}</Text>
              <Text style={styles.value} testID="profile-tooth-stage">
                {stageLabel}
              </Text>
            </View>

            <View style={styles.chipSection}>
              <Text style={styles.label}>{t('profile.selectedItems')}</Text>
              <View style={styles.chipRow}>
                {itemChips.length > 0 ? (
                  itemChips.map((chip) => (
                    <View
                      key={chip.key}
                      style={styles.chip}
                      testID={`profile-item-chip-${chip.key}`}
                    >
                      <Text style={styles.chipLabel}>{chip.label}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.value}>{t('profile.noSelectedItems')}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <Button
          label={t('childHome.parentArea')}
          onPress={() => router.push('/parent-gate')}
          variant="secondary"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
    width: '100%',
  },
  cardTitle: {
    alignSelf: 'flex-start',
    color: colors.brandPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: 'rgba(108,92,231,0.18)',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipIcon: { fontSize: 15, lineHeight: 17 },
  chipLabel: { color: colors.navy, fontSize: 13, fontWeight: '800', lineHeight: 17 },
  chipRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipSection: { gap: spacing.sm },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  heading: { alignSelf: 'stretch', textAlign: 'center' },
  hero: {
    alignSelf: 'stretch',
    marginHorizontal: -spacing.md,
  },
  info: { alignSelf: 'stretch', gap: spacing.sm },
  label: { color: '#667078', flexShrink: 0, fontSize: 13, fontWeight: '800' },
  nickname: { fontSize: 24, fontWeight: '900', lineHeight: 30 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  screen: { justifyContent: 'flex-start' },
  value: {
    color: colors.navy,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
});
