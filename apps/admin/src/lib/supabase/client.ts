import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@publisheriq/database';

/**
 * Creates a Supabase client for browser/client components.
 * This client automatically handles auth state and cookies.
 *
 * Magic link auth uses token_hash verification (server-side) instead of
 * PKCE code exchange (client-side) to work across browser contexts.
 */
export function createBrowserClient() {
  // Only set explicit domain for production (allows subdomains like app.publisheriq.app)
  // For other environments (localhost, Vercel previews), let browser use current origin
  // SECURITY FIX (AUTH-09): Also match apex domain (publisheriq.app without subdomain)
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isProduction = hostname === 'publisheriq.app' || hostname.endsWith('.publisheriq.app');

  return createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: true,
        autoRefreshToken: true,
        flowType: 'implicit', // Use implicit flow for magic links (works across browser contexts)
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
