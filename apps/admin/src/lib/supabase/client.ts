import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@publisheriq/database';

// Singleton instance for browser client
// Using ReturnType to match the exact type returned by createSupabaseBrowserClient
let browserClient: ReturnType<typeof createSupabaseBrowserClient<Database>> | null = null;

const browserCookieOptions = {
  // Keep cookies host-only to avoid cross-host session drift between apex/www.
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 604800, // 7 days in seconds - persist session across browser close
};

/**
 * Creates or returns the singleton Supabase client for browser/client components.
 * Using a singleton prevents multiple auth listeners and token refresh loops
 * that can cause rate limit errors when multiple components create clients.
 *
 * OTP auth verifies 8-digit codes entered by the user, avoiding PKCE
 * code verifier issues that occur with magic links across browser contexts.
 */
export function createBrowserClient() {
  // Return existing instance if available
  if (browserClient) {
    return browserClient;
  }

  browserClient = createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
      cookieOptions: browserCookieOptions,
    }
  );

  return browserClient;
}

/**
 * Creates an isolated browser client that never reuses the shared singleton.
 * Use this for auth flows that need a fresh client instance.
 *
 * Note: @supabase/ssr always enables browser auto-refresh internally.
 * Callers that need refresh fully suppressed should stop it immediately after creation.
 */
export function createIsolatedBrowserClient() {
  return createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: false,
      cookieOptions: browserCookieOptions,
    }
  );
}

/**
 * Backward-compatible alias for the login flow.
 */
export function createBrowserClientNoRefresh() {
  return createIsolatedBrowserClient();
}
