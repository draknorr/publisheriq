import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    // No code parameter - redirect to client-side handler
    return NextResponse.redirect(`${origin}/auth/callback`);
  }

  // Determine where to send the code for client-side exchange
  // The PKCE verifier is in localStorage on the origin where user started login
  const destination = targetOrigin || origin;

  const clientCallbackUrl = new URL('/auth/callback', destination);
  clientCallbackUrl.searchParams.set('code', code);
  if (next !== '/dashboard') {
    clientCallbackUrl.searchParams.set('next', next);
  }

  return NextResponse.redirect(clientCallbackUrl.toString());
}
