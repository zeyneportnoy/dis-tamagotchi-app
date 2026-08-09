import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text } from '@/design-system';
import { AuthScaffold, useAuth } from '@/features/auth';

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
    <AuthScaffold body={t('auth.forgotBody')} title={t('auth.forgotTitle')}>
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
      {sent ? <Text>{t('auth.resetGeneric')}</Text> : null}
      {error ? (
        <Text>{t(error === 'rate-limit' ? 'auth.emailRateLimit' : 'auth.resetError')}</Text>
      ) : null}
      {!configured ? <Text>{t('auth.configMissingBody')}</Text> : null}
      <Button
        disabled={!configured || sent || sending}
        label={t(sending ? 'common.saving' : 'auth.sendReset')}
        onPress={() => void submit()}
      />
    </AuthScaffold>
  );
}
