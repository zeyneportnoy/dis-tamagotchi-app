import { Text as NativeText, type TextProps as NativeTextProps, StyleSheet } from 'react-native';

import { colors, typography } from '../theme';

type Props = NativeTextProps & { variant?: 'body' | 'title' | 'subtitle' | 'label' | 'caption' };

export function Text({ style, variant = 'body', ...props }: Props) {
  return <NativeText style={[styles.base, styles[variant], style]} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    color: colors.navy,
    fontFamily: typography.family.body,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
  },
  body: {},
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.title,
    fontWeight: '700',
    lineHeight: typography.lineHeight.title,
  },
  subtitle: {
    fontFamily: typography.family.display,
    fontSize: typography.size.subtitle,
    fontWeight: '700',
    lineHeight: 27,
  },
  label: { fontSize: typography.size.label, fontWeight: '700', lineHeight: 21 },
  caption: {
    color: '#5D6470',
    fontSize: typography.size.caption,
    fontWeight: '600',
    lineHeight: typography.lineHeight.caption,
  },
});
