import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/**
 * The current Supabase session: undefined while restoring from storage on
 * launch, null when signed out, a Session when signed in. Persistence across
 * restarts comes from the client's AsyncStorage-backed session store.
 */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      // A verified 忘記密碼 code signs the client in before the new password
      // is set (#21); the User stays on sign-in until it is (USER_UPDATED).
      if (event === 'PASSWORD_RECOVERY') return;
      setSession(next);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return session;
}
