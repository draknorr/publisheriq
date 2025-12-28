import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'publisheriq_auth';

// Paths that don't require authentication
const PUBLIC_PATHS = ['/password', '/api/auth'];

// Static asset patterns to skip
const STATIC_PATTERNS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (STATIC_PATTERNS.some((pattern) => pathname.startsWith(pattern))) {
    return NextResponse.next();
  }

  // Skip public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get(COOKIE_NAME);

  if (!authCookie || authCookie.value !== 'authenticated') {
    // Redirect to password page
    const passwordUrl = new URL('/password', request.url);
    return NextResponse.redirect(passwordUrl);
  }

  return NextResponse.next();
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
