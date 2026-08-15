import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text } from '@/design-system';
import { AuthScaffold, useAuth } from '@/features/auth';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { configured, useCases } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

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
    <AuthScaffold body={t('auth.loginBody')} title={t('auth.loginTitle')}>
      {!configured ? <Text>{t('auth.configMissingBody')}</Text> : null}
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
        autoComplete="current-password"
        label={t('auth.password')}
        onChangeText={setPassword}
        placeholder={t('auth.password')}
        secureTextEntry
        value={password}
      />
      {failed ? (
        <Text>{configured ? t('auth.invalidCredentials') : t('auth.configMissingBody')}</Text>
      ) : null}
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
    </AuthScaffold>
  );
}
