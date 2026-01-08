// Server-side exports (for server components and API routes)
export {
  createServerClient,
  getUser,
  getUserWithProfile,
  isAdmin,
  getCreditBalance,
  type UserProfile,
  type UserRole,
} from './server';

// Client-side exports (for browser components)
export { createBrowserClient } from './client';

// Middleware exports
export { createMiddlewareClient, updateSession } from './middleware';
