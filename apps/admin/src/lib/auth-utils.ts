import { redirect } from 'next/navigation';
import { createServerClient, getUserWithProfile, type UserProfile } from './supabase/server';
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

/**
 * Requires authentication. Redirects to login if not authenticated.
 * Use in server components or API routes.
 */
export async function requireAuth(): Promise<{ user: User; profile: UserProfile }> {
  const result = await getUserWithProfile();

  if (!result) {
    redirect('/login');
  }

  return result;
}

/**
 * Requires admin role. Redirects to home if not admin.
 * Use in server components or API routes.
 */
export async function requireAdmin(): Promise<{ user: User; profile: UserProfile }> {
  const result = await getUserWithProfile();

  if (!result) {
    redirect('/login');
  }

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
  const result = await getUserWithProfile();

  if (!result) {
    throw new AuthenticationError();
  }

  return result;
}

/**
 * Requires admin role but throws instead of redirecting.
 * Use in API routes where you want to return an error response.
 */
export async function requireAdminOrThrow(): Promise<{ user: User; profile: UserProfile }> {
  const result = await getUserWithProfile();

  if (!result) {
    throw new AuthenticationError();
  }

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
  const result = await getUserWithProfile();

  if (!result) {
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
