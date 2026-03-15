const DEFAULT_AUTH_REDIRECT_PATH = '/dashboard';

export function sanitizeAuthNextPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_AUTH_REDIRECT_PATH
): string {
  if (!next) {
    return fallback;
  }

  const trimmedNext = next.trim();
  if (!trimmedNext.startsWith('/') || trimmedNext.startsWith('//')) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmedNext, 'http://publisheriq.local');
    if (parsed.origin !== 'http://publisheriq.local') {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getAuthNextPathFromUrl(url: URL): string {
  return sanitizeAuthNextPath(`${url.pathname}${url.search}`);
}
