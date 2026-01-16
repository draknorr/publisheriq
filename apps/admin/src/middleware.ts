import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Public paths - no auth required
const PUBLIC_PATHS = [
  '/login',
  '/waitlist',
  '/auth/callback',
  '/auth/confirm',
  '/api/auth/callback',
  '/api/auth/validate-email',
];

// Admin-only paths (requires admin role)
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

function isPublicPath(pathname: string): boolean {
  // Landing page is public (exact match only)
  if (pathname === '/') {
    return true;
  }
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((path) => pathname.startsWith(path));
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // DEV BYPASS: Skip auth on localhost for local development
  // Safe because hostname can only be 'localhost' when running locally
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocalhost && !isPublicPath(pathname) && !isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Redirect auth errors from / to /login with error params
  if (pathname === '/' && request.nextUrl.searchParams.has('error')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Route auth code from root to callback handler (preserves all params including origin)
  // This handles cases where Supabase redirects to root instead of callback path
  if (pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const url = request.nextUrl.clone();
    url.pathname = '/api/auth/callback';
    return NextResponse.redirect(url);
  }

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // For public paths, still update session but don't require auth
  if (isPublicPath(pathname)) {
    try {
      const { response } = await updateSession(request);
      return response;
    } catch {
      return NextResponse.next();
    }
  }

  // Protected routes - require Supabase auth
  const { user, response, supabase } = await updateSession(request);

  // Not authenticated
  if (!user) {
    // API routes get 401 JSON response (not redirect)
    if (isApiPath(pathname)) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Web routes get redirect to login
    const loginUrl = new URL('/login', request.url);
    // Preserve the intended destination
    if (pathname !== '/dashboard') {
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
      // Non-admin trying to access admin routes - redirect to dashboard
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return response;
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
