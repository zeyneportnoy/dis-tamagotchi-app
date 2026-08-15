import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/design-system';
import { AuthScaffold, useAuth } from '@/features/auth';

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

  useEffect(() => {
    if (session?.emailVerified) router.replace('/');
  }, [session?.emailVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async (): Promise<void> => {
    if (!useCases || cooldown > 0 || !email) return;
    await useCases.resendVerification(email);
    setSent(true);
    setCooldown(30);
  };

  return (
    <AuthScaffold
      body={t('auth.verifyBody', { email: maskEmail(email) })}
      title={t('auth.verifyTitle')}
    >
      {sent ? <Text>{t('auth.resendSent')}</Text> : null}
      {cooldown > 0 ? <Text>{t('auth.cooldown', { seconds: cooldown })}</Text> : null}
      <Button disabled={cooldown > 0} label={t('auth.resend')} onPress={() => void resend()} />
      <Button
        label={t('auth.changeEmail')}
        onPress={() => router.replace('/auth/signup')}
        variant="secondary"
      />
      <Button
        label={t('auth.backToLogin')}
        onPress={() => router.replace('/auth/login')}
        variant="secondary"
      />
    </AuthScaffold>
  );
}
