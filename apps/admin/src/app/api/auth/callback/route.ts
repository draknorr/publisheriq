import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Allowed origins for auth redirects.
 * This prevents open redirect vulnerabilities where attackers could redirect
 * users to malicious sites after authentication.
 */
const ALLOWED_ORIGINS = [
  // Production
  'https://publisheriq.app',
  'https://app.publisheriq.app',
  'https://www.publisheriq.app',
  // Vercel previews (pattern matching done separately)
];

/**
 * Check if an origin is allowed for redirects.
 */
function isAllowedOrigin(origin: string): boolean {
  // Exact match against allowlist
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Allow Vercel preview URLs (*.vercel.app)
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.vercel.app')) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

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

  // SECURITY FIX: Validate origin parameter to prevent open redirect
  // Only allow redirects to known-safe origins
  let destination = origin; // Default to current origin
  if (targetOrigin) {
    if (isAllowedOrigin(targetOrigin)) {
      destination = targetOrigin;
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
