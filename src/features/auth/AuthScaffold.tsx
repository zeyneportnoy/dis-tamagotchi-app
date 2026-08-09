import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { BackButton, Screen, Text, colors, radii, spacing } from '@/design-system';

type Props = PropsWithChildren<{
  title: string;
  body?: string;
  back?: boolean;
}>;

export function AuthScaffold({ back = true, body, children, title }: Props) {
  return (
    <Screen style={styles.screen}>
      {back ? (
        <View style={styles.back}>
          <BackButton fallbackHref="/onboarding" testID="auth-back-button" />
        </View>
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🛡️</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.center} variant="title">
              {title}
            </Text>
            {body ? <Text style={styles.center}>{body}</Text> : null}
          </View>
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', flexShrink: 0, zIndex: 2 },
  badge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#DDF8F3',
    borderRadius: radii.pill,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  badgeIcon: { fontSize: 48, lineHeight: 58 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  center: { textAlign: 'center' },
  content: { flexGrow: 1, gap: spacing.md, justifyContent: 'center', paddingBottom: spacing.xl },
  copy: { gap: spacing.sm },
  flex: { flex: 1 },
  screen: { justifyContent: 'flex-start' },
});
