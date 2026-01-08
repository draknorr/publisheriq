import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@publisheriq/database';

/**
 * Creates a Supabase client for use in middleware.
 * Returns both the client and the response object (needed for cookie updates).
 */
export async function createMiddlewareClient(request: NextRequest) {
  // Create an unmodified response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response };
}

/**
 * Refreshes the session and returns updated response.
 * Call this in middleware to keep sessions fresh.
 */
export async function updateSession(request: NextRequest) {
  const { supabase, response } = await createMiddlewareClient(request);

  // Refresh the session if needed
  const { data: { user } } = await supabase.auth.getUser();

  return { user, response, supabase };
}
