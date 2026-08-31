import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getChildExperienceUseCases, subscribeToChildProgressChanges } from '@/application/child';
import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import { syncChildPreferences } from '@/application/sync';
import { perfMark, perfStep } from '@/config/perf';
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
  DEFAULT_BACKGROUND_KEY,
  DEFAULT_BRUSH_KEY,
  DEFAULT_EFFECT_KEY,
  backgroundUnlockScore,
  brushUnlockScore,
  effectUnlockScore,
  growthStageForXp,
  isBackgroundUnlockedForScore,
  isBrushUnlockedForScore,
  isEffectUnlockedForScore,
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
  isCollectionBackgroundKey,
  premiumRewardSource,
  sceneBackgroundForCharacter,
  sceneToneForCharacter,
} from '@/features/character';
import {
  CharacterSceneEffect,
  EffectCardPreview,
  RoomMaterialItem,
  defaultPlacementForRoomMaterial,
  emptyCustomizationState,
  isCharacterSceneEffectKey,
  isRoomMaterialUnlocked,
  loadCustomizationState,
  presentCustomizationInventory,
  placementAfterBoundedDrag,
  roomMaterialsForTheme,
  saveDeveloperEquippedItem,
  saveItemPlacement,
  saveSelectedRoomMaterials,
  type CustomizationItemKey,
  type CustomizationState,
  type ItemPlacement,
  type RoomMaterial,
  type SceneSize,
} from '@/features/customization';

const categories: readonly AccessorySlot[] = ['brush', 'background', 'decor', 'effect'];

/**
 * Slots whose Collection cards are gated on the CURRENT Mine Puan balance
 * (fırça / arka plan / efekt). `unlockScore` and `isUnlocked` read the same
 * `rewardCatalog` threshold, and `defaultKey` is the always-open fallback a
 * re-locked selection reverts to.
 */
const scoreGatedSlots = {
  brush: {
    defaultKey: DEFAULT_BRUSH_KEY,
    unlockScore: brushUnlockScore,
    isUnlocked: isBrushUnlockedForScore,
  },
  background: {
    defaultKey: DEFAULT_BACKGROUND_KEY,
    unlockScore: backgroundUnlockScore,
    isUnlocked: isBackgroundUnlockedForScore,
  },
  effect: {
    defaultKey: DEFAULT_EFFECT_KEY,
    unlockScore: effectUnlockScore,
    isUnlocked: isEffectUnlockedForScore,
  },
} as const satisfies Partial<
  Record<
    AccessorySlot,
    {
      defaultKey: RewardItemKey;
      unlockScore: (key: string) => number | null;
      isUnlocked: (key: string, currentMineScore: number) => boolean;
    }
  >
>;

type ScoreGatedSlot = keyof typeof scoreGatedSlots;

const isScoreGatedSlot = (slot: AccessorySlot): slot is ScoreGatedSlot => slot in scoreGatedSlots;

