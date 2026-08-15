import { Pressable, StyleSheet, View } from 'react-native';

import { Text, colors, minimumTouchTarget, radii, spacing } from '@/design-system';

type Props = Readonly<{
  checked: boolean;
  label: string;
  onPress(): void;
  onOpenDocument(): void;
}>;

export function Acknowledgement({ checked, label, onOpenDocument, onPress }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onPress}
        style={styles.checkTarget}
      >
        <View style={[styles.checkbox, checked && styles.checked]}>
          <Text style={styles.mark}>{checked ? '✓' : ''}</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={onOpenDocument} style={styles.linkTarget}>
        <Text style={styles.link}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  checkTarget: {
    alignItems: 'center',
    height: minimumTouchTarget,
    justifyContent: 'center',
    width: minimumTouchTarget,
  },
  checked: { backgroundColor: colors.brandPrimary },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.brandPrimary,
    borderRadius: radii.sm,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  link: {
    color: colors.brandPrimary,
    fontSize: 15,
    lineHeight: 21,
    textDecorationLine: 'underline',
  },
  linkTarget: { flex: 1, justifyContent: 'center', minHeight: minimumTouchTarget },
  mark: { color: colors.white, fontWeight: '900', lineHeight: 20 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
});
