import { useMemo, useState } from 'react';
import { Image, PanResponder, StyleSheet, View } from 'react-native';

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
  const [current, setCurrent] = useState(placement);
  const material = roomMaterialForKey(materialKey);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => editable,
        onMoveShouldSetPanResponderCapture: () => editable,
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
        onPanResponderTerminationRequest: () => !editable,
        onStartShouldSetPanResponder: () => editable,
        onStartShouldSetPanResponderCapture: () => editable,
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
    </View>
  );
}

const styles = StyleSheet.create({
  image: { height: '100%', width: '100%' },
  item: { position: 'absolute' },
});
