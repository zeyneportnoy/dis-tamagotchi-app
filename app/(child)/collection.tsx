import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { CharacterAccessory, CharacterAvatar } from '@/features/character';

const categories: readonly { icon: string; slot: AccessorySlot }[] = [
  { icon: '🏠', slot: 'background' },
  { icon: '🪴', slot: 'decor' },
  { icon: '✨', slot: 'effect' },
  { icon: '👑', slot: 'wearable' },
];

const backgroundColors: Partial<Record<RewardItemKey, string>> = {
  'pastel-playroom': '#E9E0FF',
  'cloud-room': '#DDF4FF',
  'rainbow-room': '#F7DDF2',
  'space-room': '#312A67',
  'undersea-room': '#BCECE8',
  'rainbow-cape': '#F8D4E7',
  'night-room': '#292857',
  'forest-room': '#D6EDCE',
};

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

  const load = async (): Promise<void> => {
    const activeProfile = await (await getFamilyUseCases()).getActiveProfile();
    if (!activeProfile) throw new Error('PROFILE_NOT_FOUND');
    setProfile(activeProfile);
    const child = await getChildExperienceUseCases();
    const [inventory, progress] = await Promise.all([
      child.listInventory(activeProfile.id),
      child.getProgress(activeProfile.id),
    ]);
    setItems(inventory);
    setGrowthStage(growthStageForXp(progress.totalXp));
  };

  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() => setFailed(true));
  }, []);

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

  return (
    <Screen style={styles.screen} testID="collection-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} variant="title">
          {t('collection.title')}
        </Text>
        <Text style={styles.intro} variant="caption">
          {t('collection.heroHint')}
        </Text>
        <View
          style={[
            styles.hero,
            selectedBackground
              ? { backgroundColor: backgroundColors[selectedBackground.key] }
              : null,
          ]}
        >
          <View style={styles.heroGlow} />
          <View style={styles.previewFloor} />
          {selectedEffect ? (
            <View pointerEvents="none" style={styles.effectLayer}>
              <Text style={styles.effectTop}>{selectedEffect.icon}</Text>
              <Text style={styles.effectLeft}>{selectedEffect.icon}</Text>
              <Text style={styles.effectRight}>{selectedEffect.icon}</Text>
            </View>
          ) : null}
          {selectedDecor ? (
            <Text style={[styles.decorPreview, decorStyleFor(selectedDecor.key)]}>
              {selectedDecor.icon}
            </Text>
          ) : null}
          <View style={styles.characterPreview}>
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
            {categories.map(({ icon, slot }) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeSlot === slot }}
                key={slot}
                onPress={() => {
                  setActiveSlot(slot);
                  setLockedMessage(false);
                }}
                style={[styles.category, activeSlot === slot && styles.categoryActive]}
              >
                <Text style={styles.categoryIcon}>{icon}</Text>
                <Text
                  style={[styles.categoryLabel, activeSlot === slot && styles.categoryLabelActive]}
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
              <Text style={styles.removeText}>{t('collection.remove')}</Text>
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
                item.equipped && styles.itemEquipped,
                !item.unlocked && styles.itemLocked,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.itemIcon, item.equipped && styles.itemIconSelected]}>
                {item.unlocked ? (
                  item.slot === 'wearable' ? (
                    <CharacterAccessory itemKey={item.key} preview />
                  ) : (
                    <Text style={styles.rewardIcon}>{item.icon}</Text>
                  )
                ) : (
                  <Text style={styles.lockIcon}>🔒</Text>
                )}
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
    backgroundColor: colors.white,
    borderColor: '#E8E1F1',
    borderRadius: radii.md,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: minimumTouchTarget + 12,
    paddingVertical: spacing.xs,
    width: 84,
  },
  categoryActive: { backgroundColor: '#EFE8FF', borderColor: colors.brandPrimary },
  categoryIcon: { fontSize: 20, lineHeight: 28 },
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
  },
  heroGlow: {
    backgroundColor: 'rgba(255,255,255,0.44)',
    borderRadius: radii.pill,
    height: 250,
    position: 'absolute',
    top: 24,
    width: 250,
  },
  intro: { paddingHorizontal: spacing.md, textAlign: 'center' },
  characterPreview: { bottom: 32, overflow: 'visible', position: 'absolute', zIndex: 3 },
  previewFloor: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    bottom: 0,
    height: 104,
    position: 'absolute',
    width: '100%',
  },
  decorPreview: { fontSize: 52, lineHeight: 76, position: 'absolute', zIndex: 2 },
  decorCorner: { bottom: 34, left: 20 },
  decorCloudCushion: {
    bottom: 66,
    fontSize: 76,
    left: '36%',
    lineHeight: 92,
    transform: [{ scaleX: 1.35 }],
  },
  decorCushion: { bottom: 24, left: '42%' },
  decorRug: { bottom: 16, fontSize: 72, left: '38%', transform: [{ scaleX: 1.6 }] },
  decorWall: { fontSize: 43, right: 30, top: 54 },
  effectLayer: { height: '100%', position: 'absolute', width: '100%', zIndex: 2 },
  effectTop: { fontSize: 30, left: '45%', lineHeight: 40, position: 'absolute', top: 32 },
  effectLeft: { fontSize: 24, left: 38, lineHeight: 34, position: 'absolute', top: 150 },
  effectRight: { fontSize: 26, lineHeight: 36, position: 'absolute', right: 38, top: 180 },
  itemCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#EEE7E2',
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: spacing.xs,
    minHeight: 170,
    padding: spacing.md,
    width: '47%',
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
  lockIcon: { fontSize: 30 },
  rewardIcon: { fontSize: 40, lineHeight: 52 },
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
