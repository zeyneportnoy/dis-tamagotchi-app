import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { getFamilyUseCases } from '@/application/family';
import {
  ensureChildDataRecovered,
  getProfileSyncUseCases,
  pushPendingChildProfiles,
  recoverChildPreferences,
  retryPendingCloudSync,
} from '@/application/sync';
import { perfMark, perfSince, perfStep } from '@/config/perf';
import { ErrorState } from '@/design-system';
import { isLegacyAgeBand } from '@/domain/family';
import { useAuth } from '@/features/auth';
import { BrandedSplash } from '@/features/splash';

type Destination =
  | 'age-band-update'
  | 'child'
  | 'child-select'
  | 'onboarding'
  | 'profile-onboarding'
  | 'claim-local'
  | 'error';

export const routeForProfile = (profile: {
  dateOfBirth: string | null;
  ageBand: string;
}): Extract<Destination, 'age-band-update' | 'child'> =>
  !profile.dateOfBirth || isLegacyAgeBand(profile.ageBand) ? 'age-band-update' : 'child';

/**
 * A family with 2+ child profiles must ALWAYS see the post-login picker
 * (`/select-child`) first, no matter which child happens to be the persisted
 * "active" one or whether that child's profile is complete — the parent has
 * not chosen a child yet, so nothing about a specific child (including
 * whether IT still needs a date of birth) may be evaluated before that
 * choice is made. Only `/select-child`'s own `chooseProfile` — after an
 * explicit tap — is allowed to route a specific child into age-band-update.
 * A single-child family keeps going straight to the child home / its own
 * completeness check exactly as before.
 */
export async function routeForActiveChild(
  family: Pick<Awaited<ReturnType<typeof getFamilyUseCases>>, 'listProfiles'>,
  profile: { dateOfBirth: string | null; ageBand: string },
): Promise<Extract<Destination, 'age-band-update' | 'child' | 'child-select'>> {
  const profiles = await family.listProfiles();
  if (profiles.length > 1) return 'child-select';
  return routeForProfile(profile);
}

/**
 * Cloud hydration is deferred and fire-and-forget: it must never block the first
 * usable screen when local state already answers the routing question, and its
 * failures must not affect navigation. Runs once per bootstrap.
 */
function deferCloudRecovery(): void {
  void (async () => {
    try {
      // Flush any locally-queued profile edit / archive / delete BEFORE pulling
      // from the cloud. `upsertCloud` already refuses a pending-removal or
      // pending-edit row on its own, so this ordering is defense in depth, not
      // the only guard: it just means the common case never needs that guard at
      // all — the cloud is already caught up by the time recovery reads it.
      await perfStep('bootstrap:pushPendingChildProfiles(deferred)', pushPendingChildProfiles);
      const sync = await getProfileSyncUseCases();
      if (sync) {
        await perfStep('bootstrap:recoverFromCloud(deferred)', () => sync.recoverFromCloud());
      }
      await perfStep('bootstrap:recoverChildData(deferred)', ensureChildDataRecovered);
      await perfStep('bootstrap:recoverChildPreferences(deferred)', recoverChildPreferences);
      void retryPendingCloudSync();
    } catch (error) {
      console.warn('index: deferred cloud recovery failed (non-blocking)', error);
    }
  })();
}

export default function Index() {
  const { configured, loading: authLoading, session } = useAuth();
  const userId = session?.userId ?? null;
  // Account isolation: the resolved route is tagged with the user it was resolved
  // for. When the signed-in user changes (logout → another login) the tag stops
  // matching, so the previous account's screen can never flash before the new
  // bootstrap runs.
  const [resolved, setResolved] = useState<{
    userId: string | null;
    destination: Destination | null;
  }>({ userId: null, destination: null });
  const destination = resolved.userId === userId ? resolved.destination : null;

  useEffect(() => {
    if (authLoading || !configured || !session || !session.emailVerified) return;
    const boundUserId = session.userId;
    const tag = (value: Destination) =>
      setResolved((prev) =>
        prev.userId === boundUserId && prev.destination === value
          ? prev
          : { userId: boundUserId, destination: value },
      );

    let cancelled = false;
    perfMark('bootstrap:start');
    void (async () => {
      try {
        const sync = await getProfileSyncUseCases();

        // Local + fast: an unclaimed on-device profile takes priority over any route.
        if (
          sync &&
          (await perfStep('bootstrap:countLegacyProfiles', () =>
            sync.countLegacyProfiles(boundUserId),
          )) > 0
        ) {
          if (!cancelled) {
            perfSince('bootstrap:route-decided(claim-local)', 'bootstrap:start');
            tag('claim-local');
          }
          return;
        }

        const family = await getFamilyUseCases();
        const localProfile = await perfStep('bootstrap:getActiveProfile(local)', () =>
          family.getActiveProfile(),
        );

        if (localProfile) {
          // Usable local state exists → route immediately, hydrate from cloud after.
          const localRoute = await routeForActiveChild(family, localProfile);
          if (!cancelled) {
            perfSince('bootstrap:route-decided(local)', 'bootstrap:start');
            tag(localRoute);
          }
          deferCloudRecovery();
          return;
        }

        // No usable local state (fresh install / new device): the cloud is the
        // only source of truth for whether this account has children, so this
        // single recovery pass is allowed to block. Progress + brushing history
        // (the second -10 penalty guard) are recovered here too, before any
        // screen reads them.
        if (sync) {
          await perfStep('bootstrap:recoverFromCloud(cold)', () => sync.recoverFromCloud());
        }
        await perfStep('bootstrap:recoverChildData(cold)', ensureChildDataRecovered);
        await perfStep('bootstrap:recoverChildPreferences(cold)', recoverChildPreferences);
        void retryPendingCloudSync();

        const recovered = await family.getActiveProfile();
        const coldRoute: Destination = recovered
          ? await routeForActiveChild(family, recovered)
          : 'profile-onboarding';
        if (!cancelled) {
          perfSince('bootstrap:route-decided(cold)', 'bootstrap:start');
          tag(coldRoute);
        }
      } catch (error) {
        console.error('index: profile bootstrap failed', error);
        if (!cancelled) tag('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, configured, session]);

  if (authLoading) return <BrandedSplash />;
  if (!configured || !session) return <Redirect href="/onboarding" />;
  if (!session.emailVerified) return <BrandedSplash />;
  if (destination === 'error') return <ErrorState />;
  if (!destination) return <BrandedSplash />;
  perfMark('bootstrap:redirect');
  const href =
    destination === 'child'
      ? '/(child)'
      : destination === 'child-select'
        ? '/select-child'
        : destination === 'age-band-update'
          ? '/age-band-update'
          : destination === 'claim-local'
            ? '/auth/claim-local'
            : destination === 'profile-onboarding'
              ? '/onboarding/nickname'
              : '/onboarding';
  return <Redirect href={href as Href} />;
}
