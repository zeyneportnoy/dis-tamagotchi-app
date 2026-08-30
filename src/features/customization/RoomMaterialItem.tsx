import { useMemo, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet } from 'react-native';

import { roomMaterialForKey, type RoomMaterialKey } from './roomMaterials';
import { placementAfterBoundedDrag, type ItemPlacement, type SceneSize } from './state';

type Props = Readonly<{
  accessibilityLabel: string;
  editable: boolean;
  materialKey: RoomMaterialKey;
  onPlacementChange(placement: ItemPlacement): void;
  placement: ItemPlacement;
  sceneSize: SceneSize;
  testID?: string;
  zIndex: number;
}>;

export function RoomMaterialItem({
  accessibilityLabel,
  editable,
  materialKey,
  onPlacementChange,
  placement,
  sceneSize,
  testID,
  zIndex,
}: Props) {
  const material = roomMaterialForKey(materialKey);
  // Live drag offset. Updated imperatively per pointer frame via setValue — no
  // React state, so pointer movement never re-renders this item (or Collection).
  // The committed position lives in the `placement` prop; on drop we resolve it
  // once and reset this offset to zero.
  const [drag] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));

  const panResponder = useMemo(() => {
    const halfW = material.dimensions.width / 2;
    const halfH = material.dimensions.height / 2;
    const baseX = placement.x * sceneSize.width;
    const baseY = placement.y * sceneSize.height;
    const clamp = (dx: number, dy: number): { x: number; y: number } => ({
      x: Math.min(Math.max(dx, halfW - baseX), sceneSize.width - halfW - baseX),
      y: Math.min(Math.max(dy, halfH - baseY), sceneSize.height - halfH - baseY),
    });
    const commit = (dx: number, dy: number): void => {
      onPlacementChange(
        placementAfterBoundedDrag(placement, { x: dx, y: dy }, sceneSize, material.dimensions),
      );
      drag.setValue({ x: 0, y: 0 });
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponderCapture: () => editable,
      onPanResponderMove: (_, gesture) => {
        if (!editable) return;
        drag.setValue(clamp(gesture.dx, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (editable) commit(gesture.dx, gesture.dy);
      },
      onPanResponderTerminate: (_, gesture) => {
        if (editable) commit(gesture.dx, gesture.dy);
      },
      onPanResponderTerminationRequest: () => !editable,
      onStartShouldSetPanResponder: () => editable,
      onStartShouldSetPanResponderCapture: () => editable,
    });
  }, [drag, editable, material.dimensions, onPlacementChange, placement, sceneSize]);

  if (sceneSize.height <= 0 || sceneSize.width <= 0) return null;

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={editable ? 'adjustable' : 'image'}
      pointerEvents={editable ? 'auto' : 'none'}
      style={[
        styles.item,
        material.dimensions,
        {
          left: placement.x * sceneSize.width - material.dimensions.width / 2,
          top: placement.y * sceneSize.height - material.dimensions.height / 2,
          transform: [{ translateX: drag.x }, { translateY: drag.y }, { scale: placement.scale }],
          zIndex,
        },
      ]}
      testID={testID ?? `room-material-${materialKey}`}
      {...panResponder.panHandlers}
    >
      <Image resizeMode="contain" source={material.source} style={styles.image} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  image: { height: '100%', width: '100%' },
  item: { position: 'absolute' },
});