export default function CollectionScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChildProfileViewModel | null>(null);
  const [growthStage, setGrowthStage] = useState<CharacterGrowthStage>(0);
  const [currentMineScore, setCurrentMineScore] = useState(0);
  const [items, setItems] = useState<readonly InventoryItem[] | null>(null);
  const [activeSlot, setActiveSlot] = useState<AccessorySlot>('brush');
  const [customization, setCustomization] = useState<CustomizationState>(emptyCustomizationState);
  const [sceneSize, setSceneSize] = useState<SceneSize>({ height: 0, width: 0 });
  const [lockedMessage, setLockedMessage] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      perfMark('collection:focus');
      void getFamilyUseCases()
        .then((family) => family.getActiveProfile())
        .then(async (activeProfile) => {
          if (!activeProfile) throw new Error('PROFILE_NOT_FOUND');
          const child = await getChildExperienceUseCases();
          const [inventory, progress, savedCustomization] = await perfStep(
            'collection:hydrate(local)',
            () =>
              Promise.all([
                child.listInventory(activeProfile.id),
                child.getProgress(activeProfile.id),
                loadCustomizationState(activeProfile.id),
              ]),
          );
          if (!mounted) return;
          const mineScore = Math.max(0, progress.totalXp ?? 0);
          let presented = presentCustomizationInventory(inventory, savedCustomization, __DEV__);
          let nextCustomization = savedCustomization;
          // A Mine Puan drop can re-lock the equipped brush / background / effect;
          // fall back to the always-open default so the selection never stays
          // invalid.
          for (const slot of Object.keys(scoreGatedSlots) as ScoreGatedSlot[]) {
            const { defaultKey, isUnlocked } = scoreGatedSlots[slot];
            const equipped = presented.find((item) => item.slot === slot && item.equipped);
            if (!equipped || equipped.key === defaultKey || isUnlocked(equipped.key, mineScore)) {
              continue;
            }
            try {
              if (__DEV__) {
                nextCustomization = await saveDeveloperEquippedItem(
                  activeProfile.id,
                  slot,
                  defaultKey,
                );
              } else {
                await child.equipItem(activeProfile.id, defaultKey);
              }
              presented = presentCustomizationInventory(
                await child.listInventory(activeProfile.id),
                nextCustomization,
                __DEV__,
              );
            } catch {
              // Leave the stored selection as-is; the card still renders locked
              // and the consuming screens guard the active item independently.
            }
          }
          if (!mounted) return;
          setProfile(activeProfile);
          setCustomization(nextCustomization);
          setItems(presented);
          setCurrentMineScore(mineScore);
          setGrowthStage(growthStageForXp(progress.totalXp));
          perfMark('collection:data-ready');
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
    const unsubscribe = subscribeToChildProgressChanges((progress) => {
      if (progress.childProfileId !== profile?.id) return;
      const mineScore = Math.max(0, progress.totalXp);
      setCurrentMineScore(mineScore);
      setGrowthStage(growthStageForXp(mineScore));
      void Promise.all([
        getChildExperienceUseCases().then((child) => child.listInventory(progress.childProfileId)),
        loadCustomizationState(progress.childProfileId),
      ])
        .then(async ([inventory, savedCustomization]) => {
          if (!mounted) return;
          let nextCustomization = savedCustomization;
          let presented = presentCustomizationInventory(inventory, nextCustomization, __DEV__);
          if (__DEV__) {
            for (const slot of Object.keys(scoreGatedSlots) as ScoreGatedSlot[]) {
              const { defaultKey, isUnlocked } = scoreGatedSlots[slot];
              const equipped = presented.find((item) => item.slot === slot && item.equipped);
              if (equipped && !isUnlocked(equipped.key, mineScore)) {
                nextCustomization = await saveDeveloperEquippedItem(
                  progress.childProfileId,
                  slot,
                  defaultKey,
                );
                presented = presentCustomizationInventory(inventory, nextCustomization, true);
              }
            }
          }
          if (!mounted) return;
          setCustomization(nextCustomization);
          setItems(presented);
        })
        .catch(() => {
          if (mounted) setFailed(true);
        });
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [profile?.id]);

  // Best-effort: mirror the child's selected brush/background/effect + room
  // configuration to Supabase. Called only from the mutation sites below, after
  // an actual persisted local change — never on mount / hydration, so opening
  // Collection does not trigger a cloud write. Local write is the source of
  // truth; a cloud failure never rolls the selection back.
  const pushPreferences = useCallback((): void => {
    if (profile) void syncChildPreferences(profile.id);
  }, [profile]);

  const select = async (itemKey: RewardItemKey, unlocked: boolean): Promise<void> => {
    if (!profile || !unlocked) {
      setLockedMessage(true);
      return;
    }
    setLockedMessage(false);
    const selectedItem = items?.find((item) => item.key === itemKey);
    if (selectedItem?.equipped) {
      await remove(selectedItem.slot);
      return;
    }
    setItems(
      (current) =>
        current?.map((item) =>
          item.slot === activeSlot ? { ...item, equipped: item.key === itemKey } : item,
        ) ?? null,
    );
    const child = await getChildExperienceUseCases();
    if (__DEV__) {
      const saved = await saveDeveloperEquippedItem(profile.id, activeSlot, itemKey);
      setCustomization(saved);
      pushPreferences();
      return;
    }
    await child.equipItem(profile.id, itemKey);
    setItems(
      presentCustomizationInventory(await child.listInventory(profile.id), customization, false),
    );
    pushPreferences();
  };

  const remove = async (slot: AccessorySlot = activeSlot): Promise<void> => {
    if (!profile) return;
    if (slot === 'decor') {
      const backgroundKey = items?.find((item) => item.equipped && item.slot === 'background')?.key;
      const themeKeys = new Set(roomMaterialsForTheme(backgroundKey).map((item) => item.key));
      const nextKeys = customization.selectedRoomMaterials.filter((key) => !themeKeys.has(key));
      setCustomization((current) => ({ ...current, selectedRoomMaterials: nextKeys }));
      await saveSelectedRoomMaterials(profile.id, nextKeys);
      pushPreferences();
      return;
    }
    setItems(
      (current) =>
        current?.map((item) => (item.slot === slot ? { ...item, equipped: false } : item)) ?? null,
    );
    if (__DEV__) {
      const saved = await saveDeveloperEquippedItem(profile.id, slot, null);
      setCustomization(saved);
      pushPreferences();
      return;
    }
    const child = await getChildExperienceUseCases();
    await child.unequipAccessorySlot(profile.id, slot);
    pushPreferences();
  };

  const updatePlacement = (itemKey: CustomizationItemKey, placement: ItemPlacement): void => {
    if (!profile) return;
    setCustomization((current) => ({
      ...current,
      placements: { ...current.placements, [itemKey]: placement },
    }));
    void saveItemPlacement(profile.id, itemKey, placement).then(() => pushPreferences());
  };

  const selectRoomMaterial = async (material: RoomMaterial): Promise<void> => {
    if (!profile || !isRoomMaterialUnlocked(material, currentMineScore)) {
      setLockedMessage(true);
      return;
    }
    setLockedMessage(false);
    const isSelected = customization.selectedRoomMaterials.includes(material.key);
    const nextKeys = isSelected
      ? customization.selectedRoomMaterials.filter((key) => key !== material.key)
      : [...customization.selectedRoomMaterials, material.key];
    setCustomization((current) => ({ ...current, selectedRoomMaterials: nextKeys }));
    await saveSelectedRoomMaterials(profile.id, nextKeys);
    pushPreferences();
  };

  const placeRoomMaterial = async (
    material: RoomMaterial,
    placement: ItemPlacement,
  ): Promise<void> => {
    if (!profile || !isRoomMaterialUnlocked(material, currentMineScore)) return;
    const nextKeys = customization.selectedRoomMaterials.includes(material.key)
      ? customization.selectedRoomMaterials
      : [...customization.selectedRoomMaterials, material.key];
    setCustomization((current) => ({
      ...current,
      placements: { ...current.placements, [material.key]: placement },
      selectedRoomMaterials: nextKeys,
    }));
    await saveItemPlacement(profile.id, material.key, placement);
    await saveSelectedRoomMaterials(profile.id, nextKeys);
    pushPreferences();
  };

  const pressRoomMaterial = (material: RoomMaterial): void => {
    if (!isRoomMaterialUnlocked(material, currentMineScore)) {
      setLockedMessage(true);
      return;
    }
    setLockedMessage(false);
    if (customization.selectedRoomMaterials.includes(material.key)) {
      void selectRoomMaterial(material);
      return;
    }
    const initialPlacement = placementAfterBoundedDrag(
      defaultPlacementForRoomMaterial(material.key),
      { x: 0, y: 0 },
      sceneSize,
      material.dimensions,
    );
    void placeRoomMaterial(material, initialPlacement);
  };

  if (failed) return <ErrorState />;
  if (!items || !profile) return <LoadingState />;
  const selectedBackground = items.find((item) => item.equipped && item.slot === 'background');
  const selectedEffect = items.find((item) => item.equipped && item.slot === 'effect');
  const selectedSceneEffectKey = isCharacterSceneEffectKey(selectedEffect?.key)
    ? selectedEffect.key
    : null;
  const roomMaterials = roomMaterialsForTheme(selectedBackground?.key);
  const selectedRoomMaterials = roomMaterials.filter(
    (item) =>
      isRoomMaterialUnlocked(item, currentMineScore) &&
      customization.selectedRoomMaterials.includes(item.key),
  );
  const visibleItems = items.filter(
    (item) =>
      item.slot === activeSlot &&
      activeSlot !== 'decor' &&
      (activeSlot !== 'background' || isCollectionBackgroundKey(item.key)),
  );
  const hasEquippedInSlot =
    activeSlot === 'decor'
      ? selectedRoomMaterials.length > 0
      : visibleItems.some((item) => item.equipped);
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
        <View
          onLayout={(event) => {
            setSceneSize(event.nativeEvent.layout);
          }}
          style={[styles.hero, { backgroundColor: visualPalette.hero }]}
          testID="collection-preview-scene"
        >
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
          {selectedRoomMaterials.map((material) => (
            <RoomMaterialItem
              accessibilityLabel={t(`collection.roomMaterials.${material.key}`)}
              editable
              key={`${profile.id}:${material.key}:${customization.placements[material.key]?.x}:${customization.placements[material.key]?.y}`}
              materialKey={material.key}
              onPlacementChange={(placement) => updatePlacement(material.key, placement)}
              placement={
                customization.placements[material.key] ??
                defaultPlacementForRoomMaterial(material.key)
              }
              sceneSize={sceneSize}
              testID={`collection-preview-room-material-${material.key}`}
              zIndex={2}
            />
          ))}
          <View
            pointerEvents="none"
            style={[
              styles.characterPreview,
              { bottom: collectionPreviewBottomForStage(growthStage) },
            ]}
          >
            {selectedSceneEffectKey ? (
              <CharacterSceneEffect
                animated={process.env.NODE_ENV !== 'test'}
                effectKey={selectedSceneEffectKey}
                testID="collection-preview-effect"
              />
            ) : null}
            <CharacterAvatar
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
                <View style={styles.categoryIconFrame}>
                  <Image
                    resizeMode="contain"
                    source={characterIconSource(profile.avatarId, categoryIconName(slot))}
                    style={styles.categoryIcon}
                    testID={`collection-category-icon-${slot}`}
                  />
                </View>
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
        {activeSlot === 'brush' || activeSlot === 'decor' ? (
          <Text style={styles.slotHint}>
            {t(activeSlot === 'brush' ? 'collection.brushHint' : 'collection.decorHint')}
          </Text>
        ) : null}
        {lockedMessage ? <Text style={styles.lockedMessage}>{t('collection.locked')}</Text> : null}
        <View style={styles.grid} testID="collection-item-grid">
          {activeSlot === 'decor'
            ? roomMaterials.map((material) => {
                const unlocked = isRoomMaterialUnlocked(material, currentMineScore);
                const selected = customization.selectedRoomMaterials.includes(material.key);
                return (
                  <Pressable
                    accessibilityLabel={`${t(`collection.roomMaterials.${material.key}`)}. ${t(
                      selected
                        ? 'collection.equipped'
                        : unlocked
                          ? 'collection.unlocked'
                          : 'collection.locked',
                    )}`}
                    accessibilityRole="button"
                    key={material.key}
                    onPress={() => pressRoomMaterial(material)}
                    style={({ pressed }) => [
                      styles.itemCard,
                      { backgroundColor: visualPalette.card },
                      selected && styles.itemEquipped,
                      selected && {
                        backgroundColor: visualPalette.selectedCard,
                        borderColor: visualPalette.accent,
                      },
                      !unlocked && styles.itemLocked,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.itemIcon,
                        { backgroundColor: visualPalette.soft },
                        selected && styles.itemIconSelected,
                      ]}
                    >
                      <Image
                        resizeMode="contain"
                        source={material.source}
                        style={styles.rewardIcon}
                        testID={`collection-room-material-visual-${material.key}`}
                      />
                    </View>
                    <Text style={styles.itemName}>
                      {t(`collection.roomMaterials.${material.key}`)}
                    </Text>
                    <Text style={styles.itemStatus}>
                      {t(
                        selected
                          ? 'collection.equipped'
                          : unlocked
                            ? 'collection.tapToPlace'
                            : 'collection.lockedHint',
                      )}
                    </Text>
                  </Pressable>
                );
              })
            : null}
          {visibleItems.map((item) => {
            // Brushes, backgrounds and effects are gated on the CURRENT Mine Puan
            // balance, not on a persisted "unlocked forever" flag, so they
            // re-lock if it drops back below the threshold.
            const gate = isScoreGatedSlot(activeSlot) ? scoreGatedSlots[activeSlot] : null;
            const scoreTarget = gate ? gate.unlockScore(item.key) : null;
            const unlocked = gate ? gate.isUnlocked(item.key, currentMineScore) : item.unlocked;
            // A stored selection that has re-locked (score dropped) must never
            // still read as "equipped", even if the revert write has not landed.
            const equipped = item.equipped && unlocked;
            const statusKey = equipped
              ? 'collection.equipped'
              : unlocked
                ? 'collection.tapToEquip'
                : scoreTarget !== null
                  ? 'collection.unlockAt'
                  : 'collection.lockedHint';
            return (
              <Pressable
                accessibilityLabel={`${t(`rewards.items.${item.key}`)}. ${t(
                  equipped
                    ? 'collection.equipped'
                    : unlocked
                      ? 'collection.unlocked'
                      : 'collection.locked',
                )}`}
                accessibilityRole="button"
                key={item.key}
                onPress={() => void select(item.key, unlocked)}
                style={({ pressed }) => [
                  styles.itemCard,
                  { backgroundColor: visualPalette.card },
                  equipped && styles.itemEquipped,
                  equipped && {
                    backgroundColor: visualPalette.selectedCard,
                    borderColor: visualPalette.accent,
                  },
                  !unlocked && styles.itemLocked,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.itemIcon,
                    activeSlot === 'brush' && styles.itemIconBrush,
                    { backgroundColor: visualPalette.soft },
                    equipped && styles.itemIconSelected,
                  ]}
                >
                  {activeSlot === 'effect' && isCharacterSceneEffectKey(item.key) ? (
                    <View testID={`collection-item-visual-${item.key}`}>
                      <EffectCardPreview effectKey={item.key} />
                    </View>
                  ) : (
                    <Image
                      resizeMode="contain"
                      source={premiumRewardSource(item.key)}
                      style={activeSlot === 'brush' ? styles.brushRewardIcon : styles.rewardIcon}
                      testID={`collection-item-visual-${item.key}`}
                    />
                  )}
                </View>
                <Text style={styles.itemName}>{t(`rewards.items.${item.key}`)}</Text>
                <Text style={styles.itemStatus} testID={`collection-item-status-${item.key}`}>
                  {t(statusKey, { xp: scoreTarget ?? item.unlockXp })}
                </Text>
              </Pressable>
            );
          })}
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
    gap: 6,
    justifyContent: 'center',
    minHeight: 96,
    paddingBottom: spacing.xs,
    paddingTop: spacing.sm,
    width: 84,
    shadowColor: '#7B6792',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  categoryActive: { backgroundColor: '#EFE8FF', borderColor: colors.brandPrimary },
  categoryIcon: { height: 48, width: 48 },
  categoryIconFrame: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  categoryLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
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
    height: '100%',
    left: 0,
    opacity: 1,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
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
  itemIconBrush: { height: 120, width: 78 },
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
  slotHint: {
    color: '#3B2A6B',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  brushRewardIcon: { height: 112, width: 70 },
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
