import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@publisheriq/database';

/**
 * Allowed origins for redirects.
 * SECURITY FIX (AUTH-07): Validate origin to prevent host header injection.
 */
const ALLOWED_ORIGINS = [
  'https://publisheriq.app',
  'https://www.publisheriq.app',
  'https://app.publisheriq.app',
];

/**
 * Check if an origin is allowed for redirects.
 */
function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }
  // Allow Vercel preview URLs
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
 * Ensure URL has https:// protocol.
 */
function ensureProtocol(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

/**
 * Get the site URL for redirects.
 * Uses env var if set, otherwise validates request origin against allowlist.
 */
function getSiteUrl(requestOrigin: string): string {
  // Prefer explicit env var for production
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return ensureProtocol(process.env.NEXT_PUBLIC_SITE_URL);
  }
  // Validate request origin against allowlist
  const normalizedOrigin = ensureProtocol(requestOrigin);
  if (isAllowedOrigin(normalizedOrigin)) {
    return normalizedOrigin;
  }
  // Fallback to Vercel URL for previews
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Last resort: localhost for development
  return 'http://localhost:3001';
}

/**
 * Token hash verification route for magic link authentication.
 *
 * This route handles magic links that use token_hash instead of PKCE code.
 * Token hash works across browser contexts (email clients, different browsers)
 * because it doesn't require a code_verifier stored in localStorage.
 *
 * The magic link email template should use:
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request: NextRequest) {
  let siteUrl = 'https://www.publisheriq.app'; // Safe default

  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    // Ensure origin has protocol (URL.origin should include it, but be defensive)
    const origin = url.origin.startsWith('http') ? url.origin : `https://${url.origin}`;
    siteUrl = getSiteUrl(origin);
    const token_hash = searchParams.get('token_hash');
    const typeParam = searchParams.get('type');
    const next = searchParams.get('next') ?? '/dashboard';

    // Validate type is one of the allowed EmailOtpType values
    const validTypes = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;
    type EmailOtpType = typeof validTypes[number];

    if (!token_hash || !typeParam || !validTypes.includes(typeParam as EmailOtpType)) {
      return NextResponse.redirect(`${siteUrl}/login?error=missing_token`);
    }

    const type = typeParam as EmailOtpType;

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

    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (error) {
      console.error('Token verification error:', error);
      return NextResponse.redirect(`${siteUrl}/login?error=invalid_token`);
    }

    // Create redirect response and attach session cookies
    const response = NextResponse.redirect(`${siteUrl}${next}`);
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (err) {
    console.error('Auth confirm error:', err);
    return NextResponse.redirect(`${siteUrl}/login?error=server_error`);
  }
}
