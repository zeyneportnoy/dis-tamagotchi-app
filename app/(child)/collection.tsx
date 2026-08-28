import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
  isCollectionBackgroundKey,
  premiumRewardSource,
  sceneBackgroundForCharacter,
  sceneToneForCharacter,
} from '@/features/character';
import {
  RoomMaterialItem,
  defaultPlacementForRoomMaterial,
  emptyCustomizationState,
  isRoomMaterialUnlocked,
  loadCustomizationState,
  presentCustomizationInventory,
  placementAfterBoundedDrag,
  roomMaterialsForTheme,
  roomMaterialUnlockXp,
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

type DragPoint = Readonly<{ pageX: number; pageY: number }>;
type DragItem = Readonly<{
  dimensions: Readonly<{ height: number; width: number }>;
  key: CustomizationItemKey;
  scale: number;
  source?: ImageSourcePropType;
}>;
type ActiveDragItem = DragItem & DragPoint & Readonly<{ surfaceX: number; surfaceY: number }>;
type WindowFrame = Readonly<{ height: number; width: number; x: number; y: number }>;

function DraggableCollectionCard({
  accessibilityLabel,
  children,
  enabled,
  onDragCancel,
  onDragEnd,
  onDragMove,
  onDragStart,
  onPress,
  style,
}: Readonly<{
  accessibilityLabel: string;
  children: ReactNode;
  enabled: boolean;
  onDragCancel(): void;
  onDragEnd(point: DragPoint): void;
  onDragMove(point: DragPoint): void;
  onDragStart(point: DragPoint): void;
  onPress(): void;
  style: StyleProp<ViewStyle> | ((state: Readonly<{ pressed: boolean }>) => StyleProp<ViewStyle>);
}>) {
  const activeDragRef = useRef(false);
  const lastPointerRef = useRef<DragPoint | null>(null);
  const movedRef = useRef(false);

  const grantDrag = useCallback(
    (pageX: number, pageY: number): void => {
      if (!enabled) return;
      const point = { pageX, pageY };
      activeDragRef.current = true;
      lastPointerRef.current = point;
      movedRef.current = false;
      onDragStart(point);
    },
    [enabled, onDragStart],
  );

  const updateDrag = useCallback(
    (pageX: number, pageY: number, dx: number, dy: number): void => {
      if (!activeDragRef.current) return;
      const point = { pageX, pageY };
      lastPointerRef.current = point;
      if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
      onDragMove(point);
    },
    [onDragMove],
  );

  const finalizeDrop = useCallback((): void => {
    const point = lastPointerRef.current;
    const moved = movedRef.current;
    activeDragRef.current = false;
    lastPointerRef.current = null;
    movedRef.current = false;
    if (enabled && moved && point) {
      onDragEnd(point);
      return;
    }
    onDragCancel();
    if (!moved) onPress();
  }, [enabled, onDragCancel, onDragEnd, onPress]);

  const allowTermination = useCallback((): boolean => !activeDragRef.current, []);

  const panResponder = useMemo(
    () =>
      // PanResponder invokes these callbacks after render; refs hold the latest pointer synchronously.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (event) => grantDrag(event.nativeEvent.pageX, event.nativeEvent.pageY),
        onPanResponderMove: (event, gesture) => {
          updateDrag(
            gesture.moveX || event.nativeEvent.pageX,
            gesture.moveY || event.nativeEvent.pageY,
            gesture.dx,
            gesture.dy,
          );
        },
        onPanResponderRelease: finalizeDrop,
        onPanResponderTerminate: finalizeDrop,
        onPanResponderTerminationRequest: allowTermination,
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
      }),
    [allowTermination, finalizeDrop, grantDrag, updateDrag],
  );

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={typeof style === 'function' ? style({ pressed: false }) : style}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
}

