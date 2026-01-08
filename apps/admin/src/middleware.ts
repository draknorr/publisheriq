import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Auth mode: 'password' (legacy) or 'supabase' (new)
const AUTH_MODE = process.env.AUTH_MODE || 'password';

// Legacy password auth cookie
const PASSWORD_COOKIE_NAME = 'publisheriq_auth';

// Public paths - no auth required
const PUBLIC_PATHS_PASSWORD = ['/password', '/api/auth'];
const PUBLIC_PATHS_SUPABASE = ['/login', '/waitlist', '/auth/callback', '/api/auth/callback'];

// Admin-only paths (requires admin role in Supabase mode)
const ADMIN_PATHS = ['/admin'];

// Static asset patterns to skip
const STATIC_PATTERNS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

function isStaticAsset(pathname: string): boolean {
  return STATIC_PATTERNS.some((pattern) => pathname.startsWith(pattern));
}

function isPublicPath(pathname: string, authMode: string): boolean {
  const publicPaths = authMode === 'supabase' ? PUBLIC_PATHS_SUPABASE : PUBLIC_PATHS_PASSWORD;
  return publicPaths.some((path) => pathname.startsWith(path));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Legacy password-based authentication middleware.
 */
function handlePasswordAuth(request: NextRequest): NextResponse {
  const authCookie = request.cookies.get(PASSWORD_COOKIE_NAME);

  if (!authCookie || authCookie.value !== 'authenticated') {
    const passwordUrl = new URL('/password', request.url);
    return NextResponse.redirect(passwordUrl);
  }

  return NextResponse.next();
}

/**
 * Supabase authentication middleware.
 */
async function handleSupabaseAuth(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Update session (refresh tokens if needed)
  const { user, response, supabase } = await updateSession(request);

  // Not authenticated - redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    // Preserve the intended destination
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Check admin access for admin paths
  if (isAdminPath(pathname)) {
    // Fetch user profile to check role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('user_profiles') as any)
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null };

    if (!profile || profile.role !== 'admin') {
      // Non-admin trying to access admin routes - redirect to home
      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Skip public paths
  if (isPublicPath(pathname, AUTH_MODE)) {
    // For Supabase mode, still need to update session on public paths
    if (AUTH_MODE === 'supabase') {
      try {
        const { response } = await updateSession(request);
        return response;
      } catch {
        return NextResponse.next();
      }
    }
    return NextResponse.next();
  }

  // Handle authentication based on mode
  if (AUTH_MODE === 'supabase') {
    return handleSupabaseAuth(request);
  } else {
    return handlePasswordAuth(request);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
