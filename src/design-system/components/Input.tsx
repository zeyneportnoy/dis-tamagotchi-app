import { StyleSheet, Text as NativeText, TextInput, View, type TextInputProps } from 'react-native';

import { colors, minimumTouchTarget, radii, spacing, typography } from '../theme';

type Props = TextInputProps & { accessibilityLabel: string; label?: string };

export function Input({ label, placeholder, style, ...props }: Props) {
  return (
    <View style={styles.field}>
      {label ? <NativeText style={styles.label}>{label}</NativeText> : null}
      <TextInput
        placeholder={placeholder ?? label}
        placeholderTextColor={styles.placeholder.color}
        selectionColor={colors.brandPrimary}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs, width: '100%' },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.teal,
    borderRadius: radii.md,
    borderWidth: 2,
    color: colors.navy,
    fontFamily: typography.family.body,
    fontSize: typography.body,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    color: colors.navy,
    fontFamily: typography.family.display,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
  placeholder: { color: '#68767C' },
});
