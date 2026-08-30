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

import { BackButton, Button, Screen, Text, colors, radii, spacing } from '@/design-system';
import { useAuth } from '@/features/auth';

const ICON = '#B4A7E6';

// Real glossy 3D DentHero tooth renders (assets/characters/generated) — a plain
// molar as the protective parent and a winking one as the child. Not any of the
// 8 Welcome-screen characters.
const parentTooth = require('../../assets/characters/generated/molar-01-v2.png');
const childTooth = require('../../assets/characters/generated/molar-02.png');

/**
 * "Veli girişi" hero: one large parent tooth + one smaller child tooth beside
 * it in a warm, protective side-by-side pose, with a soft lilac sash on the
 * parent as the integrated safety cue. No separate lock/shield badge.
 */
function ParentChildHero() {
  return (
    <View style={styles.scene}>
      <View style={styles.pedestal} />

      <View style={styles.sceneHeart}>
        <View style={[styles.heartLobe, styles.heartLobeLeft]} />
        <View style={[styles.heartLobe, styles.heartLobeRight]} />
        <View style={styles.heartTip} />
      </View>
      <View style={[styles.sceneSparkle, styles.sceneSparkleA]} />
      <View style={[styles.sceneSparkle, styles.sceneSparkleB]} />

      <View style={styles.pair}>
        <View style={styles.parentWrap}>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={parentTooth}
            style={styles.parentImg}
          />
          <View style={styles.sash} />
          <View style={styles.sashKnot} />
        </View>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={childTooth}
          style={styles.childImg}
        />
      </View>
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

export default function LoginScreen() {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const { configured, useCases } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const heroHeight = Math.min(288, Math.max(216, Math.round(height * 0.29)));

  const submit = async (): Promise<void> => {
    if (!useCases || saving) return setFailed(true);
    setSaving(true);
    setFailed(false);
    try {
      const session = await useCases.signIn({ email, password });
      router.replace(session.emailVerified ? '/' : '/auth/verify-email');
    } catch {
      setFailed(true);
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
            <View pointerEvents="none" style={styles.heroBlobs}>
              <View style={styles.heroGlowPink} />
              <View style={styles.heroGlowBlue} />
              <View style={styles.heroGlowWarm} />
              <View style={[styles.heroSparkle, styles.heroSparkleOne]} />
              <View style={[styles.heroSparkle, styles.heroSparkleTwo]} />
            </View>
            <ParentChildHero />
          </View>

          <View style={styles.copy}>
            <Text style={styles.title} variant="title">
              {t('auth.loginTitle')}
            </Text>
            <Text style={styles.body}>{t('auth.loginBody')}</Text>
          </View>

          <View style={styles.card}>
            {!configured ? (
              <Text style={styles.notice}>{t('auth.configMissingBody')}</Text>
            ) : null}
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
              autoComplete="current-password"
              icon={<IconLock />}
              label={t('auth.password')}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              secure
              value={password}
            />
            {failed ? (
              <Text style={styles.error}>
                {configured ? t('auth.invalidCredentials') : t('auth.configMissingBody')}
              </Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button
              disabled={saving || !configured}
              label={t('auth.login')}
              onPress={() => void submit()}
            />
            <Button
              label={t('auth.forgotPassword')}
              onPress={() => router.push('/auth/forgot-password')}
              variant="secondary"
            />
            <Button
              label={t('auth.noAccount')}
              onPress={() => router.replace('/auth/signup')}
              variant="secondary"
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
  heroBlobs: { ...StyleSheet.absoluteFillObject },
  heroGlowBlue: {
    backgroundColor: 'rgba(171, 220, 255, 0.6)',
    borderRadius: radii.pill,
    height: 200,
    position: 'absolute',
    right: -56,
    top: -48,
    width: 200,
  },
  heroGlowPink: {
    backgroundColor: 'rgba(255, 190, 220, 0.55)',
    borderRadius: radii.pill,
    height: 190,
    left: -52,
    position: 'absolute',
    top: -44,
    width: 190,
  },
  heroGlowWarm: {
    backgroundColor: 'rgba(255, 235, 168, 0.45)',
    borderRadius: radii.pill,
    bottom: -70,
    height: 200,
    left: '24%',
    position: 'absolute',
    width: 200,
  },
  heroSparkle: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 2,
    height: 9,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 9,
  },
  heroSparkleOne: { left: '10%', top: '16%' },
  heroSparkleTwo: { right: '11%', top: '40%' },
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
  childImg: { height: 118, marginBottom: 6, marginLeft: -14, width: 108, zIndex: 1 },
  heartLobe: {
    backgroundColor: '#FF9DB6',
    borderRadius: 6,
    height: 12,
    position: 'absolute',
    top: 0,
    width: 12,
  },
  heartLobeLeft: { left: 0 },
  heartLobeRight: { right: 0 },
  heartTip: {
    backgroundColor: '#FF9DB6',
    height: 12,
    left: 4,
    position: 'absolute',
    top: 4,
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  pair: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 6,
  },
  parentImg: { height: 168, width: 168 },
  parentWrap: { alignItems: 'center', zIndex: 2 },
  pedestal: {
    alignSelf: 'center',
    backgroundColor: 'rgba(150, 128, 214, 0.16)',
    borderRadius: radii.pill,
    bottom: 14,
    height: 30,
    position: 'absolute',
    width: 200,
  },
  sash: {
    backgroundColor: 'rgba(124, 104, 220, 0.9)',
    borderRadius: 8,
    height: 15,
    position: 'absolute',
    top: '52%',
    transform: [{ rotate: '-6deg' }],
    width: 132,
  },
  sashKnot: {
    backgroundColor: 'rgba(108, 88, 200, 0.95)',
    borderRadius: 5,
    height: 15,
    position: 'absolute',
    right: 22,
    top: '55%',
    transform: [{ rotate: '45deg' }],
    width: 15,
  },
  scene: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 14,
    position: 'relative',
  },
  sceneHeart: { height: 18, left: '19%', position: 'absolute', top: 20, width: 20 },
  sceneSparkle: {
    backgroundColor: 'rgba(180, 158, 240, 0.85)',
    borderRadius: 2,
    height: 8,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 8,
  },
  sceneSparkleA: { right: '20%', top: 32 },
  sceneSparkleB: { right: '13%', top: '50%' },
  title: { color: colors.textPrimary, textAlign: 'center' },
});
