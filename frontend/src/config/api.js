const rawBaseUrl = (process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');

/**
 * Build an API URL. Uses REACT_APP_API_URL in production; falls back to
 * same-origin paths (works with package.json "proxy" in local dev).
 */
export function getApiUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return rawBaseUrl ? `${rawBaseUrl}${normalizedPath}` : normalizedPath;
}

export const API_BASE_URL = rawBaseUrl;
