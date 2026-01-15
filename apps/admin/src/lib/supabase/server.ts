import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import type { Database } from '@publisheriq/database';
import type { User } from '@supabase/supabase-js';
import { getBypassEmail } from '@/lib/dev-auth';

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserRole = Database['public']['Enums']['user_role'];

/**
 * Creates a Supabase client for server components and API routes.
 * Handles cookie management for authentication.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from Server Components.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Helper to get dev user from Supabase admin API (for bypass mode).
 * Only used when BYPASS_AUTH_EMAIL is set and environment checks pass.
 */
async function getDevUser(email: string): Promise<User | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[DEV AUTH] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY for dev user lookup');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: users, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.warn('[DEV AUTH] Failed to list users:', error.message);
    return null;
  }

  const user = users?.users?.find((u) => u.email === email);

  if (!user) {
    console.warn(`[DEV AUTH] User not found: ${email}`);
    return null;
  }

  return user;
}

/**
 * Gets the current authenticated user from the session.
 * Returns null if not authenticated.
 * Supports dev auth bypass when BYPASS_AUTH_EMAIL is set.
 */
export async function getUser(): Promise<User | null> {
  // Check for dev bypass via header (set by middleware)
  const headerStore = await headers();
  const bypassEmailHeader = headerStore.get('x-dev-auth-email');

  if (bypassEmailHeader) {
    // Double-check security (defense in depth)
    const allowedEmail = getBypassEmail();
    if (allowedEmail === bypassEmailHeader) {
      return await getDevUser(bypassEmailHeader);
    }
  }

  // Normal Supabase auth flow
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Gets the current user with their profile data.
 * Returns null if not authenticated or profile not found.
 * Supports dev auth bypass when BYPASS_AUTH_EMAIL is set.
 */
export async function getUserWithProfile(): Promise<{
  user: User;
  profile: UserProfile;
} | null> {
  // Use getUser() which handles bypass logic
  const user = await getUser();

  if (!user) {
    return null;
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return null;
  }

  return { user, profile };
}

/**
 * Checks if the current user is an admin.
 */
export async function isAdmin(): Promise<boolean> {
  const result = await getUserWithProfile();
  return result?.profile.role === 'admin';
}

/**
 * Gets just the user's credit balance.
 * Returns null if not authenticated.
 */
export async function getCreditBalance(): Promise<number | null> {
  const result = await getUserWithProfile();
  return result?.profile.credit_balance ?? null;
}
