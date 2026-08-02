import { Text as NativeText, type TextProps as NativeTextProps, StyleSheet } from 'react-native';

import { colors, typography } from '../theme';

type Props = NativeTextProps & { variant?: 'body' | 'title' };

export function Text({ style, variant = 'body', ...props }: Props) {
  return <NativeText style={[styles.base, styles[variant], style]} {...props} />;
}

const styles = StyleSheet.create({
  base: { color: colors.navy, fontSize: typography.body, lineHeight: 26 },
  body: {},
  title: { fontSize: typography.title, fontWeight: '700', lineHeight: 40 },
});
