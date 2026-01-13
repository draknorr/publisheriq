import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@publisheriq/database';

/**
 * Server-side auth callback handler.
 *
 * Supports two flows:
 * 1. Same-origin: Exchanges code for session on production
 * 2. Cross-origin proxy: Routes code to preview deployments for client-side exchange
 *
 * The proxy flow enables Vercel preview URLs to work without registering each
 * preview URL in Supabase. The PKCE verifier is in the user's browser localStorage
 * on the origin where they initiated login, so cross-origin requests must be
 * forwarded there for client-side exchange.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const targetOrigin = searchParams.get('origin');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    // No code parameter - redirect to client-side handler
    return NextResponse.redirect(`${origin}/auth/callback`);
  }

  // If origin param specified and different from current, route code there
  // The target origin's client-side handler has the PKCE verifier in localStorage
  if (targetOrigin && targetOrigin !== origin) {
    const targetUrl = new URL('/auth/callback', targetOrigin);
    targetUrl.searchParams.set('code', code);
    if (next !== '/dashboard') {
      targetUrl.searchParams.set('next', next);
    }
    return NextResponse.redirect(targetUrl.toString());
  }

  // Same origin - try server-side exchange
  const cookieStore = await cookies();
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
  // The client has access to the PKCE verifier in localStorage
  const clientCallbackUrl = new URL('/auth/callback', origin);
  clientCallbackUrl.searchParams.set('code', code);
  return NextResponse.redirect(clientCallbackUrl.toString());
}
