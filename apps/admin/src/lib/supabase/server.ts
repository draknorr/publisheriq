import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@publisheriq/database';
import type { User } from '@supabase/supabase-js';

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
 * Gets the current authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Gets the current user with their profile data.
 * Returns null if not authenticated or profile not found.
 */
export async function getUserWithProfile(): Promise<{
  user: User;
  profile: UserProfile;
} | null> {
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
