/**
 * Helpers around the website's session token.
 *
 * The backend (livreee/app/api/auth/login/route.ts) returns the session only as
 * an HttpOnly `auth-token` cookie holding an HS256 JWT. Native HTTP clients
 * expose response headers to JavaScript, so the app reads the token from
 * `Set-Cookie`, keeps it in the platform keystore and replays it as a `Cookie`
 * request header. The JWT is never verified client-side (the secret stays on the
 * server); its `exp` is only read to skip a pointless unlock of an expired session.
 */
export const SESSION_COOKIE_NAME = 'auth-token';

export function extractSessionToken(setCookieHeader: string | null | undefined): string | null {
  if (!setCookieHeader) return null;
  // Several cookies may be folded into one header separated by ", ".
  const match = setCookieHeader.match(/(?:^|[\s,;])auth-token=([^;,\s]+)/);
  if (!match) return null;
  const token = match[1];
  return token && token !== 'deleted' ? token : null;
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  if (typeof atob === 'function') return atob(padded);
  throw new Error('No base64 decoder available');
}

export type SessionClaims = { userId?: string; exp?: number; companyId?: string };

export function readTokenClaims(token: string): SessionClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(decodeBase64Url(parts[1]));
    return typeof json === 'object' && json ? (json as SessionClaims) : null;
  } catch {
    return null;
  }
}

/** True when the token carries an `exp` in the past (with a small safety margin). */
export function isTokenExpired(token: string, nowMs = Date.now(), marginSeconds = 30): boolean {
  const exp = readTokenClaims(token)?.exp;
  if (typeof exp !== 'number') return false;
  return exp * 1000 <= nowMs + marginSeconds * 1000;
}
