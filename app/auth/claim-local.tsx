import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getProfileSyncUseCases } from '@/application/sync';
import { Button, Text } from '@/design-system';
import { AuthScaffold, useAuth } from '@/features/auth';

export default function ClaimLocalProfilesScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [failed, setFailed] = useState(false);

  const claim = async (): Promise<void> => {
    if (!session) return;
    const sync = await getProfileSyncUseCases();
    if (!sync) return setFailed(true);
    const count = await sync.claimLegacyProfiles(session.userId);
    if (count === 0) return setFailed(true);
    router.replace('/');
  };

  return (
    <AuthScaffold back={false} body={t('auth.claimBody')} title={t('auth.claimTitle')}>
      {failed ? <Text>{t('auth.claimError')}</Text> : null}
      <Button label={t('auth.claimAction')} onPress={() => void claim()} />
    </AuthScaffold>
  );
}
