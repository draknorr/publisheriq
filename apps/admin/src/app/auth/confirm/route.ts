import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@publisheriq/database';
import { sanitizeAuthNextPath } from '@/lib/auth/redirects';
import { buildAuthUrl, resolveAuthOrigin } from '@/lib/auth/origin';

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
  let siteOrigin = resolveAuthOrigin(
    request.nextUrl.origin,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:3001'
  );

  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    siteOrigin = resolveAuthOrigin(
      url.origin,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      'http://localhost:3001'
    );
    const token_hash = searchParams.get('token_hash');
    const typeParam = searchParams.get('type');
    const next = sanitizeAuthNextPath(searchParams.get('next'));

    // Validate type is one of the allowed EmailOtpType values
    const validTypes = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;
    type EmailOtpType = typeof validTypes[number];

    if (!token_hash || !typeParam || !validTypes.includes(typeParam as EmailOtpType)) {
      return NextResponse.redirect(buildAuthUrl('/login?error=missing_token', siteOrigin));
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
      return NextResponse.redirect(buildAuthUrl('/login?error=invalid_token', siteOrigin));
    }

    // Create redirect response and attach session cookies
    const response = NextResponse.redirect(new URL(next, siteOrigin));
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (err) {
    console.error('Auth confirm error:', err);
    return NextResponse.redirect(buildAuthUrl('/login?error=server_error', siteOrigin));
  }
}
