import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases, type ChildProfileViewModel } from '@/application/family';
import { Button, ErrorState, LoadingState, Screen, SelectionCard, Text } from '@/design-system';
import { isLegacyAgeBand } from '@/domain/family';

export default function ChildHomeScreen() {
  const { t } = useTranslation();
  const [active, setActive] = useState<ChildProfileViewModel | null>(null);
  const [profiles, setProfiles] = useState<readonly ChildProfileViewModel[]>([]);
  const [failed, setFailed] = useState(false);

  const load = async (): Promise<void> => {
    try {
      const useCases = await getFamilyUseCases();
      const [activeProfile, allProfiles] = await Promise.all([
        useCases.getActiveProfile(),
        useCases.listProfiles(),
      ]);
      if (!activeProfile) return router.replace('/onboarding');
      if (isLegacyAgeBand(activeProfile.ageBand)) {
        return router.replace('/age-band-update' as Href);
      }
      setActive(activeProfile);
      setProfiles(allProfiles);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    let mounted = true;
    void getFamilyUseCases()
      .then(async (useCases) => Promise.all([useCases.getActiveProfile(), useCases.listProfiles()]))
      .then(([activeProfile, allProfiles]) => {
        if (!mounted) return;
        if (!activeProfile) return router.replace('/onboarding');
        if (isLegacyAgeBand(activeProfile.ageBand)) {
          return router.replace('/age-band-update' as Href);
        }
        setActive(activeProfile);
        setProfiles(allProfiles);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (failed) return <ErrorState />;
  if (!active) return <LoadingState />;

  return (
    <Screen testID="child-home-screen">
      <Text variant="title">{t('childHome.title', { nickname: active.nickname })}</Text>
      <Text>{t('childHome.placeholder')}</Text>
      {profiles.length > 1 ? (
        <>
          <Text>{t('childHome.switchProfile')}</Text>
          {profiles.map((profile) => (
            <SelectionCard
              key={profile.id}
              label={profile.nickname}
              onPress={() => {
                void getFamilyUseCases()
                  .then((useCases) => useCases.selectActiveProfile(profile.id))
                  .then(load);
              }}
              selected={profile.id === active.id}
            />
          ))}
        </>
      ) : null}
      <Button
        label={t('childHome.parentArea')}
        onPress={() => router.push('/parent-gate')}
        variant="secondary"
      />
    </Screen>
  );
}
