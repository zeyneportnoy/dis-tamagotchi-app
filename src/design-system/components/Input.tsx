import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { colors, minimumTouchTarget, radii, spacing, typography } from '../theme';

type Props = TextInputProps & { accessibilityLabel: string };

export function Input(props: Props) {
  return <TextInput placeholderTextColor={colors.navy} style={styles.input} {...props} />;
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.white,
    borderColor: colors.teal,
    borderRadius: radii.md,
    borderWidth: 2,
    color: colors.navy,
    fontSize: typography.body,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
