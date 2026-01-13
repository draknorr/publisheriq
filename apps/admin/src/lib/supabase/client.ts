import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@publisheriq/database';

/**
 * Creates a Supabase client for browser/client components.
 * This client automatically handles auth state and cookies.
 *
 * Uses PKCE flow for magic link auth. The code_verifier is stored in
 * localStorage when login is initiated, then used to exchange the code
 * for a session when the user clicks the magic link.
 */
export function createBrowserClient() {
  // Only set explicit domain for production (allows subdomains like app.publisheriq.app)
  // For other environments (localhost, Vercel previews), let browser use current origin
  const isProduction = typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.publisheriq.app');

  return createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
      cookieOptions: {
        ...(isProduction && { domain: '.publisheriq.app' }),
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 604800, // 7 days in seconds - persist session across browser close
      },
    }
  );
}
