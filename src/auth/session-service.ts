import { ApiError, rawRequest, request } from '@/api/client';
import type { UserProfile } from '@/api/types';

import { classifySecureStoreError, getBiometricStatus } from './biometrics';
import * as store from './session-store';
import { extractSessionToken, isTokenExpired, readTokenClaims } from './token';

/**
 * Session lifecycle without React: sign-in, restore, biometric unlock and
 * sign-out. Every outcome is an explicit value so the UI can explain it.
 */

export type SignInResult =
  | { ok: true; token: string; user: UserProfile; accountChanged: boolean; biometricKept: boolean }
  | { ok: false; reason: 'invalid-credentials' | 'biometric-only-account' | 'no-session-cookie' | 'server'; message?: string };

export type RestoreResult =
  | { kind: 'signed-out'; reason?: 'expired'; biometricResume?: boolean }
  | { kind: 'locked'; email: string }
  | { kind: 'signed-in'; token: string; user?: UserProfile };

export type UnlockResult =
  | { kind: 'unlocked'; token: string; user?: UserProfile }
  | { kind: 'cancelled' }
  | { kind: 'failed' }
  | { kind: 'signed-out'; reason: 'enrollment-changed' | 'expired'; biometricResume?: boolean };

export async function signIn(email: string, password: string, biometricPrompt: string): Promise<SignInResult> {
  const res = await rawRequest('/api/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
    anonymous: true,
  });

  if (res.status === 401) return { ok: false, reason: 'invalid-credentials' };
  const body = (res.body ?? {}) as { user?: UserProfile; code?: string; error?: string };
  if (res.status === 403 && body.code === 'BIOMETRIC_REQUIRED') return { ok: false, reason: 'biometric-only-account' };
  if (res.status < 200 || res.status >= 300 || !body.user) {
    return { ok: false, reason: 'server', message: body.error ?? `HTTP ${res.status}` };
  }

  const token = extractSessionToken(res.headers.get('set-cookie'));
  if (!token) return { ok: false, reason: 'no-session-cookie' };

  const user = body.user;
  const previous = await store.readMeta();
  const accountChanged = !!previous && previous.userId !== user.id;
  if (accountChanged || !previous) {
    // Never let a previous account's session or biometric setting leak into this one.
    await store.clearAll();
  }

  let biometricKept = false;
  if (previous && !accountChanged && (previous.biometricEnabled || previous.resumeBiometric)) {
    // Same user signing in again (after signing out, or after the 7-day expiry):
    // keep biometric unlock if the OS still accepts a biometric-bound key,
    // otherwise fall back.
    try {
      await store.writeBiometricToken(token, biometricPrompt);
      await store.deletePlainToken();
      biometricKept = true;
    } catch {
      await store.deleteBiometricToken();
    }
  }
  if (!biometricKept) {
    await store.deleteBiometricToken();
    await store.writePlainToken(token);
  }
  await store.writeMeta({ userId: user.id, email: user.email, biometricEnabled: biometricKept, user });

  return { ok: true, token, user, accountChanged, biometricKept };
}

export async function restore(): Promise<RestoreResult> {
  const meta = await store.readMeta();
  if (!meta) {
    await store.clearAll();
    return { kind: 'signed-out' };
  }
  if (meta.biometricEnabled) return { kind: 'locked', email: meta.email };

  if (meta.resumeBiometric) return { kind: 'signed-out', biometricResume: true };

  const token = await store.readPlainToken();
  if (!token) {
    await store.clearAll();
    return { kind: 'signed-out' };
  }
  if (isTokenExpired(token)) {
    await store.clearAll();
    return { kind: 'signed-out', reason: 'expired' };
  }
  return { kind: 'signed-in', token, user: meta.user };
}

