import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getChildExperienceUseCases } from '@/application/child';
import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import {
  ErrorState,
  LoadingState,
  Screen,
  Text,
  colors,
  minimumTouchTarget,
  radii,
  spacing,
} from '@/design-system';
import {
  growthStageForXp,
  type AccessorySlot,
  type CharacterGrowthStage,
  type InventoryItem,
  type RewardItemKey,
} from '@/domain/rewards';
import {
  CharacterAvatar,
  CharacterSceneDecor,
  CharacterScreenBackdrop,
  categoryIconName,
  characterIconSource,
  collectionPreviewBottomForStage,
  collectionVisualPalette,
  premiumRewardSource,
  sceneBackgroundForCharacter,
  sceneToneForCharacter,
} from '@/features/character';

const categories: readonly AccessorySlot[] = ['background', 'decor', 'effect', 'wearable'];

const decorStyleFor = (key: RewardItemKey) => {
  if (key === 'heart-badge' || key === 'moon-lamp') return styles.decorWall;
  if (key === 'heart-rug') return styles.decorRug;
  if (key === 'cozy-scarf') return styles.decorCloudCushion;
  if (key === 'color-pillow') return styles.decorCushion;
  return styles.decorCorner;
};

export default function CollectionScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChildProfileViewModel | null>(null);
  const [growthStage, setGrowthStage] = useState<CharacterGrowthStage>(0);
  const [items, setItems] = useState<readonly InventoryItem[] | null>(null);
  const [activeSlot, setActiveSlot] = useState<AccessorySlot>('background');
  const [lockedMessage, setLockedMessage] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void getFamilyUseCases()
        .then((family) => family.getActiveProfile())
        .then(async (activeProfile) => {
          if (!activeProfile) throw new Error('PROFILE_NOT_FOUND');
          const child = await getChildExperienceUseCases();
          const [inventory, progress] = await Promise.all([
            child.listInventory(activeProfile.id),
            child.getProgress(activeProfile.id),
          ]);
          if (!mounted) return;
          setProfile(activeProfile);
          setItems(inventory);
          setGrowthStage(growthStageForXp(progress.totalXp));
        })
        .catch(() => {
          if (mounted) setFailed(true);
        });
      return () => {
        mounted = false;
      };
    }, []),
  );

  const select = async (itemKey: RewardItemKey, unlocked: boolean): Promise<void> => {
    if (!profile || !unlocked) {
      setLockedMessage(true);
      return;
    }
    setLockedMessage(false);
    const selectedItem = items?.find((item) => item.key === itemKey);
    if (selectedItem?.equipped) {
      await remove();
      return;
    }
    setItems(
      (current) =>
        current?.map((item) =>
          item.slot === activeSlot ? { ...item, equipped: item.key === itemKey } : item,
        ) ?? null,
    );
    const child = await getChildExperienceUseCases();
    await child.equipItem(profile.id, itemKey);
    setItems(await child.listInventory(profile.id));
  };

  const remove = async (): Promise<void> => {
    if (!profile) return;
    setItems(
      (current) =>
        current?.map((item) => (item.slot === activeSlot ? { ...item, equipped: false } : item)) ??
        null,
    );
    const child = await getChildExperienceUseCases();
    await child.unequipAccessorySlot(profile.id, activeSlot);
  };

  if (failed) return <ErrorState />;
  if (!items || !profile) return <LoadingState />;
  const equippedKeys = items.filter((item) => item.equipped).map((item) => item.key);
  const selectedBackground = items.find((item) => item.equipped && item.slot === 'background');
  const selectedDecor = items.find((item) => item.equipped && item.slot === 'decor');
  const selectedEffect = items.find((item) => item.equipped && item.slot === 'effect');
  const visibleItems = items.filter((item) => item.slot === activeSlot);
  const hasEquippedInSlot = visibleItems.some((item) => item.equipped);
  const visualPalette = collectionVisualPalette[profile.avatarId];

  return (
    <Screen
      style={[styles.screen, { backgroundColor: sceneBackgroundForCharacter(profile.avatarId) }]}
      testID="collection-screen"
    >
      <CharacterScreenBackdrop characterKey={profile.avatarId} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} variant="title">
          {t('collection.title')}
        </Text>
        <Text style={styles.intro} variant="caption">
          {t('collection.heroHint')}
        </Text>
        <View style={[styles.hero, { backgroundColor: visualPalette.hero }]}>
          <CharacterSceneDecor tone={sceneToneForCharacter(profile.avatarId)} />
          {selectedBackground ? (
            <Image
              resizeMode="cover"
              source={premiumRewardSource(selectedBackground.key)}
              style={styles.previewBackgroundAsset}
              testID="collection-preview-background"
            />
          ) : null}
          <View style={styles.previewFloor} />
          {selectedEffect ? (
            <View pointerEvents="none" style={styles.effectLayer}>
              <Image
                source={premiumRewardSource(selectedEffect.key)}
                style={styles.effectTop}
                testID="collection-preview-effect"
              />
              <Image source={premiumRewardSource(selectedEffect.key)} style={styles.effectLeft} />
            </View>
          ) : null}
          {selectedDecor ? (
            <View pointerEvents="none" style={styles.decorPreviewLayer}>
              <Image
                resizeMode="contain"
                source={premiumRewardSource(selectedDecor.key)}
                style={[styles.decorPreview, decorStyleFor(selectedDecor.key)]}
                testID="collection-preview-decor"
              />
            </View>
          ) : null}
          <View
            style={[
              styles.characterPreview,
              { bottom: collectionPreviewBottomForStage(growthStage) },
            ]}
          >
            <CharacterAvatar
              accessoryKeys={equippedKeys.filter(
                (key) => items.find((item) => item.key === key)?.slot === 'wearable',
              )}
              characterKey={profile.avatarId}
              growthStage={growthStage}
              mood="proud"
              size="hero"
              surface="plain"
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View accessibilityRole="tablist" style={styles.categories}>
            {categories.map((slot) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeSlot === slot }}
                key={slot}
                onPress={() => {
                  setActiveSlot(slot);
                  setLockedMessage(false);
                }}
                style={[
                  styles.category,
                  { backgroundColor: visualPalette.card },
                  activeSlot === slot && styles.categoryActive,
                  activeSlot === slot && {
                    backgroundColor: visualPalette.selectedCard,
                    borderColor: visualPalette.accent,
                  },
                ]}
              >
                <Image
                  source={characterIconSource(profile.avatarId, categoryIconName(slot))}
                  style={styles.categoryIcon}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    activeSlot === slot && styles.categoryLabelActive,
                    activeSlot === slot && { color: visualPalette.accent },
                  ]}
                >
                  {t(`collection.categories.${slot}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(`collection.categories.${activeSlot}`)}</Text>
          {hasEquippedInSlot ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void remove()}
              style={styles.remove}
            >
              <Text style={[styles.removeText, { color: visualPalette.accent }]}>
                {t('collection.remove')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {lockedMessage ? <Text style={styles.lockedMessage}>{t('collection.locked')}</Text> : null}
        <View style={styles.grid}>
          {visibleItems.map((item) => (
            <Pressable
              accessibilityLabel={`${t(`rewards.items.${item.key}`)}. ${t(
                item.equipped
                  ? 'collection.equipped'
                  : item.unlocked
                    ? 'collection.unlocked'
                    : 'collection.locked',
              )}`}
              accessibilityRole="button"
              key={item.key}
              onPress={() => void select(item.key, item.unlocked)}
              style={({ pressed }) => [
                styles.itemCard,
                { backgroundColor: visualPalette.card },
                item.equipped && styles.itemEquipped,
                item.equipped && {
                  backgroundColor: visualPalette.selectedCard,
                  borderColor: visualPalette.accent,
                },
                !item.unlocked && styles.itemLocked,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.itemIcon,
                  { backgroundColor: visualPalette.soft },
                  item.equipped && styles.itemIconSelected,
                ]}
              >
                <Image
                  source={premiumRewardSource(item.key)}
                  style={styles.rewardIcon}
                  testID={`collection-item-visual-${item.key}`}
                />
              </View>
              <Text style={styles.itemName}>{t(`rewards.items.${item.key}`)}</Text>
              <Text style={styles.itemStatus}>
                {t(
                  item.equipped
                    ? 'collection.equipped'
                    : item.unlocked
                      ? 'collection.tapToEquip'
                      : 'collection.lockedHint',
                  { xp: item.unlockXp },
                )}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  categories: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 2 },
  category: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: radii.md,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: minimumTouchTarget + 12,
    paddingVertical: spacing.xs,
    width: 84,
    shadowColor: '#7B6792',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  categoryActive: { backgroundColor: '#EFE8FF', borderColor: colors.brandPrimary },
  categoryIcon: { height: 28, width: 28 },
  categoryLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  categoryLabelActive: { color: colors.brandPrimary, fontWeight: '900' },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  heading: { textAlign: 'center' },
  hero: {
    alignItems: 'center',
    backgroundColor: '#F4EFEA',
    borderRadius: 34,
    height: 386,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#7D5FA3',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  intro: { paddingHorizontal: spacing.md, textAlign: 'center' },
  characterPreview: { overflow: 'visible', position: 'absolute', zIndex: 3 },
  previewFloor: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    bottom: 0,
    height: 104,
    position: 'absolute',
    width: '100%',
  },
  previewBackgroundAsset: {
    bottom: 0,
    left: 0,
    opacity: 0.42,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  decorPreview: { position: 'absolute' },
  decorPreviewLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  decorCorner: { borderRadius: 48, bottom: 18, height: 96, left: 20, width: 96 },
  decorCloudCushion: {
    borderRadius: 54,
    bottom: 0,
    height: 108,
    left: '29%',
    width: 150,
  },
  decorCushion: { borderRadius: 50, bottom: 2, height: 100, left: '32%', width: 120 },
  decorRug: { borderRadius: 52, bottom: -2, height: 105, left: '25%', width: 160 },
  decorWall: { borderRadius: 41, height: 82, right: 24, top: 48, width: 82 },
  effectLayer: { height: '100%', position: 'absolute', width: '100%', zIndex: 2 },
  effectTop: { borderRadius: 38, height: 76, position: 'absolute', right: 18, top: 28, width: 76 },
  effectLeft: {
    borderRadius: 28,
    height: 56,
    left: 18,
    opacity: 0.78,
    position: 'absolute',
    top: 128,
    width: 56,
  },
  itemCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: spacing.xs,
    minHeight: 170,
    padding: spacing.md,
    width: '47%',
    shadowColor: '#735D86',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
  },
  itemEquipped: { backgroundColor: '#FFF5D9', borderColor: colors.brandHighlight },
  itemIcon: {
    alignItems: 'center',
    backgroundColor: '#F8F5FC',
    borderRadius: 18,
    height: 66,
    justifyContent: 'center',
    width: 74,
  },
  itemIconSelected: { backgroundColor: '#FFF3C8' },
  itemLocked: { opacity: 0.58 },
  itemName: { fontSize: 15, fontWeight: '800', lineHeight: 20, minHeight: 40, textAlign: 'center' },
  itemStatus: {
    color: '#59616D',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
  },
  rewardIcon: { height: 52, width: 52 },
  lockedMessage: { color: colors.brandSecondary, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.75 },
  remove: {
    alignItems: 'center',
    minHeight: minimumTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  removeText: { color: colors.brandSecondary, fontSize: 14, fontWeight: '900' },
  screen: { justifyContent: 'flex-start' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.navy, fontSize: 22, fontWeight: '900' },
});
