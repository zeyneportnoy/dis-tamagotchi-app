import { Pressable, StyleSheet } from 'react-native';

import { colors, minimumTouchTarget, radii, spacing, typography } from '../theme';
import { Text } from './Text';

type Props = { label: string; onPress: () => void; disabled?: boolean; testID?: string };

export function Button({ disabled = false, label, onPress, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, disabled && styles.disabled]}
      testID={testID}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  disabled: { opacity: 0.5 },
  label: { color: colors.white, fontSize: typography.button, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
