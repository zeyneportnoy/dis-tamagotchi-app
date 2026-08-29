import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZodError } from 'zod';

import { Button, Input, Text } from '@/design-system';
import { Acknowledgement, AuthScaffold, useAuth } from '@/features/auth';

export default function SignUpScreen() {
  const { t } = useTranslation();
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
    <AuthScaffold body={t('auth.signupBody')} title={t('auth.signupTitle')}>
      {!configured ? <Text>{t('auth.configMissingBody')}</Text> : null}
      <Input
        accessibilityLabel={t('auth.displayName')}
        autoComplete="name"
        label={t('auth.displayName')}
        onChangeText={setDisplayName}
        placeholder={t('auth.displayName')}
        value={displayName}
      />
      <Input
        accessibilityLabel={t('auth.email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        label={t('auth.email')}
        onChangeText={setEmail}
        placeholder={t('auth.email')}
        value={email}
      />
      <Input
        accessibilityLabel={t('auth.password')}
        autoComplete="new-password"
        label={t('auth.password')}
        onChangeText={(value) => {
          setPassword(value);
          setPasswordTooShort(false);
          setPasswordMismatch(false);
        }}
        placeholder={t('auth.password')}
        secureTextEntry
        value={password}
      />
      <Text>{passwordTooShort ? t('auth.passwordTooShort') : t('auth.passwordHint')}</Text>
      <Input
        accessibilityLabel={t('auth.passwordConfirmation')}
        autoComplete="new-password"
        label={t('auth.passwordConfirmation')}
        onChangeText={(value) => {
          setPasswordConfirmation(value);
          setPasswordMismatch(false);
        }}
        placeholder={t('auth.passwordConfirmation')}
        secureTextEntry
        value={passwordConfirmation}
      />
      {passwordMismatch ? <Text>{t('auth.passwordMismatch')}</Text> : null}
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
      {failed ? (
        <Text>{configured ? t('auth.signupError') : t('auth.configMissingBody')}</Text>
      ) : null}
      <Button
        disabled={
          saving || !configured || !termsAccepted || !privacyAcknowledged || !guardianConfirmed
        }
        label={t('auth.createAccount')}
        onPress={() => void submit()}
      />
    </AuthScaffold>
  );
}
