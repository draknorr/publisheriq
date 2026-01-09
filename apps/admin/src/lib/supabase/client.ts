import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@publisheriq/database';

/**
 * Creates a Supabase client for browser/client components.
 * This client automatically handles auth state and cookies.
 *
 * Cookie configuration ensures PKCE code verifier is accessible
 * across www and non-www subdomains.
 */
export function createBrowserClient() {
  return createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: '.publisheriq.app',
        sameSite: 'lax',
        secure: true,
        path: '/',
      },
    }
  );
}
