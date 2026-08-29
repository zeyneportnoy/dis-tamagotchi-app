import { usePathname, useRouter } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { getParentAuthUseCases, type ParentAuthUseCases } from '@/application/auth';
import { retryPendingCloudSync } from '@/application/sync';
import type { ParentSession } from '@/domain/auth';
import { BrandedSplash } from '@/features/splash';

type AuthContextValue = Readonly<{
  configured: boolean;
  loading: boolean;
  session: ParentSession | null;
  useCases: ParentAuthUseCases | null;
  refresh(): Promise<void>;
}>;

const AuthContext = createContext<AuthContextValue | null>(null);

const publicPath = (pathname: string): boolean =>
  pathname === '/onboarding' || pathname.startsWith('/auth') || pathname.startsWith('/legal');

export function AuthProvider({ children }: PropsWithChildren) {
  const useCases = useMemo(() => getParentAuthUseCases(), []);
  const [loading, setLoading] = useState(Boolean(useCases));
  const [session, setSession] = useState<ParentSession | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async (): Promise<void> => {
    if (!useCases) return;
    setSession(await useCases.getSession());
  }, [useCases]);

  useEffect(() => {
    if (!useCases) return;
    let active = true;
    void useCases
      .getSession()
      .then((value) => active && setSession(value))
      .finally(() => active && setLoading(false));
    const unsubscribe = useCases.subscribe((value) => {
      if (active) setSession(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [useCases]);

  // Offline → online retry: flush pending cloud writes whenever a verified
  // session is available and again each time the app returns to the foreground.
  // No polling — just these two triggers.
  const sessionReady = Boolean(session?.emailVerified);
  const lastRetryAt = useRef(0);
  useEffect(() => {
    if (!sessionReady) return;
    const attempt = (): void => {
      const now = Date.now();
      if (now - lastRetryAt.current < 15_000) return;
      lastRetryAt.current = now;
      void retryPendingCloudSync();
    };
    attempt();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') attempt();
    });
    return () => subscription.remove();
  }, [sessionReady]);

  useEffect(() => {
    if (loading) return;
    if (!useCases && !publicPath(pathname)) router.replace('/onboarding');
    else if (!session && !publicPath(pathname)) router.replace('/onboarding');
    else if (session && !session.emailVerified && !pathname.startsWith('/auth/verify-email'))
      router.replace('/auth/verify-email');
  }, [loading, pathname, router, session, useCases]);

  const value = useMemo(
    () => ({ configured: Boolean(useCases), loading, session, useCases, refresh }),
    [loading, refresh, session, useCases],
  );
  if (loading) return <BrandedSplash />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
