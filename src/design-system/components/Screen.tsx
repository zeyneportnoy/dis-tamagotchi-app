import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme';

export function Screen({ children, style, ...props }: PropsWithChildren<SafeAreaViewProps>) {
  return (
    <SafeAreaView style={[styles.screen, style]} {...props}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.offWhite,
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
