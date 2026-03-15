import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { sanitizeAuthNextPath } from '@/lib/auth/redirects';
import { buildAuthUrl, isAllowedAuthOrigin, resolveAuthOrigin } from '@/lib/auth/origin';

/**
 * Server-side auth callback handler.
 *
 * Routes auth codes to the client-side handler for PKCE exchange.
 * Magic links use PKCE which requires a code_verifier stored in browser localStorage.
 * The server cannot exchange these codes - only the client can.
 *
 * For Vercel preview URLs: routes code back to the origin where login started.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const targetOrigin = searchParams.get('origin');
  const next = sanitizeAuthNextPath(searchParams.get('next'));
  const fallbackOrigin = resolveAuthOrigin(
    origin,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:3001'
  );

  if (!code) {
    // No code parameter - redirect to client-side handler
    return NextResponse.redirect(buildAuthUrl('/auth/callback', fallbackOrigin));
  }

  // SECURITY FIX: Validate origin parameter to prevent open redirect
  // Only allow redirects to known-safe origins
  let destination = fallbackOrigin;
  if (targetOrigin) {
    if (isAllowedAuthOrigin(targetOrigin)) {
      destination = resolveAuthOrigin(
        targetOrigin,
        origin,
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        'http://localhost:3001'
      );
    } else {
      console.warn(`Blocked redirect to untrusted origin: ${targetOrigin}`);
      // Fall back to current origin instead of redirecting to untrusted site
    }
  }

  const clientCallbackUrl = new URL('/auth/callback', destination);
  clientCallbackUrl.searchParams.set('code', code);
  if (next !== '/dashboard') {
    clientCallbackUrl.searchParams.set('next', next);
  }

  return NextResponse.redirect(clientCallbackUrl.toString());
}
