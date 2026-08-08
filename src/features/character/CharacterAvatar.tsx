import { StyleSheet, View } from 'react-native';

import { Text, colors, radii } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';

const characterEmoji: Record<StarterAvatarKey, string> = {
  'cheerful-incisor': '🦷',
  'sleepy-molar': '🌙',
  'brave-canine': '✨',
};

type Props = {
  characterKey: StarterAvatarKey;
  size?: 'tiny' | 'small' | 'large' | 'hero';
  surface?: 'badge' | 'plain';
};

export function CharacterAvatar({ characterKey, size = 'large', surface = 'badge' }: Props) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, styles[size], surface === 'plain' && styles.plain]}
      testID={`character-${characterKey}`}
    >
      <View style={styles.face}>
        <Text style={styles[`${size}Emoji`]}>{characterEmoji[characterKey]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: colors.brandHighlight,
    justifyContent: 'center',
  },
  face: { alignItems: 'center', justifyContent: 'center' },
  large: { borderRadius: radii.pill, height: 190, width: 190 },
  largeEmoji: { fontSize: 104, lineHeight: 124 },
  hero: { borderRadius: radii.pill, height: 250, width: 250 },
  heroEmoji: { fontSize: 142, lineHeight: 164 },
  plain: { backgroundColor: 'transparent' },
  small: { borderRadius: radii.pill, height: 64, width: 64 },
  smallEmoji: { fontSize: 34, lineHeight: 42 },
  tiny: { borderRadius: radii.pill, height: 48, width: 48 },
  tinyEmoji: { fontSize: 25, lineHeight: 30 },
});
