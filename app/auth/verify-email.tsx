import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackButton, Screen, Text, colors, radii, spacing, typography } from '@/design-system';
import { useAuth } from '@/features/auth';

type VerificationButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

function VerificationButton({
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: VerificationButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' ? styles.secondaryButton : styles.primaryButton,
        pressed && styles.pressedButton,
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={[styles.buttonLabel, variant === 'secondary' && styles.secondaryButtonLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const maskEmail = (email: string): string => {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
};

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const { session, useCases } = useAuth();
  const email = useMemo(() => params.email ?? session?.email ?? '', [params.email, session?.email]);
  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.emailVerified) router.replace('/');
  }, [session?.emailVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async (): Promise<void> => {
    if (!useCases || cooldown > 0 || sending || !email) return;
    setSending(true);
    setError(null);
    setSent(false);
    try {
      await useCases.resendVerification(email);
      setSent(true);
    } catch (err) {
      // A failed send must never look like success. Surface the reason instead
      // of letting the rejection get swallowed by `void resend()`.
      setError(
        err instanceof Error && err.message === 'AUTH_RATE_LIMIT'
          ? t('auth.emailRateLimit')
          : t('auth.resetError'),
      );
    } finally {
      // Throttle every attempt — success or failure — so rapid re-taps can't
      // stack requests straight into Supabase's rate limiter.
      setCooldown(30);
      setSending(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.back}>
        <BackButton fallbackHref="/onboarding" testID="auth-back-button" />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
              style={styles.iconTile}
            >
              <View style={styles.envelope}>
                <View style={styles.envelopeFlap} />
              </View>
              <Text style={styles.sparkle}>✦</Text>
            </View>
            <View style={styles.copy}>
              <Text style={styles.title} variant="title">
                {t('auth.verifyTitle')}
              </Text>
              <Text style={styles.body}>
                {t('auth.verifyBody', { email: maskEmail(email) })}
              </Text>
            </View>
            <View style={styles.actions}>
              {sent ? <Text style={styles.notice}>{t('auth.resendSent')}</Text> : null}
              {error ? <Text style={styles.notice}>{error}</Text> : null}
              {cooldown > 0 ? (
                <Text style={styles.notice}>{t('auth.cooldown', { seconds: cooldown })}</Text>
              ) : null}
              <VerificationButton
                disabled={cooldown > 0 || sending}
                label={t('auth.resend')}
                onPress={() => void resend()}
              />
              <VerificationButton
                label={t('auth.changeEmail')}
                onPress={() => router.replace('/auth/signup')}
                variant="secondary"
              />
              <VerificationButton
                label={t('auth.backToLogin')}
                onPress={() => router.replace('/auth/login')}
                variant="secondary"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 14, marginTop: spacing.xl, width: '100%' },
  back: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    marginHorizontal: 20,
    marginTop: spacing.sm,
    zIndex: 2,
  },
  body: { color: '#625D77', textAlign: 'center' },
  button: {
    alignItems: 'center',
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: colors.white,
    fontFamily: typography.family.display,
    fontSize: typography.button,
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FDFCFF',
    borderColor: colors.white,
    borderRadius: 36,
    borderWidth: 1,
    marginTop: 56,
    maxWidth: 420,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    shadowColor: '#8875D8',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    width: '100%',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
  },
  copy: { alignItems: 'center', gap: 12, marginTop: 28, width: '100%' },
  disabledButton: { opacity: 0.5 },
  envelope: {
    backgroundColor: '#EDE6FF',
    borderColor: colors.brandPrimary,
    borderRadius: 8,
    borderWidth: 2.5,
    height: 42,
    overflow: 'hidden',
    width: 58,
  },
  envelopeFlap: {
    borderBottomRightRadius: 5,
    borderBottomWidth: 2.5,
    borderColor: colors.brandPrimary,
    borderRightWidth: 2.5,
    height: 38,
    left: 7.5,
    position: 'absolute',
    top: -23,
    transform: [{ rotate: '45deg' }],
    width: 38,
  },
  flex: { flex: 1 },
  iconTile: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 32,
    elevation: 4,
    height: 120,
    justifyContent: 'center',
    marginTop: -88,
    shadowColor: '#8875D8',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    width: 120,
  },
  notice: { color: '#625D77', textAlign: 'center' },
  pressedButton: { opacity: 0.8 },
  primaryButton: {
    backgroundColor: '#8B70F5',
    shadowColor: colors.brandPrimary,
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  screen: { backgroundColor: '#F1EEFF', gap: spacing.sm, justifyContent: 'flex-start', padding: 0 },
  secondaryButton: {
    backgroundColor: colors.white,
    borderColor: '#B5A0F5',
    borderWidth: 1.5,
  },
  secondaryButtonLabel: { color: colors.brandPrimary },
  sparkle: {
    color: '#A587EC',
    fontSize: 26,
    lineHeight: 32,
    position: 'absolute',
    right: 14,
    top: 17,
  },
  title: { color: '#34256F', textAlign: 'center' },
});
