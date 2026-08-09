import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/design-system';
import { useAuth } from '@/features/auth';

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const { useCases } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!useCases) return;
    void useCases
      .handleCallback({
        code: typeof params.code === 'string' ? params.code : undefined,
        flowId: typeof params.sb_flow_id === 'string' ? params.sb_flow_id : undefined,
        accessToken: typeof params.access_token === 'string' ? params.access_token : undefined,
        refreshToken: typeof params.refresh_token === 'string' ? params.refresh_token : undefined,
        type: typeof params.type === 'string' ? params.type : undefined,
      })
      .then(() => router.replace('/'))
      .catch(() => setFailed(true));
  }, [params, useCases]);

  return failed || !useCases ? (
    <ErrorState body={t('auth.callbackError')} />
  ) : (
    <LoadingState label={t('auth.callbackLoading')} />
  );
}
