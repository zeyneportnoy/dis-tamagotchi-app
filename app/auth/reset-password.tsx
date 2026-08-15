import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZodError } from 'zod';

import { Button, ErrorState, Input, LoadingState, Text } from '@/design-system';
import { AuthScaffold, useAuth } from '@/features/auth';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const { useCases } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [complete, setComplete] = useState(false);
  const [callbackFailed, setCallbackFailed] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);
  const [passwordTooShort, setPasswordTooShort] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [callbackReady, setCallbackReady] = useState(false);
  const code = typeof params.code === 'string' ? params.code : undefined;
  const flowId = typeof params.sb_flow_id === 'string' ? params.sb_flow_id : undefined;
  const accessToken = typeof params.access_token === 'string' ? params.access_token : undefined;
  const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : undefined;

  useEffect(() => {
    if (!useCases) return;
    void useCases
      .handleCallback({ code, flowId, accessToken, refreshToken, type: 'recovery' })
      .then(() => setCallbackReady(true))
      .catch(async () => {
        // A successful exchange persists the recovery session. Reuse it if this
        // screen remounts after the one-time callback code has been consumed.
        const session = await useCases.getSession().catch(() => null);
        if (session) setCallbackReady(true);
        else setCallbackFailed(true);
      });
  }, [accessToken, code, flowId, refreshToken, useCases]);

  const submit = async (): Promise<void> => {
    setUpdateFailed(false);
    setPasswordTooShort(false);
    setPasswordMismatch(false);
    try {
      await useCases?.updatePassword({ password, passwordConfirmation: confirmation });
      setComplete(true);
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
        setUpdateFailed(true);
      }
    }
  };

  if (callbackFailed || !useCases) return <ErrorState body={t('auth.callbackError')} />;
  if (!callbackReady) return <LoadingState label={t('auth.callbackLoading')} />;

  return (
    <AuthScaffold title={t('auth.resetTitle')}>
      <Input
        accessibilityLabel={t('auth.password')}
        autoComplete="new-password"
        label={t('auth.password')}
        onChangeText={(value) => {
          setPassword(value);
          setPasswordTooShort(false);
          setPasswordMismatch(false);
          setUpdateFailed(false);
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
          setConfirmation(value);
          setPasswordMismatch(false);
          setUpdateFailed(false);
        }}
        placeholder={t('auth.passwordConfirmation')}
        secureTextEntry
        value={confirmation}
      />
      {passwordMismatch ? <Text>{t('auth.passwordMismatch')}</Text> : null}
      {updateFailed ? <Text>{t('auth.passwordUpdateError')}</Text> : null}
      {complete ? <Text>{t('auth.passwordUpdated')}</Text> : null}
      <Button
        label={complete ? t('auth.login') : t('auth.updatePassword')}
        onPress={() => (complete ? router.replace('/auth/login') : void submit())}
      />
    </AuthScaffold>
  );
}
