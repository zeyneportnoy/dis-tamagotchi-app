import { StyleSheet, View } from 'react-native';

import { Text, colors, radii } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';

const characterEmoji: Record<StarterAvatarKey, string> = {
  'cheerful-incisor': '🦷',
  'sleepy-molar': '🌙',
  'brave-canine': '✨',
};

type Props = { characterKey: StarterAvatarKey; size?: 'small' | 'large' };

export function CharacterAvatar({ characterKey, size = 'large' }: Props) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, size === 'large' ? styles.large : styles.small]}
      testID={`character-${characterKey}`}
    >
      <View style={styles.face}>
        <Text style={size === 'large' ? styles.largeEmoji : styles.smallEmoji}>
          {characterEmoji[characterKey]}
        </Text>
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
  small: { borderRadius: radii.pill, height: 64, width: 64 },
  smallEmoji: { fontSize: 34, lineHeight: 42 },
});
