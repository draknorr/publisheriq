import {
  createServerClient as createSupabaseServerClient,
  type CookieOptions,
} from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient, type Database } from '@publisheriq/database';
import type { User } from '@supabase/supabase-js';

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserRole = Database['public']['Enums']['user_role'];
export type UserWithProfileResult =
  | {
      status: 'authenticated';
      user: User;
      profile: UserProfile;
    }
  | {
      status: 'unauthenticated';
    }
  | {
      status: 'profile_repair_failed';
      user: User;
      reason: string;
    };

const DEFAULT_SIGNUP_CREDITS = 1000;

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

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = await createServerClient();
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return profile;
}

async function repairMissingUserProfile(user: User): Promise<{
  profile: UserProfile | null;
  reason?: string;
}> {
  if (!user.email) {
    return {
      profile: null,
      reason: 'Authenticated user is missing an email address.',
    };
  }

  try {
    const serviceSupabase = createServiceClient();
    const normalizedEmail = user.email.trim().toLowerCase();

    const existingProfile = await serviceSupabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfile.error) {
      return {
        profile: null,
        reason: existingProfile.error.message,
      };
    }

    if (existingProfile.data) {
      return { profile: existingProfile.data };
    }

    const waitlistLookup = await serviceSupabase
      .from('waitlist')
      .select('full_name, organization, initial_credits')
      .ilike('email', normalizedEmail)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();

    if (waitlistLookup.error) {
      return {
        profile: null,
        reason: waitlistLookup.error.message,
      };
    }

    const initialCredits =
      typeof waitlistLookup.data?.initial_credits === 'number'
        ? waitlistLookup.data.initial_credits
        : DEFAULT_SIGNUP_CREDITS;

    const insertProfile = await serviceSupabase
      .from('user_profiles')
      .insert({
        id: user.id,
        email: normalizedEmail,
        full_name:
          waitlistLookup.data?.full_name ??
          (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''),
        organization: waitlistLookup.data?.organization ?? null,
        role: 'user',
        credit_balance: initialCredits,
        total_credits_used: 0,
        total_messages_sent: 0,
      })
      .select('*')
      .single();

    if (insertProfile.error && insertProfile.error.code !== '23505') {
      return {
        profile: null,
        reason: insertProfile.error.message,
      };
    }

    await serviceSupabase.from('rate_limit_state').upsert(
      { user_id: user.id },
      { onConflict: 'user_id' }
    );

    const existingSignupBonus = await serviceSupabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('transaction_type', 'signup_bonus')
      .limit(1)
      .maybeSingle();

    if (!existingSignupBonus.error && !existingSignupBonus.data) {
      await serviceSupabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: initialCredits,
        balance_after: initialCredits,
        transaction_type: 'signup_bonus',
        description: 'Welcome bonus credits',
      });
    }

    const repairedProfile =
      insertProfile.data ??
      (await serviceSupabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()).data;

    if (!repairedProfile) {
      return {
        profile: null,
        reason: 'Profile repair completed without a readable profile row.',
      };
    }

    return { profile: repairedProfile };
  } catch (error) {
    return {
      profile: null,
      reason: error instanceof Error ? error.message : 'Unknown profile repair failure.',
    };
  }
}

/**
 * Gets the current user with their profile data.
 * Attempts to repair a missing profile for authenticated users.
 */
export async function getUserWithProfileResult(): Promise<UserWithProfileResult> {
  const user = await getUser();

  if (!user) {
    return { status: 'unauthenticated' };
  }

  const profile = await fetchUserProfile(user.id);

  if (profile) {
    return { status: 'authenticated', user, profile };
  }

  const repairedProfile = await repairMissingUserProfile(user);

  if (!repairedProfile.profile) {
    console.error('User profile repair failed:', {
      userId: user.id,
      email: user.email,
      reason: repairedProfile.reason,
    });
    return {
      status: 'profile_repair_failed',
      user,
      reason: repairedProfile.reason ?? 'Unknown profile repair failure.',
    };
  }

  return {
    status: 'authenticated',
    user,
    profile: repairedProfile.profile,
  };
}

/**
 * Gets the current user with their profile data.
 * Returns null if not authenticated or profile repair failed.
 */
export async function getUserWithProfile(): Promise<{
  user: User;
  profile: UserProfile;
} | null> {
  const result = await getUserWithProfileResult();

  if (result.status !== 'authenticated') {
    return null;
  }

  return result;
}

/**
 * Checks if the current user is an admin.
 */
export async function isAdmin(): Promise<boolean> {
  const result = await getUserWithProfileResult();
  return result.status === 'authenticated' && result.profile.role === 'admin';
}

/**
 * Gets just the user's credit balance.
 * Returns null if not authenticated.
 */
export async function getCreditBalance(): Promise<number | null> {
  const result = await getUserWithProfileResult();
  return result.status === 'authenticated' ? result.profile.credit_balance : null;
}
