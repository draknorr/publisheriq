'use client';

/**
 * Hook to check if the browser Supabase client's auth session is ready.
 *
 * On cold page load after login, cookies are set but the browser client
 * may not have parsed them into an auth state yet. This hook waits for
 * the session to be established before returning true.
 *
 * Use this to defer API calls that require authentication until the
 * browser client is ready.
 */

import { useState, useEffect } from 'react';
import { waitForAuthenticatedBrowserUser } from '@/lib/auth/browser-session';
import { createBrowserClient } from '@/lib/supabase/client';

export function useAuthReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient();

    const checkSession = async () => {
      const authReadyResult = await waitForAuthenticatedBrowserUser({
        client: supabase,
      });

      if (!cancelled) {
        setIsReady(authReadyResult.ok);
      }
    };

    void checkSession();

    // Also listen for auth state changes in case session loads after initial check
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (!cancelled) {
          setIsReady(false);
        }
        return;
      }

      void checkSession();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return isReady;
}
