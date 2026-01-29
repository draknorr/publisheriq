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
import { createBrowserClient } from '@/lib/supabase/client';

export function useAuthReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();

    // Check if session is already available
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsReady(true);
      }
    };

    checkSession();

    // Also listen for auth state changes in case session loads after initial check
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return isReady;
}
