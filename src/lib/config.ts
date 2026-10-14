/**
 * Public client configuration. EXPO_PUBLIC_* variables are inlined into the
 * JavaScript bundle, so they must never contain secrets.
 */
function normalizeBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  return value;
}

// Production fallback points to the same deployed BuildStock backend used by the website.
// EXPO_PUBLIC_API_URL still overrides this for local development or other environments.
export const API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || 'http://2.24.139.220:3001',
);

/** Web address used for features that are only available on the website. */
export const WEB_APP_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_WEB_URL) || API_BASE_URL;

export const REQUEST_TIMEOUT_MS = 20_000;

/** How long the app may stay in background before biometric re-lock. */
export const RELOCK_AFTER_BACKGROUND_MS = 60_000;

export function assertApiConfigured(): void {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and set the backend URL.');
  }
}
