'use client';

import type { User } from '@supabase/supabase-js';
import { createBrowserClient } from '@/lib/supabase/client';

const DEFAULT_AUTH_TIMEOUT_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 250;
const MAX_POLL_INTERVAL_MS = 1500;

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

  let initialTransientError: string | undefined;
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

    initialTransientError = initialUserResult.error ?? 'Authenticated session did not return a user yet.';
  }

  return new Promise<BrowserAuthReadyResult>((resolve) => {
    let settled = false;
    let isChecking = false;
    let attemptCount = 0;
    let retryTimeoutId: number | null = null;
    let queuedSource: Exclude<BrowserAuthReadySource, 'initial-user'> | null = null;
    let lastTransientError = initialTransientError;

    const clearRetryTimeout = (): void => {
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
    };

    const finish = (result: BrowserAuthReadyResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearRetryTimeout();
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
      resolve(result);
    };

    const scheduleNextCheck = (): void => {
      if (settled) {
        return;
      }

      clearRetryTimeout();

      const delay = Math.min(
        pollIntervalMs * Math.pow(2, Math.max(attemptCount - 1, 0)),
        MAX_POLL_INTERVAL_MS
      );

      retryTimeoutId = window.setTimeout(() => {
        retryTimeoutId = null;
        void checkForUser('poll');
      }, delay);
    };

    const flushQueuedCheck = (): void => {
      if (settled || isChecking || !queuedSource) {
        return;
      }

      const source = queuedSource;
      queuedSource = null;
      clearRetryTimeout();
      void checkForUser(source);
    };

    const checkForUser = async (source: Exclude<BrowserAuthReadySource, 'initial-user'>): Promise<void> => {
      if (settled) {
        return;
      }

      if (isChecking) {
        queuedSource = source;
        return;
      }

      isChecking = true;
      attemptCount += 1;

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
          lastTransientError = 'Session cookie not available yet.';
          scheduleNextCheck();
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

        if (userResult.error) {
          lastTransientError = userResult.error;
          scheduleNextCheck();
          return;
        }

        if (userResult.user) {
          finish({
            ok: true,
            user: userResult.user,
            source,
          });
          return;
        }

        lastTransientError = 'Authenticated session did not return a user yet.';
        scheduleNextCheck();
      } finally {
        isChecking = false;
        flushQueuedCheck();
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

    const timeoutId = window.setTimeout(() => {
      finish({
        ok: false,
        reason: 'timeout',
        error: lastTransientError,
      });
    }, timeoutMs);

    void checkForUser('initial-session');
  });
}
