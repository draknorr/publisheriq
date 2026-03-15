'use client';

import type { User } from '@supabase/supabase-js';
import { createBrowserClient } from '@/lib/supabase/client';

const DEFAULT_AUTH_TIMEOUT_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 150;

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;
type BrowserAuthReadySource = 'initial-user' | 'initial-session' | 'event' | 'poll';

export type BrowserAuthReadyResult =
  | {
      ok: true;
      user: User;
      source: BrowserAuthReadySource;
    }
  | {
      ok: false;
      reason: 'timeout' | 'error';
      error?: string;
    };

interface WaitForAuthenticatedBrowserUserOptions {
  client?: BrowserSupabaseClient;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

async function getAuthoritativeUser(
  supabase: BrowserSupabaseClient
): Promise<{ user: User | null; error: string | null }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    user,
    error: error?.message ?? null,
  };
}

function isTransientUserResolutionError(error: string | null): boolean {
  if (!error) {
    return false;
  }

  const normalizedError = error.toLowerCase();
  return (
    normalizedError.includes('session') ||
    normalizedError.includes('jwt') ||
    normalizedError.includes('token') ||
    normalizedError.includes('network')
  );
}

export async function waitForAuthenticatedBrowserUser(
  options: WaitForAuthenticatedBrowserUserOptions = {}
): Promise<BrowserAuthReadyResult> {
  const supabase = options.client ?? createBrowserClient();
  const timeoutMs = options.timeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const {
    data: { session: initialSession },
    error: initialSessionError,
  } = await supabase.auth.getSession();

  if (initialSessionError) {
    return {
      ok: false,
      reason: 'error',
      error: initialSessionError.message,
    };
  }

  if (initialSession) {
    const initialUserResult = await getAuthoritativeUser(supabase);
    if (initialUserResult.error && !isTransientUserResolutionError(initialUserResult.error)) {
      return {
        ok: false,
        reason: 'error',
        error: initialUserResult.error,
      };
    }

    if (initialUserResult.user) {
      return {
        ok: true,
        user: initialUserResult.user,
        source: 'initial-user',
      };
    }
  }

  return new Promise<BrowserAuthReadyResult>((resolve) => {
    let settled = false;
    let isChecking = false;

    const finish = (result: BrowserAuthReadyResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
      resolve(result);
    };

    const checkForUser = async (source: Exclude<BrowserAuthReadySource, 'initial-user'>): Promise<void> => {
      if (settled || isChecking) {
        return;
      }

      isChecking = true;

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          finish({
            ok: false,
            reason: 'error',
            error: sessionError.message,
          });
          return;
        }

        if (!session) {
          return;
        }

        const userResult = await getAuthoritativeUser(supabase);
        if (userResult.error && !isTransientUserResolutionError(userResult.error)) {
          finish({
            ok: false,
            reason: 'error',
            error: userResult.error,
          });
          return;
        }

        if (userResult.user) {
          finish({
            ok: true,
            user: userResult.user,
            source,
          });
        }
      } finally {
        isChecking = false;
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        return;
      }

      void checkForUser('event');
    });

    const intervalId = window.setInterval(() => {
      void checkForUser('poll');
    }, pollIntervalMs);

    const timeoutId = window.setTimeout(() => {
      finish({
        ok: false,
        reason: 'timeout',
      });
    }, timeoutMs);

    void checkForUser('initial-session');
  });
}