export default function CollectionScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChildProfileViewModel | null>(null);
  const [growthStage, setGrowthStage] = useState<CharacterGrowthStage>(0);
  const [items, setItems] = useState<readonly InventoryItem[] | null>(null);
  const [activeSlot, setActiveSlot] = useState<AccessorySlot>('brush');
  const [customization, setCustomization] = useState<CustomizationState>(emptyCustomizationState);
  const [sceneSize, setSceneSize] = useState<SceneSize>({ height: 0, width: 0 });
  const [lockedMessage, setLockedMessage] = useState(false);
  const [failed, setFailed] = useState(false);
  const [draggedItem, setDraggedItem] = useState<ActiveDragItem | null>(null);
  const dragSurfaceRef = useRef<View>(null);
  const sceneRef = useRef<View>(null);
  const dragSurfaceFrame = useRef<WindowFrame | null>(null);
  const sceneFrame = useRef<WindowFrame | null>(null);
  const draggedItemRef = useRef<ActiveDragItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void getFamilyUseCases()
        .then((family) => family.getActiveProfile())
        .then(async (activeProfile) => {
          if (!activeProfile) throw new Error('PROFILE_NOT_FOUND');
          const child = await getChildExperienceUseCases();
          const [inventory, progress, savedCustomization] = await Promise.all([
            child.listInventory(activeProfile.id),
            child.getProgress(activeProfile.id),
            loadCustomizationState(activeProfile.id),
          ]);
          if (!mounted) return;
          setProfile(activeProfile);
          setCustomization(savedCustomization);
          setItems(presentCustomizationInventory(inventory, savedCustomization, __DEV__));
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
      return;
    }
    await child.equipItem(profile.id, itemKey);
    setItems(
      presentCustomizationInventory(await child.listInventory(profile.id), customization, false),
    );
  };

  const remove = async (slot: AccessorySlot = activeSlot): Promise<void> => {
    if (!profile) return;
    if (slot === 'decor') {
      const backgroundKey = items?.find((item) => item.equipped && item.slot === 'background')?.key;
      const themeKeys = new Set(roomMaterialsForTheme(backgroundKey).map((item) => item.key));
      const nextKeys = customization.selectedRoomMaterials.filter((key) => !themeKeys.has(key));
      setCustomization((current) => ({ ...current, selectedRoomMaterials: nextKeys }));
      await saveSelectedRoomMaterials(profile.id, nextKeys);
      return;
    }
    setItems(
      (current) =>
        current?.map((item) => (item.slot === slot ? { ...item, equipped: false } : item)) ?? null,
    );
    if (__DEV__) {
      const saved = await saveDeveloperEquippedItem(profile.id, slot, null);
      setCustomization(saved);
      return;
    }
    const child = await getChildExperienceUseCases();
    await child.unequipAccessorySlot(profile.id, slot);
  };

  const updatePlacement = (itemKey: CustomizationItemKey, placement: ItemPlacement): void => {
    if (!profile) return;
    setCustomization((current) => ({
      ...current,
      placements: { ...current.placements, [itemKey]: placement },
    }));
    void saveItemPlacement(profile.id, itemKey, placement).then(setCustomization);
  };

  const selectRoomMaterial = async (material: RoomMaterial): Promise<void> => {
    if (!profile || !isRoomMaterialUnlocked(material, items ?? [], __DEV__)) {
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
  };

  const placeRoomMaterial = async (
    material: RoomMaterial,
    placement: ItemPlacement,
  ): Promise<void> => {
    if (!profile || !isRoomMaterialUnlocked(material, items ?? [], __DEV__)) return;
    const nextKeys = customization.selectedRoomMaterials.includes(material.key)
      ? customization.selectedRoomMaterials
      : [...customization.selectedRoomMaterials, material.key];
    setCustomization((current) => ({
      ...current,
      placements: { ...current.placements, [material.key]: placement },
      selectedRoomMaterials: nextKeys,
    }));
    await saveItemPlacement(profile.id, material.key, placement);
    setCustomization(await saveSelectedRoomMaterials(profile.id, nextKeys));
  };

  const measureDropFrames = (): void => {
    dragSurfaceRef.current?.measureInWindow((x, y, width, height) => {
      dragSurfaceFrame.current = { height, width, x, y };
    });
    sceneRef.current?.measureInWindow((x, y, width, height) => {
      sceneFrame.current = { height, width, x, y };
    });
  };

  const beginDrag = (item: DragItem, point: DragPoint): void => {
    measureDropFrames();
    const surface = dragSurfaceFrame.current;
    const next = { ...item, ...point, surfaceX: surface?.x ?? 0, surfaceY: surface?.y ?? 0 };
    draggedItemRef.current = next;
    setDraggedItem(next);
  };

  const moveDrag = (point: DragPoint): void => {
    const current = draggedItemRef.current;
    const next = current ? { ...current, ...point } : null;
    draggedItemRef.current = next;
    setDraggedItem(next);
  };

  const cancelDrag = (): void => {
    draggedItemRef.current = null;
    setDraggedItem(null);
  };

  const finishDrag = (point: DragPoint, place: (placement: ItemPlacement) => void): void => {
    const current = draggedItemRef.current;
    draggedItemRef.current = null;
    setDraggedItem(null);
    if (!current) return;
    sceneRef.current?.measureInWindow((x, y, width, height) => {
      const frame = { height, width, x, y };
      sceneFrame.current = frame;
      const placement = placementAfterBoundedDrag(
        { scale: current.scale, x: 0.5, y: 0.5 },
        {
          x: point.pageX - frame.x - frame.width / 2,
          y: point.pageY - frame.y - frame.height / 2,
        },
        { height: frame.height, width: frame.width },
        current.dimensions,
      );
      place(placement);
    });
  };

  if (failed) return <ErrorState />;
  if (!items || !profile) return <LoadingState />;
  const selectedBackground = items.find((item) => item.equipped && item.slot === 'background');
  const selectedEffect = items.find((item) => item.equipped && item.slot === 'effect');
  const roomMaterials = roomMaterialsForTheme(selectedBackground?.key);
  const selectedRoomMaterials = roomMaterials.filter((item) =>
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
      <View pointerEvents="none" ref={dragSurfaceRef} style={styles.dragOrigin} />
      <CharacterScreenBackdrop characterKey={profile.avatarId} />
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={!draggedItem}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading} variant="title">
          {t('collection.title')}
        </Text>
        <Text style={styles.intro} variant="caption">
          {t('collection.heroHint')}
        </Text>
        <View
          onLayout={(event) => {
            setSceneSize(event.nativeEvent.layout);
            measureDropFrames();
          }}
          ref={sceneRef}
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
                <Image
                  resizeMode="contain"
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
        {activeSlot === 'brush' || activeSlot === 'decor' ? (
          <Text style={styles.slotHint}>
            {t(activeSlot === 'brush' ? 'collection.brushHint' : 'collection.decorHint')}
          </Text>
        ) : null}
        {lockedMessage ? <Text style={styles.lockedMessage}>{t('collection.locked')}</Text> : null}
        <View style={styles.grid} testID="collection-item-grid">
          {activeSlot === 'decor'
            ? roomMaterials.map((material) => {
                const unlocked = isRoomMaterialUnlocked(material, items, __DEV__);
                const selected = customization.selectedRoomMaterials.includes(material.key);
                return (
                  <DraggableCollectionCard
                    accessibilityLabel={`${t(`collection.roomMaterials.${material.key}`)}. ${t(
                      selected
                        ? 'collection.equipped'
                        : unlocked
                          ? 'collection.unlocked'
                          : 'collection.locked',
                    )}`}
                    enabled={unlocked}
                    key={material.key}
                    onDragCancel={cancelDrag}
                    onDragEnd={(point) =>
                      finishDrag(point, (placement) => void placeRoomMaterial(material, placement))
                    }
                    onDragMove={moveDrag}
                    onDragStart={(point) =>
                      beginDrag(
                        {
                          dimensions: material.dimensions,
                          key: material.key,
                          scale:
                            customization.placements[material.key]?.scale ??
                            material.defaultPlacement.scale,
                          source: material.source,
                        },
                        point,
                      )
                    }
                    onPress={() => {
                      if (!unlocked) {
                        setLockedMessage(true);
                      } else if (selected) {
                        void selectRoomMaterial(material);
                      }
                    }}
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
                            ? 'collection.dragToPlace'
                            : 'collection.lockedHint',
                        { xp: roomMaterialUnlockXp(material) },
                      )}
                    </Text>
                  </DraggableCollectionCard>
                );
              })
            : null}
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
                  activeSlot === 'brush' && styles.itemIconBrush,
                  { backgroundColor: visualPalette.soft },
                  item.equipped && styles.itemIconSelected,
                ]}
              >
                <Image
                  resizeMode="contain"
                  source={premiumRewardSource(item.key)}
                  style={activeSlot === 'brush' ? styles.brushRewardIcon : styles.rewardIcon}
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
      {draggedItem ? (
        <View pointerEvents="none" style={styles.dragGhostLayer}>
          <View
            style={[
              styles.dragGhost,
              draggedItem.dimensions,
              {
                left: draggedItem.pageX - draggedItem.surfaceX - draggedItem.dimensions.width / 2,
                top: draggedItem.pageY - draggedItem.surfaceY - draggedItem.dimensions.height / 2,
                transform: [{ scale: draggedItem.scale }],
              },
            ]}
            testID={`collection-drag-preview-${draggedItem.key}`}
          >
            {draggedItem.source ? (
              <Image
                resizeMode="contain"
                source={draggedItem.source}
                style={styles.rewardIconFill}
              />
            ) : null}
          </View>
        </View>
      ) : null}
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
  dragGhost: { opacity: 0.9, position: 'absolute', zIndex: 20 },
  dragGhostLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 20 },
  dragOrigin: { height: 1, left: 0, position: 'absolute', top: 0, width: 1 },
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
  rewardIconFill: { height: '100%', width: '100%' },
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
