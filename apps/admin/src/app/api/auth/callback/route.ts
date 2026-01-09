import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@publisheriq/database';

/**
 * Server-side auth callback handler for OAuth providers.
 *
 * Note: Magic links use implicit flow (tokens in URL hash) and don't use this route.
 * This route is only needed if you add OAuth providers (Google, GitHub, etc.)
 * that use PKCE code exchange.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    // No code parameter - redirect to client-side handler
    return NextResponse.redirect(`${origin}/auth/callback`);
  }

  const cookieStore = await cookies();

  // Collect cookies to set on the response
  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
          // Collect cookies instead of setting them immediately
          cookiesToSet.push(...cookies);
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    // Create redirect response and attach session cookies
    const response = NextResponse.redirect(`${origin}${next}`);
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  // If code exchange failed, fall back to client-side exchange
  // The client has access to the PKCE verifier in localStorage and can complete the exchange
  const clientCallbackUrl = new URL('/auth/callback', origin);
  clientCallbackUrl.searchParams.set('code', code);
  clientCallbackUrl.searchParams.set('server_failed', 'true');
  return NextResponse.redirect(clientCallbackUrl.toString());
}
