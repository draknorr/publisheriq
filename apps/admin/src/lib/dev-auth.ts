/**
 * Dev auth security module.
 * Provides layered security to prevent bypass in production.
 *
 * Security layers:
 * 1. NODE_ENV check (must be development OR preview deployment)
 * 2. Domain allowlist (blocks production domains)
 * 3. Double opt-in (requires env var AND environment check)
 * 4. Logging (console warnings when bypass is active)
 */

// Blocked production domains - NEVER allow bypass on these
const BLOCKED_DOMAINS = ['publisheriq.app', 'www.publisheriq.app'];

// Allowed development domains
const ALLOWED_DOMAINS = ['localhost', '127.0.0.1'];

/**
 * Check if dev auth bypass is allowed in current environment.
 * Returns { allowed: boolean, reason: string }
 */
export function isDevAuthAllowed(hostname?: string): { allowed: boolean; reason: string } {
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;

  // Layer 1: Check NODE_ENV
  // In production, only allow if explicitly a preview deployment
  if (nodeEnv === 'production') {
    if (vercelEnv !== 'preview') {
      return {
        allowed: false,
        reason: 'Production environment (NODE_ENV=production, not preview)',
      };
    }
  }

  // Layer 2: Check hostname if provided
  if (hostname) {
    // Block production domains (exact match or subdomain)
    if (BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))) {
      return { allowed: false, reason: `Blocked domain: ${hostname}` };
    }

    // Allow localhost
    if (ALLOWED_DOMAINS.includes(hostname)) {
      return { allowed: true, reason: 'Localhost allowed' };
    }

    // Allow Vercel preview deployments (*.vercel.app)
    if (hostname.endsWith('.vercel.app') && vercelEnv === 'preview') {
      return { allowed: true, reason: 'Vercel preview deployment' };
    }

    // Unknown domain in development - allow with warning
    if (nodeEnv === 'development') {
      console.warn(`[DEV AUTH] Unknown domain ${hostname} in development mode`);
      return { allowed: true, reason: 'Development mode (unknown domain)' };
    }

    return { allowed: false, reason: `Unknown domain: ${hostname}` };
  }

  // No hostname provided (server-side check), rely on NODE_ENV
  if (nodeEnv === 'development') {
    return { allowed: true, reason: 'Development environment' };
  }

  if (vercelEnv === 'preview') {
    return { allowed: true, reason: 'Vercel preview environment' };
  }

  return { allowed: false, reason: 'Not in allowed environment' };
}

/**
 * Get bypass email if dev auth is enabled and allowed.
 * Returns null if bypass should not be used.
 */
export function getBypassEmail(hostname?: string): string | null {
  const bypassEmail = process.env.BYPASS_AUTH_EMAIL;
  if (!bypassEmail) return null;

  const { allowed, reason } = isDevAuthAllowed(hostname);

  if (!allowed) {
    console.warn(`[DEV AUTH] Bypass blocked: ${reason}`);
    return null;
  }

  // Only log once per request by checking if we're in a browser context
  // Server-side will log on each call which is fine for debugging
  console.warn(`[DEV AUTH] ⚠️ Auth bypass ACTIVE for: ${bypassEmail}`);
  return bypassEmail;
}

/**
 * Check if dev login endpoint is enabled and allowed.
 */
export function isDevLoginEnabled(hostname?: string): boolean {
  if (process.env.DEV_AUTH_ENABLED !== 'true') return false;

  const { allowed, reason } = isDevAuthAllowed(hostname);

  if (!allowed) {
    console.warn(`[DEV AUTH] Dev login blocked: ${reason}`);
    return false;
  }

  return true;
}
