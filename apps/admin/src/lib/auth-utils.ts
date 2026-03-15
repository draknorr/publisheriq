import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import {
  createServerClient,
  getUserWithProfileResult,
  type UserProfile,
} from './supabase/server';
import type { User } from '@supabase/supabase-js';

export class AuthenticationError extends Error {
  constructor(message = 'Not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Not authorized') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ProfileRecoveryError extends Error {
  constructor(message = 'Unable to recover your account profile') {
    super(message);
    this.name = 'ProfileRecoveryError';
  }
}

export function getAuthErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ProfileRecoveryError) {
    return NextResponse.json(
      { error: 'Profile recovery failed. Please try signing in again.' },
      { status: 503 }
    );
  }

  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return null;
}

/**
 * Requires authentication. Redirects to login if not authenticated.
 * Use in server components or API routes.
 */
export async function requireAuth(): Promise<{ user: User; profile: UserProfile }> {
  const result = await getUserWithProfileResult();

  if (result.status === 'authenticated') {
    return result;
  }

  if (result.status === 'profile_repair_failed') {
    redirect('/login?error=profile_recovery_failed');
  }

  redirect('/login');
}

/**
 * Requires admin role. Redirects to home if not admin.
 * Use in server components or API routes.
 */
export async function requireAdmin(): Promise<{ user: User; profile: UserProfile }> {
  const result = await requireAuth();

  if (result.profile.role !== 'admin') {
    redirect('/');
  }

  return result;
}

/**
 * Requires authentication but throws instead of redirecting.
 * Use in API routes where you want to return an error response.
 */
export async function requireAuthOrThrow(): Promise<{ user: User; profile: UserProfile }> {
  const result = await getUserWithProfileResult();

  if (result.status === 'authenticated') {
    return result;
  }

  if (result.status === 'profile_repair_failed') {
    throw new ProfileRecoveryError(result.reason);
  }

  throw new AuthenticationError();
}

/**
 * Requires admin role but throws instead of redirecting.
 * Use in API routes where you want to return an error response.
 */
export async function requireAdminOrThrow(): Promise<{ user: User; profile: UserProfile }> {
  const result = await requireAuthOrThrow();

  if (result.profile.role !== 'admin') {
    throw new AuthorizationError('Admin role required');
  }

  return result;
}

/**
 * Checks if the given profile has admin role.
 */
export function isProfileAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'admin';
}

/**
 * Gets the current user's credits, with minimum check.
 * Returns the balance and whether it meets the minimum for chat.
 */
export async function getCreditsForChat(minimumRequired: number = 4): Promise<{
  balance: number;
  hasMinimum: boolean;
  userId: string;
} | null> {
  const result = await getUserWithProfileResult();

  if (result.status !== 'authenticated') {
    return null;
  }

  return {
    balance: result.profile.credit_balance,
    hasMinimum: result.profile.credit_balance >= minimumRequired,
    userId: result.user.id,
  };
}

/**
 * Signs out the current user.
 */
export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}
