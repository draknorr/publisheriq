const CANONICAL_PRODUCTION_AUTH_ORIGIN = 'https://www.publisheriq.app';

const PRODUCTION_AUTH_HOSTS = new Set([
  'publisheriq.app',
  'www.publisheriq.app',
  'app.publisheriq.app',
]);

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function ensureProtocol(origin: string): string {
  if (origin.startsWith('http://') || origin.startsWith('https://')) {
    return origin;
  }

  return `https://${origin}`;
}

function normalizeOrigin(origin: string | null | undefined): string | null {
  if (!origin) {
    return null;
  }

  try {
    const url = new URL(ensureProtocol(origin.trim()));

    if (isLoopbackHost(url.hostname)) {
      return `${url.protocol}//${url.host}`;
    }

    return `https://${url.host}`;
  } catch {
    return null;
  }
}

export function isAllowedAuthOrigin(origin: string | null | undefined): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  const { hostname } = new URL(normalizedOrigin);

  return (
    isLoopbackHost(hostname) ||
    PRODUCTION_AUTH_HOSTS.has(hostname) ||
    hostname.endsWith('.vercel.app')
  );
}

export function resolveAuthOrigin(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const normalizedOrigin = normalizeOrigin(candidate);
    if (!normalizedOrigin || !isAllowedAuthOrigin(normalizedOrigin)) {
      continue;
    }

    const { hostname } = new URL(normalizedOrigin);
    if (PRODUCTION_AUTH_HOSTS.has(hostname)) {
      return CANONICAL_PRODUCTION_AUTH_ORIGIN;
    }

    return normalizedOrigin;
  }

  return CANONICAL_PRODUCTION_AUTH_ORIGIN;
}

export function buildAuthUrl(
  pathname: string,
  ...originCandidates: Array<string | null | undefined>
): string {
  return new URL(pathname, resolveAuthOrigin(...originCandidates)).toString();
}
