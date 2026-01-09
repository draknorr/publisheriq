import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@publisheriq/database';

/**
 * Creates a Supabase client for browser/client components.
 * This client automatically handles auth state and cookies.
 *
 * Uses implicit flow for magic link auth to avoid PKCE localStorage issues
 * when users click links from email clients (Gmail, Outlook, etc.) that
 * open in different browser contexts.
 */
export function createBrowserClient() {
  return createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
      cookieOptions: {
        domain: '.publisheriq.app',
        sameSite: 'lax',
        secure: true,
        path: '/',
      },
    }
  );
}
