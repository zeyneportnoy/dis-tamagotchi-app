import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackButton, Button, Screen, Text, colors, radii, spacing } from '@/design-system';
import { useAuth } from '@/features/auth';

const ICON = '#B4A7E6';

function IconMail() {
  return (
    <View style={iconStyles.mailBox}>
      <View style={iconStyles.mailFlap} />
    </View>
  );
}

type FieldProps = TextInputProps & { label: string; icon: ReactNode };

function AuthField({ label, icon, ...rest }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <View style={styles.inputIcon}>{icon}</View>
        <TextInput
          placeholderTextColor="#A9A4C6"
          selectionColor={colors.brandPrimary}
          style={styles.input}
          {...rest}
        />
      </View>
    </View>
  );
}

function LockIllustration() {
  return (
    <View style={styles.illustration}>
      <View pointerEvents="none" style={styles.illustrationDecor}>
        <View style={[styles.cloud, styles.cloudLeft]} />
        <View style={[styles.cloud, styles.cloudRight]} />
        <View style={[styles.leaf, styles.leafOne]} />
        <View style={[styles.leaf, styles.leafTwo]} />
        <View style={[styles.leaf, styles.leafThree]} />
        <View style={[styles.sparkle, styles.sparkleOne]} />
        <View style={[styles.sparkle, styles.sparkleTwo]} />
        <View style={[styles.sparkle, styles.sparkleThree]} />
        <View style={[styles.sparkle, styles.sparkleFour]} />
      </View>

      <View style={styles.lock}>
        <View style={styles.lockShackle} />
        <View style={styles.lockBody}>
          <View style={styles.lockKeyholeCircle} />
          <View style={styles.lockKeyholeStem} />
        </View>
      </View>

      <View style={styles.heart}>
        <View style={[styles.heartLobe, styles.heartLobeLeft]} />
        <View style={[styles.heartLobe, styles.heartLobeRight]} />
        <View style={styles.heartTip} />
      </View>
    </View>
  );
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { configured, useCases } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<'rate-limit' | 'general' | null>(null);

  const submit = async (): Promise<void> => {
    setSending(true);
    setError(null);
    try {
      await useCases?.sendPasswordReset({ email });
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === 'AUTH_RATE_LIMIT' ? 'rate-limit' : 'general',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View pointerEvents="none" style={styles.pageBlobs}>
        <View style={styles.blobLavender} />
        <View style={styles.blobBlue} />
        <View style={styles.blobPink} />
        <View style={styles.blobMint} />
        <View style={[styles.pageSparkle, styles.pageSparkleLeft]} />
        <View style={[styles.pageSparkle, styles.pageSparkleRight]} />
        <View style={[styles.pageCloud, styles.pageCloudBottom]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backRow}>
            <BackButton fallbackHref="/onboarding" testID="auth-back-button" />
          </View>

          <LockIllustration />

          <View style={styles.copy}>
            <Text style={styles.title} variant="title">
              {t('auth.forgotTitle')}
            </Text>
            <Text style={styles.body}>{t('auth.forgotBody')}</Text>
          </View>

          <View style={styles.card}>
            <AuthField
              accessibilityLabel={t('auth.email')}
              autoCapitalize="none"
              autoComplete="email"
              icon={<IconMail />}
              keyboardType="email-address"
              label={t('auth.email')}
              onChangeText={setEmail}
              placeholder={t('auth.email')}
              value={email}
            />
            {sent ? <Text style={styles.info}>{t('auth.resetGeneric')}</Text> : null}
            {error ? (
              <Text style={styles.error}>
                {t(error === 'rate-limit' ? 'auth.emailRateLimit' : 'auth.resetError')}
              </Text>
            ) : null}
            {!configured ? (
              <Text style={styles.notice}>{t('auth.configMissingBody')}</Text>
            ) : null}
            <Button
              disabled={!configured || sent || sending}
              label={t(sending ? 'common.saving' : 'auth.sendReset')}
              onPress={() => void submit()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const iconStyles = StyleSheet.create({
  mailBox: {
    borderColor: ICON,
    borderRadius: 4,
    borderWidth: 1.6,
    height: 15,
    overflow: 'hidden',
    width: 20,
  },
  mailFlap: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 9,
    borderRightColor: 'transparent',
    borderRightWidth: 9,
    borderTopColor: ICON,
    borderTopWidth: 8,
  },
});

const styles = StyleSheet.create({
  backRow: { alignSelf: 'flex-start', paddingTop: spacing.xs },
  blobBlue: {
    backgroundColor: 'rgba(177, 220, 255, 0.34)',
    borderRadius: radii.pill,
    height: 300,
    position: 'absolute',
    right: -120,
    top: '14%',
    width: 300,
  },
  blobLavender: {
    backgroundColor: 'rgba(210, 194, 255, 0.4)',
    borderRadius: radii.pill,
    height: 340,
    left: -150,
    position: 'absolute',
    top: -120,
    width: 340,
  },
  blobMint: {
    backgroundColor: 'rgba(190, 240, 222, 0.26)',
    borderRadius: radii.pill,
    bottom: -150,
    height: 320,
    left: '10%',
    position: 'absolute',
    width: 320,
  },
  blobPink: {
    backgroundColor: 'rgba(255, 190, 220, 0.3)',
    borderRadius: radii.pill,
    bottom: '6%',
    height: 240,
    position: 'absolute',
    right: -80,
    width: 240,
  },
  body: { color: '#5F6472', maxWidth: 320, textAlign: 'center' },
  card: {
    backgroundColor: colors.white,
    borderColor: 'rgba(108, 92, 231, 0.08)',
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: '#8875D8',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    width: '100%',
  },
  cloud: {
    backgroundColor: 'rgba(214, 234, 255, 0.7)',
    borderRadius: radii.pill,
    position: 'absolute',
  },
  cloudLeft: { bottom: 6, height: 30, left: 2, width: 74 },
  cloudRight: { bottom: 12, height: 26, right: 0, width: 66 },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  copy: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  error: { color: colors.brandSecondary, fontWeight: '700', textAlign: 'center' },
  field: { gap: spacing.xs, width: '100%' },
  fieldLabel: {
    color: colors.navy,
    fontFamily: 'Baloo2',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
  flex: { flex: 1 },
  heart: {
    bottom: '20%',
    height: 22,
    position: 'absolute',
    right: '24%',
    width: 24,
  },
  heartLobe: {
    backgroundColor: '#FF9DB6',
    borderRadius: 7,
    height: 14,
    position: 'absolute',
    top: 0,
    width: 14,
  },
  heartLobeLeft: { left: 0 },
  heartLobeRight: { right: 0 },
  heartTip: {
    backgroundColor: '#FF9DB6',
    height: 15,
    left: 4.5,
    position: 'absolute',
    top: 5,
    transform: [{ rotate: '45deg' }],
    width: 15,
  },
  illustration: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 176,
    justifyContent: 'center',
    width: 240,
  },
  illustrationDecor: { ...StyleSheet.absoluteFillObject },
  info: { color: colors.success, fontWeight: '600', textAlign: 'center' },
  input: {
    color: colors.navy,
    flex: 1,
    fontFamily: 'Manrope',
    fontSize: 16,
    paddingVertical: spacing.sm,
  },
  inputIcon: { alignItems: 'center', justifyContent: 'center', paddingRight: spacing.sm, width: 26 },
  inputRow: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#E6E1FA',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  leaf: {
    backgroundColor: 'rgba(178, 224, 190, 0.9)',
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 12,
    height: 12,
    position: 'absolute',
    width: 22,
  },
  leafOne: { left: 20, top: 66, transform: [{ rotate: '18deg' }] },
  leafThree: { left: 30, top: 96, transform: [{ rotate: '20deg' }] },
  leafTwo: { left: 8, top: 84, transform: [{ rotate: '-22deg' }] },
  lock: { alignItems: 'center' },
  lockBody: {
    alignItems: 'center',
    backgroundColor: '#BCA9EC',
    borderRadius: 22,
    height: 74,
    justifyContent: 'center',
    marginTop: -6,
    width: 96,
  },
  lockKeyholeCircle: {
    backgroundColor: '#7C68B8',
    borderRadius: 9,
    height: 18,
    width: 18,
  },
  lockKeyholeStem: {
    backgroundColor: '#7C68B8',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    height: 14,
    marginTop: -3,
    width: 9,
  },
  lockShackle: {
    borderBottomWidth: 0,
    borderColor: '#C7B8F0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 12,
    height: 44,
    width: 58,
  },
  notice: { color: colors.brandSecondary, textAlign: 'center' },
  pageBlobs: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  pageCloud: {
    backgroundColor: 'rgba(214, 234, 255, 0.5)',
    borderRadius: radii.pill,
    position: 'absolute',
  },
  pageCloudBottom: { bottom: '4%', height: 60, left: -30, width: 150 },
  pageSparkle: {
    backgroundColor: 'rgba(151, 126, 232, 0.3)',
    borderRadius: 2,
    height: 12,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  pageSparkleLeft: { left: spacing.lg, top: '46%' },
  pageSparkleRight: { right: spacing.xl, top: '30%' },
  screen: { backgroundColor: '#FBFAFF', gap: 0, padding: 0 },
  sparkle: {
    backgroundColor: 'rgba(180, 158, 240, 0.85)',
    borderRadius: 2,
    height: 9,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 9,
  },
  sparkleFour: { bottom: 18, right: 30, height: 7, width: 7 },
  sparkleOne: { left: 22, top: 14 },
  sparkleThree: { left: 34, top: 120, height: 7, width: 7 },
  sparkleTwo: { right: 26, top: 30 },
  title: { color: colors.textPrimary, textAlign: 'center' },
});
