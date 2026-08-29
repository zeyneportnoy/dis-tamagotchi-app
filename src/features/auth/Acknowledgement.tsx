import { Pressable, StyleSheet, View } from 'react-native';

import { Text, colors, minimumTouchTarget, radii, spacing } from '@/design-system';

type Props = Readonly<{
  checked: boolean;
  label: string;
  linkLabel?: string;
  onPress(): void;
  onOpenDocument?: () => void;
  trailingLabel?: string;
}>;

export function Acknowledgement({
  checked,
  label,
  linkLabel,
  onOpenDocument,
  onPress,
  trailingLabel,
}: Props) {
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
      {onOpenDocument ? (
        <Text style={styles.label}>
          <Text accessibilityRole="link" onPress={onOpenDocument} style={styles.link}>
            {linkLabel ?? label}
          </Text>
          {trailingLabel}
        </Text>
      ) : (
        <Text onPress={onPress} style={styles.label}>
          {label}
        </Text>
      )}
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
  label: { flex: 1, minHeight: minimumTouchTarget, paddingVertical: spacing.sm },
  mark: { color: colors.white, fontWeight: '900', lineHeight: 20 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
});
