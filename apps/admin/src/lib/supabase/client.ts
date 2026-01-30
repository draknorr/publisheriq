import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@publisheriq/database';

// Singleton instance for browser client
// Using ReturnType to match the exact type returned by createSupabaseBrowserClient
let browserClient: ReturnType<typeof createSupabaseBrowserClient<Database>> | null = null;

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

  // Only set explicit domain for production (allows subdomains like app.publisheriq.app)
  // For other environments (localhost, Vercel previews), let browser use current origin
  // SECURITY FIX (AUTH-09): Also match apex domain (publisheriq.app without subdomain)
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isProduction = hostname === 'publisheriq.app' || hostname.endsWith('.publisheriq.app');

  browserClient = createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
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

  return browserClient;
}
