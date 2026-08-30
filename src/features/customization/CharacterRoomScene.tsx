import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, colors, radii } from '@/design-system';
import type { CharacterMood } from '@/domain/character';
import type { StarterAvatarKey } from '@/domain/family';
import type { CharacterGrowthStage, RewardItemKey } from '@/domain/rewards';
import {
  CharacterAvatar,
  CharacterSceneDecor,
  premiumRewardSource,
  sceneToneForCharacter,
} from '@/features/character';

import { CharacterSceneEffect, type CharacterSceneEffectKey } from './CharacterSceneEffect';
import { RoomMaterialItem } from './RoomMaterialItem';
import type { RoomMaterial, RoomMaterialKey } from './roomMaterials';
import {
  defaultPlacementForRoomMaterial,
  type CustomizationItemKey,
  type ItemPlacement,
  type SceneSize,
} from './state';

type Props = Readonly<{
  backgroundKey?: RewardItemKey;
  characterKey: StarterAvatarKey;
  editable?: boolean;
  effectKey: CharacterSceneEffectKey | null;
  growthStage: CharacterGrowthStage;
  mood: CharacterMood;
  onPlacementChange?: (itemKey: RoomMaterialKey, placement: ItemPlacement) => void;
  overlay?: ReactNode;
  placements: Partial<Record<CustomizationItemKey, ItemPlacement>>;
  roomMaterials: readonly RoomMaterial[];
  style?: StyleProp<ViewStyle>;
  testID: string;
  backgroundTestID?: string;
  effectTestID?: string;
  roomMaterialTestID?: (itemKey: RoomMaterialKey) => string;
}>;