export async function unlockWithBiometrics(prompt: string): Promise<UnlockResult> {
  const meta = await store.readMeta();
  const status = await getBiometricStatus();
  if (status.state !== 'available') {
    // Biometrics removed from the device: the protected key is unusable.
    await store.clearAll();
    return { kind: 'signed-out', reason: 'enrollment-changed' };
  }

  let token: string | null;
  try {
    token = await store.readBiometricToken(prompt);
  } catch (error) {
    const kind = classifySecureStoreError(error);
    if (kind === 'invalidated' || kind === 'unavailable') {
      await store.clearAll();
      return { kind: 'signed-out', reason: 'enrollment-changed' };
    }
    return kind === 'cancelled' ? { kind: 'cancelled' } : { kind: 'failed' };
  }

  if (!token) {
    // Android's SecureStore deletes an item whose key was invalidated by an
    // enrollment change and returns null instead of throwing.
    await store.clearAll();
    return { kind: 'signed-out', reason: 'enrollment-changed' };
  }
  if (isTokenExpired(token)) {
    const resume = await expireSession();
    return { kind: 'signed-out', reason: 'expired', biometricResume: resume };
  }
  return { kind: 'unlocked', token, user: meta?.user };
}

export type EnableResult = { ok: true } | { ok: false; reason: 'unavailable' | 'cancelled' | 'lockout' | 'failed' | 'dev-build-required' };

/** Moves the in-memory session into the biometric-protected keystore slot. */
export async function enableBiometric(token: string, prompt: string): Promise<EnableResult> {
  const meta = await store.readMeta();
  if (!meta) return { ok: false, reason: 'failed' };
  try {
    await store.writeBiometricToken(token, prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/NSFaceIDUsageDescription|expo go/i.test(message)) return { ok: false, reason: 'dev-build-required' };
    const kind = classifySecureStoreError(error);
    return { ok: false, reason: kind === 'cancelled' ? 'cancelled' : kind === 'unavailable' ? 'unavailable' : 'failed' };
  }
  await store.deletePlainToken();
  await store.writeMeta({ ...meta, biometricEnabled: true });
  return { ok: true };
}

export async function disableBiometric(token: string): Promise<void> {
  const meta = await store.readMeta();
  await store.writePlainToken(token);
  await store.deleteBiometricToken();
  if (meta) await store.writeMeta({ ...meta, biometricEnabled: false });
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await store.readMeta())?.biometricEnabled === true;
}

async function serverLogout(token: string | null) {
  if (!token) return;
  try {
    await request('/api/auth/logout', { method: 'POST', body: {}, anonymous: true });
  } catch {
    // The JWT is stateless server-side; local deletion is what ends the session here.
  }
}

export type SignOutResult = { kind: 'signed-out' } | { kind: 'locked'; email: string };

/**
 * User-initiated sign-out. With biometric sign-in enabled, the session stays
 * on the device only in the biometric-protected slot (the readable copy is
 * deleted), so the next sign-in works with fingerprint / Face ID — the same
 * protection as the automatic re-lock. Without it, every trace is wiped.
 */
export async function signOut(token: string | null): Promise<SignOutResult> {
  await serverLogout(token);
  const meta = await store.readMeta();
  if (meta?.biometricEnabled) {
    await store.deletePlainToken();
    return { kind: 'locked', email: meta.email };
  }
  await store.clearAll();
  return { kind: 'signed-out' };
}

/**
 * The server no longer accepts the token (401 or `exp` passed): wipe it, but
 * remember that biometric sign-in was on so the next password login of the
 * same account re-enables it. Returns true when that was the case.
 */
export async function expireSession(): Promise<boolean> {
  const meta = await store.readMeta();
  await store.clearAll();
  const resume = !!meta && (meta.biometricEnabled || meta.resumeBiometric === true);
  if (meta && resume) await store.writeMeta({ userId: meta.userId, email: meta.email, biometricEnabled: false, resumeBiometric: true });
  return resume;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const body = await request<{ user: UserProfile | null }>('/api/auth/me');
  if (!body.user) throw new ApiError('Unauthorized', 'http', 401);
  const meta = await store.readMeta();
  if (meta && meta.userId === body.user.id) await store.writeMeta({ ...meta, email: body.user.email, user: body.user });
  return body.user;
}

export function tokenUserId(token: string): string | undefined {
  return readTokenClaims(token)?.userId;
}
