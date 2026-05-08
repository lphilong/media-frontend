const DEFAULT_RETURN_TARGET = '/dashboard';
const DISALLOWED_RETURN_PATHS = new Set(['/auth/login', '/auth/callback']);

const sanitizeReturnTarget = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value, window.location.origin);
  } catch {
    return null;
  }

  if (parsed.origin !== window.location.origin || DISALLOWED_RETURN_PATHS.has(parsed.pathname)) {
    return null;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

export const resolveReturnTarget = (
  candidate: string | null | undefined,
  fallback = DEFAULT_RETURN_TARGET,
): string => {
  return sanitizeReturnTarget(candidate) ?? sanitizeReturnTarget(fallback) ?? DEFAULT_RETURN_TARGET;
};
