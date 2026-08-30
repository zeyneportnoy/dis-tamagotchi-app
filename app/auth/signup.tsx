import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ZodError } from 'zod';

import { BackButton, Button, Screen, Text, colors, radii, spacing } from '@/design-system';
import { Acknowledgement, useAuth } from '@/features/auth';

const ICON = '#B4A7E6';
const parentSignupHero = require('../../assets/auth/parent-signup-hero.png');

function IconUser() {
  return (
    <View style={iconStyles.userWrap}>
      <View style={iconStyles.userHead} />
      <View style={iconStyles.userBody} />
    </View>
  );
}

function IconMail() {
  return (
    <View style={iconStyles.mailBox}>
      <View style={iconStyles.mailFlap} />
    </View>
  );
}

function IconLock() {
  return (
    <View style={iconStyles.lockWrap}>
      <View style={iconStyles.lockShackle} />
      <View style={iconStyles.lockBody} />
    </View>
  );
}

function IconEye({ off }: { off?: boolean }) {
  return (
    <View style={iconStyles.eyeOuter}>
      <View style={iconStyles.eyePupil} />
      {off ? <View style={iconStyles.eyeSlash} /> : null}
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  icon: ReactNode;
  secure?: boolean;
};

function AuthField({ label, icon, secure = false, ...rest }: FieldProps) {
  const [hidden, setHidden] = useState(true);
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
          secureTextEntry={secure ? hidden : rest.secureTextEntry}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setHidden((value) => !value)}
            style={styles.eyeButton}
          >
            <IconEye off={!hidden} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const { configured, useCases } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [passwordTooShort, setPasswordTooShort] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const heroHeight = Math.min(276, Math.max(208, Math.round(height * 0.27)));

  const submit = async (): Promise<void> => {
    if (!useCases || saving) return setFailed(true);
    setSaving(true);
    setFailed(false);
    setPasswordTooShort(false);
    setPasswordMismatch(false);
    try {
      const session = await useCases.signUp({
        displayName,
        email,
        password,
        passwordConfirmation,
        termsAccepted,
        privacyAcknowledged,
      });
      router.replace({
        pathname: '/auth/verify-email',
        params: { email: session?.email ?? email.trim().toLowerCase() },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        setPasswordTooShort(
          error.issues.some((issue) => issue.path[0] === 'password' && issue.code === 'too_small'),
        );
        setPasswordMismatch(
          error.issues.some(
            (issue) =>
              issue.path[0] === 'passwordConfirmation' && issue.message === 'PASSWORD_MISMATCH',
          ),
        );
      } else {
        setFailed(true);
      }
      setSaving(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View pointerEvents="none" style={styles.pageBlobs}>
        <View style={styles.blobLavender} />
        <View style={styles.blobBlue} />
        <View style={styles.blobPink} />
        <View style={styles.blobMint} />
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

          <View style={[styles.hero, { height: heroHeight }]}> 
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={parentSignupHero}
              style={styles.heroImage}
            />
          </View>

          <View style={styles.copy}>
            <Text style={styles.title} variant="title">
              {t('auth.signupTitle')}
            </Text>
            <Text style={styles.body}>{t('auth.signupBody')}</Text>
          </View>

          <View style={styles.card}>
            {!configured ? (
              <Text style={styles.notice}>{t('auth.configMissingBody')}</Text>
            ) : null}
            <AuthField
              accessibilityLabel={t('auth.displayName')}
              autoComplete="name"
              icon={<IconUser />}
              label={t('auth.displayName')}
              onChangeText={setDisplayName}
              placeholder={t('auth.displayName')}
              value={displayName}
            />
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
            <AuthField
              accessibilityLabel={t('auth.password')}
              autoComplete="new-password"
              icon={<IconLock />}
              label={t('auth.password')}
              onChangeText={(value) => {
                setPassword(value);
                setPasswordTooShort(false);
                setPasswordMismatch(false);
              }}
              placeholder={t('auth.password')}
              secure
              value={password}
            />
            <AuthField
              accessibilityLabel={t('auth.passwordConfirmation')}
              autoComplete="new-password"
              icon={<IconLock />}
              label={t('auth.passwordConfirmation')}
              onChangeText={(value) => {
                setPasswordConfirmation(value);
                setPasswordMismatch(false);
              }}
              placeholder={t('auth.passwordConfirmation')}
              secure
              value={passwordConfirmation}
            />
            {passwordMismatch ? (
              <Text style={styles.error}>{t('auth.passwordMismatch')}</Text>
            ) : null}
            <Text style={styles.helper}>
              {passwordTooShort ? t('auth.passwordTooShort') : t('auth.passwordHint')}
            </Text>

            <View style={styles.consent}>
              <Acknowledgement
                checked={termsAccepted}
                label={t('auth.termsAcknowledgement')}
                linkLabel={t('auth.termsDocumentLink')}
                onOpenDocument={() => router.push('/legal/terms')}
                onPress={() => setTermsAccepted((value) => !value)}
                trailingLabel={t('auth.termsAcknowledgementSuffix')}
              />
              <Acknowledgement
                checked={privacyAcknowledged}
                label={t('auth.privacyAcknowledgement')}
                linkLabel={t('auth.privacyDocumentLink')}
                onOpenDocument={() => router.push('/legal/privacy')}
                onPress={() => setPrivacyAcknowledged((value) => !value)}
                trailingLabel={t('auth.privacyAcknowledgementSuffix')}
              />
              <Acknowledgement
                checked={guardianConfirmed}
                label={t('auth.guardianConsent.checkbox')}
                onPress={() => setGuardianConfirmed((value) => !value)}
              />
            </View>

            {failed ? (
              <Text style={styles.error}>
                {configured ? t('auth.signupError') : t('auth.configMissingBody')}
              </Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button
              disabled={
                saving ||
                !configured ||
                !termsAccepted ||
                !privacyAcknowledged ||
                !guardianConfirmed
              }
              label={t('auth.createAccount')}
              onPress={() => void submit()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const iconStyles = StyleSheet.create({
  eyeOuter: {
    alignItems: 'center',
    borderColor: ICON,
    borderRadius: 9,
    borderWidth: 1.6,
    height: 13,
    justifyContent: 'center',
    width: 21,
  },
  eyePupil: { backgroundColor: ICON, borderRadius: 3, height: 6, width: 6 },
  eyeSlash: {
    backgroundColor: ICON,
    height: 1.6,
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
    width: 26,
  },
  lockBody: {
    borderColor: ICON,
    borderRadius: 3,
    borderWidth: 1.6,
    height: 12,
    marginTop: 6,
    width: 16,
  },
  lockShackle: {
    borderBottomWidth: 0,
    borderColor: ICON,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 1.6,
    height: 8,
    position: 'absolute',
    top: 0,
    width: 10,
  },
  lockWrap: { alignItems: 'center', height: 18, justifyContent: 'flex-end', width: 18 },
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
  userBody: {
    borderBottomWidth: 0,
    borderColor: ICON,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 1.6,
    height: 9,
    marginTop: 2,
    width: 17,
  },
  userHead: { borderColor: ICON, borderRadius: 5, borderWidth: 1.6, height: 9, width: 9 },
  userWrap: { alignItems: 'center', width: 18 },
});

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, width: '100%' },
  backRow: { alignSelf: 'flex-start', paddingTop: spacing.xs },
  blobBlue: {
    backgroundColor: 'rgba(177, 220, 255, 0.36)',
    borderRadius: radii.pill,
    height: 300,
    position: 'absolute',
    right: -120,
    top: '16%',
    width: 300,
  },
  blobLavender: {
    backgroundColor: 'rgba(210, 194, 255, 0.4)',
    borderRadius: radii.pill,
    height: 340,
    left: -150,
    position: 'absolute',
    top: -110,
    width: 340,
  },
  blobMint: {
    backgroundColor: 'rgba(190, 240, 222, 0.28)',
    borderRadius: radii.pill,
    bottom: -140,
    height: 320,
    left: '14%',
    position: 'absolute',
    width: 320,
  },
  blobPink: {
    backgroundColor: 'rgba(255, 190, 220, 0.32)',
    borderRadius: radii.pill,
    bottom: '8%',
    height: 220,
    position: 'absolute',
    right: -70,
    width: 220,
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
  consent: { gap: spacing.xs },
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
  eyeButton: { alignItems: 'center', justifyContent: 'center', paddingLeft: spacing.sm },
  field: { gap: spacing.xs, width: '100%' },
  fieldLabel: {
    color: colors.navy,
    fontFamily: 'Baloo2',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
  flex: { flex: 1 },
  helper: { color: '#8A8FA0', fontSize: 13, paddingHorizontal: spacing.xs },
  hero: {
    backgroundColor: '#EEEBFF',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 34,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#8875D8',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    width: '100%',
  },
  heroImage: { height: '100%', width: '100%' },
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
  notice: { color: colors.brandSecondary, textAlign: 'center' },
  pageBlobs: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  screen: { backgroundColor: '#FBFAFF', gap: 0, padding: 0 },
  title: { color: colors.textPrimary, textAlign: 'center' },
});
