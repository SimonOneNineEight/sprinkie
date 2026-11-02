import * as Sentry from '@sentry/react-native';
import { useEffect, useRef, useState } from 'react';

import type { Me } from './api/client';
import { ApiError, provisionMe, reactivateMe } from './api/client';
import { supabase } from './auth/supabase';
import { useSession } from './auth/useSession';
import { useAppLanguage } from './i18n/AppLanguageProvider';
import { DeactivatedScreen } from './screens/DeactivatedScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SignInScreen } from './screens/SignInScreen';

// The auth gate: 登入 until a session exists, the app once it does. Signing
// in (or restoring a session) provisions the User's world through the
// idempotent /me call, whose categories feed the entry form.
export function AppRoot() {
  const session = useSession();
  // The resolved App Language rides along as /me's one-time seeding hint
  // (#36): a brand-new account gets Starter Categories in this language.
  const { language } = useAppLanguage();
  const accessToken = session?.access_token;
  const userId = session?.user.id;
  const [world, setWorld] = useState<{ userId: string; me: Me } | null>(null);
  // Bumped when the form creates a category, so /me is refetched.
  const [worldVersion, setWorldVersion] = useState(0);
  // A deactivated account (#15): /me answers 403 and only the deliberate
  // restore (or 登出) leaves this state.
  const [deactivated, setDeactivated] = useState(false);
  // A launch made offline (#100) would otherwise have no Categories until
  // the next relaunch: a failed /me retries, backing off to every 30s.
  const [retryTick, setRetryTick] = useState(0);
  const failedInARow = useRef(0);

  useEffect(() => {
    if (!accessToken || !userId) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    provisionMe(accessToken, language)
      .then((me) => {
        if (!active) return;
        failedInARow.current = 0;
        setWorld({ userId, me });
        setDeactivated(false);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
          if (active) setDeactivated(true);
          return;
        }
        // One report per outage, not one per retry.
        if (failedInARow.current === 0) Sentry.captureException(error);
        if (!active) return;
        const delay = Math.min(2000 * 2 ** failedInARow.current, 30000);
        failedInARow.current += 1;
        retry = setTimeout(() => setRetryTick((n) => n + 1), delay);
      });
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [accessToken, userId, worldVersion, language, retryTick]);

  // Staleness is keyed by user, not token: a routine token refresh keeps the
  // provisioned world, while signing in as a different user discards it.
  const me = world !== null && world.userId === userId ? world.me : null;

  if (session === undefined) {
    return null;
  }
  if (!session) {
    return <SignInScreen />;
  }
  if (deactivated && userId) {
    return (
      <DeactivatedScreen
        onRestore={async () => {
          const me = await reactivateMe(session.access_token);
          setWorld({ userId, me });
          setDeactivated(false);
        }}
        onSignOut={() => {
          void supabase.auth.signOut();
        }}
      />
    );
  }
  return (
    <HomeScreen
      accessToken={session.access_token}
      categories={me?.categories ?? []}
      onCategoriesChanged={() => setWorldVersion((v) => v + 1)}
    />
  );
}
