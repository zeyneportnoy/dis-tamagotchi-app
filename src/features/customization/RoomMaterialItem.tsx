import { useMemo, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { Text, colors, minimumTouchTarget } from '@/design-system';

import { roomMaterialForKey, type RoomMaterialKey } from './roomMaterials';
import { placementAfterBoundedDrag, type ItemPlacement, type SceneSize } from './state';

type Props = Readonly<{
  accessibilityLabel: string;
  editable: boolean;
  materialKey: RoomMaterialKey;
  onPlacementChange(placement: ItemPlacement): void;
  onRemove?(): void;
  placement: ItemPlacement;
  removeLabel: string;
  sceneSize: SceneSize;
  testID?: string;
  zIndex: number;
}>;

export function RoomMaterialItem({
  accessibilityLabel,
  editable,
  materialKey,
  onPlacementChange,
  onRemove,
  placement,
  removeLabel,
  sceneSize,
  testID,
  zIndex,
}: Props) {
  const [current, setCurrent] = useState(placement);
  const material = roomMaterialForKey(materialKey);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => editable,
        onPanResponderMove: (_, gesture) => {
          if (!editable) return;
          setCurrent(
            placementAfterBoundedDrag(
              placement,
              { x: gesture.dx, y: gesture.dy },
              sceneSize,
              material.dimensions,
            ),
          );
        },
        onPanResponderRelease: (_, gesture) => {
          if (!editable) return;
          onPlacementChange(
            placementAfterBoundedDrag(
              placement,
              { x: gesture.dx, y: gesture.dy },
              sceneSize,
              material.dimensions,
            ),
          );
        },
        onPanResponderTerminate: (_, gesture) => {
          if (!editable) return;
          onPlacementChange(
            placementAfterBoundedDrag(
              placement,
              { x: gesture.dx, y: gesture.dy },
              sceneSize,
              material.dimensions,
            ),
          );
        },
        onStartShouldSetPanResponder: () => editable,
      }),
    [editable, material.dimensions, onPlacementChange, placement, sceneSize],
  );

  if (sceneSize.height <= 0 || sceneSize.width <= 0) return null;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={editable ? 'adjustable' : 'image'}
      pointerEvents={editable ? 'auto' : 'none'}
      style={[
        styles.item,
        material.dimensions,
        {
          left: current.x * sceneSize.width - material.dimensions.width / 2,
          top: current.y * sceneSize.height - material.dimensions.height / 2,
          transform: [{ scale: current.scale }],
          zIndex,
        },
      ]}
      testID={testID ?? `room-material-${materialKey}`}
      {...panResponder.panHandlers}
    >
      <Image resizeMode="contain" source={material.source} style={styles.image} />
      {editable && onRemove ? (
        <Pressable
          accessibilityLabel={removeLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onRemove}
          style={styles.remove}
          testID={`remove-room-material-${materialKey}`}
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
});
