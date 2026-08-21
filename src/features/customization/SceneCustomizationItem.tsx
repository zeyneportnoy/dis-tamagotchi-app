import { useMemo, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { Text, colors, minimumTouchTarget } from '@/design-system';
import { rewardItemForKey, type RewardItemKey } from '@/domain/rewards';
import { CharacterAccessory, premiumRewardSource } from '@/features/character';

import { placementAfterDrag, type ItemPlacement, type SceneSize } from './state';

type Props = Readonly<{
  accessibilityLabel: string;
  editable: boolean;
  itemKey: RewardItemKey;
  kind: 'decor' | 'wearable';
  onPlacementChange(placement: ItemPlacement): void;
  onRemove?(): void;
  placement: ItemPlacement;
  removeLabel: string;
  renderMode?: 'premium' | 'symbol';
  sceneSize: SceneSize;
  testID?: string;
  zIndex: number;
}>;

const itemDimensions = {
  decor: { height: 112, width: 124 },
  wearable: { height: 88, width: 96 },
} as const;

export function SceneCustomizationItem({
  accessibilityLabel,
  editable,
  itemKey,
  kind,
  onPlacementChange,
  onRemove,
  placement,
  removeLabel,
  renderMode = 'premium',
  sceneSize,
  testID,
  zIndex,
}: Props) {
  const [current, setCurrent] = useState(placement);
  const dimensions = itemDimensions[kind];

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => editable,
        onPanResponderMove: (_, gesture) => {
          if (!editable || sceneSize.width <= 0 || sceneSize.height <= 0) return;
          const next = placementAfterDrag(placement, { x: gesture.dx, y: gesture.dy }, sceneSize);
          setCurrent(next);
        },
        onPanResponderRelease: (_, gesture) => {
          if (editable) {
            onPlacementChange(
              placementAfterDrag(placement, { x: gesture.dx, y: gesture.dy }, sceneSize),
            );
          }
        },
        onPanResponderTerminate: (_, gesture) => {
          if (editable) {
            onPlacementChange(
              placementAfterDrag(placement, { x: gesture.dx, y: gesture.dy }, sceneSize),
            );
          }
        },
        onStartShouldSetPanResponder: () => editable,
      }),
    [editable, onPlacementChange, placement, sceneSize],
  );

  if (sceneSize.height <= 0 || sceneSize.width <= 0) return null;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={editable ? 'adjustable' : 'image'}
      pointerEvents={editable ? 'auto' : 'none'}
      style={[
        styles.item,
        dimensions,
        {
          left: current.x * sceneSize.width - dimensions.width / 2,
          top: current.y * sceneSize.height - dimensions.height / 2,
          transform: [{ scale: current.scale }],
          zIndex,
        },
        editable && styles.itemEditable,
      ]}
      testID={testID ?? `scene-item-${itemKey}`}
      {...panResponder.panHandlers}
    >
      {kind === 'wearable' ? (
        <View style={styles.wearableArt}>
          <CharacterAccessory itemKey={itemKey} preview />
        </View>
      ) : renderMode === 'symbol' ? (
        <Text style={styles.symbol}>{rewardItemForKey(itemKey).icon}</Text>
      ) : (
        <Image resizeMode="contain" source={premiumRewardSource(itemKey)} style={styles.image} />
      )}
      {editable && onRemove ? (
        <Pressable
          accessibilityLabel={removeLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onRemove}
          style={styles.remove}
          testID={`remove-scene-item-${itemKey}`}
        >
          <Text style={styles.removeText}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { height: '100%', width: '100%' },
  item: { position: 'absolute' },
  itemEditable: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: colors.brandPrimary,
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 2,
  },
  remove: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.brandSecondary,
    borderRadius: minimumTouchTarget / 2,
    borderWidth: 2,
    height: minimumTouchTarget,
    justifyContent: 'center',
    position: 'absolute',
    right: -minimumTouchTarget / 2,
    top: -minimumTouchTarget / 2,
    width: minimumTouchTarget,
  },
  removeText: {
    color: colors.brandSecondary,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 28,
  },
  symbol: { fontSize: 76, lineHeight: 92, textAlign: 'center' },
  wearableArt: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