export function CharacterRoomScene({
  backgroundKey,
  backgroundTestID,
  characterKey,
  editable = false,
  effectKey,
  effectTestID,
  growthStage,
  mood,
  onPlacementChange,
  overlay,
  placements,
  roomMaterials,
  roomMaterialTestID,
  style,
  testID,
}: Props) {
  const { t } = useTranslation();
  const [sceneSize, setSceneSize] = useState<SceneSize>({ height: 0, width: 0 });

  return (
    <View
      onLayout={(event) => setSceneSize(event.nativeEvent.layout)}
      style={[styles.scene, style]}
      testID={testID}
    >
      {backgroundKey ? (
        <Image
          resizeMode="cover"
          source={premiumRewardSource(backgroundKey)}
          style={styles.selectedRoomBackground}
          testID={backgroundTestID}
        />
      ) : (
        <>
          <CharacterSceneDecor tone={sceneToneForCharacter(characterKey)} />
          <View style={styles.window}>
            <View style={styles.windowVertical} />
            <View style={styles.windowHorizontal} />
            <View style={styles.cloudOne} />
            <View style={styles.cloudTwo} />
            <View style={styles.windowHill} />
          </View>
          <View style={styles.pictureFrame}>
            <View style={styles.pictureSky}>
              <Text style={styles.pictureIcon}>✦</Text>
            </View>
          </View>
          <View style={styles.floor}>
            <View style={[styles.floorLine, styles.floorLineOne]} />
            <View style={[styles.floorLine, styles.floorLineTwo]} />
            <View style={[styles.floorLine, styles.floorLineThree]} />
          </View>
          <View style={[styles.plant, styles.plantLeft]}>
            <View style={[styles.leaf, styles.leafLeft]} />
            <View style={[styles.leaf, styles.leafRight]} />
            <View style={styles.pot} />
          </View>
          <View style={[styles.plant, styles.plantRight]}>
            <View style={[styles.leaf, styles.leafLeft]} />
            <View style={[styles.leaf, styles.leafRight]} />
            <View style={styles.pot} />
          </View>
          <View style={styles.rug} />
        </>
      )}
      {roomMaterials.map((material) => (
        <RoomMaterialItem
          accessibilityLabel={t(`collection.roomMaterials.${material.key}`)}
          editable={editable}
          key={material.key}
          materialKey={material.key}
          onPlacementChange={(placement) => onPlacementChange?.(material.key, placement)}
          placement={placements[material.key] ?? defaultPlacementForRoomMaterial(material.key)}
          sceneSize={sceneSize}
          testID={roomMaterialTestID?.(material.key)}
          zIndex={2}
        />
      ))}
      <Text style={[styles.sceneSparkle, styles.sceneSparkleLeft]}>✦</Text>
      <Text style={[styles.sceneSparkle, styles.sceneSparkleRight]}>✦</Text>
      <View pointerEvents="none" style={styles.heroCharacter}>
        {effectKey ? (
          <CharacterSceneEffect
            animated={process.env.NODE_ENV !== 'test'}
            effectKey={effectKey}
            testID={effectTestID}
          />
        ) : null}
        <CharacterAvatar
          characterKey={characterKey}
          growthStage={growthStage}
          mood={mood}
          size="hero"
          surface="plain"
        />
      </View>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  cloudOne: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    bottom: 20,
    height: 16,
    left: 15,
    opacity: 0.82,
    position: 'absolute',
    width: 44,
  },
  cloudTwo: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    bottom: 30,
    height: 20,
    left: 32,
    opacity: 0.82,
    position: 'absolute',
    width: 34,
  },
  floor: {
    backgroundColor: '#F4C7B4',
    bottom: 0,
    height: 104,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  floorLine: {
    backgroundColor: 'rgba(176, 110, 95, 0.16)',
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 2,
  },
  floorLineOne: { left: '25%' },
  floorLineThree: { left: '75%' },
  floorLineTwo: { left: '50%' },
  heroCharacter: { bottom: 3, overflow: 'visible', position: 'absolute', zIndex: 3 },
  leaf: {
    backgroundColor: colors.brandAccent,
    borderRadius: radii.pill,
    height: 34,
    position: 'absolute',
    top: 0,
    width: 18,
  },
  leafLeft: { left: 3, transform: [{ rotate: '-28deg' }] },
  leafRight: { right: 3, transform: [{ rotate: '28deg' }] },
  pictureFrame: {
    alignItems: 'center',
    backgroundColor: '#EFB5A8',
    borderRadius: radii.sm,
    height: 72,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    top: 34,
    width: 58,
  },
  pictureIcon: { color: colors.brandSecondary, fontSize: 24, lineHeight: 28 },
  pictureSky: {
    alignItems: 'center',
    backgroundColor: '#FFF0CF',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    width: 40,
  },
  plant: { bottom: 38, height: 70, position: 'absolute', width: 54 },
  plantLeft: { left: 18 },
  plantRight: { right: 18, transform: [{ scale: 0.88 }] },
  pot: {
    backgroundColor: colors.brandSecondary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    bottom: 0,
    height: 34,
    left: 8,
    position: 'absolute',
    width: 38,
  },
  rug: {
    backgroundColor: '#F59AC0',
    borderColor: '#FBC9DC',
    borderRadius: radii.pill,
    borderWidth: 8,
    bottom: 18,
    height: 50,
    position: 'absolute',
    width: 224,
  },
  scene: {
    alignItems: 'center',
    backgroundColor: '#FADFE4',
    borderColor: colors.white,
    borderRadius: 32,
    borderWidth: 4,
    height: 360,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#A64C72',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  sceneSparkle: {
    color: colors.brandHighlight,
    fontSize: 22,
    lineHeight: 26,
    position: 'absolute',
  },
  sceneSparkleLeft: { left: 38, top: 126 },
  sceneSparkleRight: { right: 38, top: 132 },
  selectedRoomBackground: {
    bottom: 0,
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
    zIndex: 0,
  },
  window: {
    backgroundColor: '#AEE7ED',
    borderColor: colors.white,
    borderRadius: 18,
    borderWidth: 6,
    height: 108,
    left: 24,
    overflow: 'hidden',
    position: 'absolute',
    top: 28,
    width: 116,
  },
  windowHill: {
    backgroundColor: '#8AD7B8',
    borderRadius: radii.pill,
    bottom: -23,
    height: 48,
    left: -12,
    position: 'absolute',
    transform: [{ rotate: '8deg' }],
    width: 120,
  },
  windowHorizontal: {
    backgroundColor: colors.white,
    height: 5,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 43,
  },
  windowVertical: {
    backgroundColor: colors.white,
    bottom: 0,
    left: 47,
    position: 'absolute',
    top: 0,
    width: 5,
  },
});
