import { bindSession, request } from '@/api/client';
import * as session from '@/auth/session-service';

import { device, makeToken, mockFetch, resetNative, secure } from './helpers';

const future = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
const past = Math.floor(Date.now() / 1000) - 60;
const userA = { id: 'user-a', email: 'a@example.test', firstName: 'A', lastName: 'A', role: 'admin', companyId: 'c1', isPlatformAdmin: false };
const userB = { ...userA, id: 'user-b', email: 'b@example.test' };

function loginRoute(user = userA, exp = future) {
  const token = makeToken({ userId: user.id, exp });
  const calls = mockFetch(({ url }) => {
    if (url.endsWith('/api/auth/login')) {
      return { status: 200, body: { success: true, user }, headers: { 'set-cookie': `auth-token=${token}; Path=/; HttpOnly; SameSite=lax` } };
    }
    if (url.endsWith('/api/auth/logout')) return { status: 200, body: { success: true } };
    return { status: 404, body: { error: 'not found' } };
  });
  return { token, calls };
}

beforeEach(() => resetNative());

describe('initial login (existing account system)', () => {
  it('stores the session cookie token in the keystore, never the password', async () => {
    const { token, calls } = loginRoute();
    const res = await session.signIn('a@example.test', 'S3cret!pw', 'prompt');
    expect(res.ok).toBe(true);
    expect(calls[0].url).toBe('http://api.test/api/auth/login');
    expect(calls[0].credentials).toBe('omit');
    const stored = [...secure.items.values()].map((i) => i.value).join('|');
    expect(stored).toContain(token);
    expect(stored).not.toContain('S3cret!pw');
  });

  it('rejects invalid credentials (401) without storing anything', async () => {
    mockFetch(() => ({ status: 401, body: { error: 'Email ou mot de passe incorrect' } }));
    const res = await session.signIn('a@example.test', 'bad', 'prompt');
    expect(res).toEqual({ ok: false, reason: 'invalid-credentials' });
    expect(secure.items.size).toBe(0);
  });

  it('reports accounts restricted to WebAuthn (403 BIOMETRIC_REQUIRED)', async () => {
    mockFetch(() => ({ status: 403, body: { code: 'BIOMETRIC_REQUIRED' } }));
    const res = await session.signIn('a@example.test', 'pw', 'prompt');
    expect(res).toEqual({ ok: false, reason: 'biometric-only-account' });
  });

  it('fails explicitly when the server returns no session cookie', async () => {
    mockFetch(() => ({ status: 200, body: { user: userA } }));
    const res = await session.signIn('a@example.test', 'pw', 'prompt');
    expect(res).toEqual({ ok: false, reason: 'no-session-cookie' });
  });
});

describe('restore on app start', () => {
  it('restores a valid session (with the profile snapshot) when biometrics are disabled', async () => {
    const { token } = loginRoute();
    await session.signIn('a@example.test', 'pw', 'prompt');
    await expect(session.restore()).resolves.toMatchObject({ kind: 'signed-in', token, user: { id: userA.id, role: 'admin' } });
  });

  it('treats an expired server session as signed out and wipes it', async () => {
    loginRoute(userA, past);
    await session.signIn('a@example.test', 'pw', 'prompt');
    await expect(session.restore()).resolves.toEqual({ kind: 'signed-out', reason: 'expired' });
    expect(secure.items.size).toBe(0);
  });

  it('asks for biometric unlock when enabled', async () => {
    const { token } = loginRoute();
    await session.signIn('a@example.test', 'pw', 'prompt');
    await session.enableBiometric(token, 'prompt');
    await expect(session.restore()).resolves.toEqual({ kind: 'locked', email: userA.email });
  });
});

describe('biometric enable / unlock', () => {
  async function signedInWithBiometrics() {
    const { token } = loginRoute();
    await session.signIn('a@example.test', 'pw', 'prompt');
    await expect(session.enableBiometric(token, 'prompt')).resolves.toEqual({ ok: true });
    return token;
  }

  it('moves the token to the biometric-protected slot only', async () => {
    const token = await signedInWithBiometrics();
    const protectedItems = [...secure.items.values()].filter((i) => i.value === token);
    expect(protectedItems).toHaveLength(1);
    expect(protectedItems[0].requireAuth).toBe(true);
  });

  it('successful biometric authentication unlocks the stored session', async () => {
    const token = await signedInWithBiometrics();
    await expect(session.unlockWithBiometrics('prompt')).resolves.toMatchObject({ kind: 'unlocked', token, user: { id: userA.id, role: 'admin' } });
  });

  it('user cancelling the prompt keeps the session locked (not wiped)', async () => {
    await signedInWithBiometrics();
    secure.nextBioRead = 'cancel';
    await expect(session.unlockWithBiometrics('prompt')).resolves.toEqual({ kind: 'cancelled' });
    expect(await session.isBiometricEnabled()).toBe(true);
  });

  it('enrollment change (invalidated key) forces password sign-in', async () => {
    await signedInWithBiometrics();
    secure.nextBioRead = 'invalidated';
    await expect(session.unlockWithBiometrics('prompt')).resolves.toEqual({ kind: 'signed-out', reason: 'enrollment-changed' });
    expect(secure.items.size).toBe(0);
  });

  it('Android invalidation (item deleted, null returned) is reported as an enrollment change', async () => {
    await signedInWithBiometrics();
    secure.nextBioRead = 'invalidated-silent';
    await expect(session.unlockWithBiometrics('prompt')).resolves.toEqual({ kind: 'signed-out', reason: 'enrollment-changed' });
    expect(secure.items.size).toBe(0);
  });

  it('biometrics removed from the device disables biometric unlock', async () => {
    await signedInWithBiometrics();
    device.enrolled = false;
    await expect(session.unlockWithBiometrics('prompt')).resolves.toEqual({ kind: 'signed-out', reason: 'enrollment-changed' });
    expect(secure.items.size).toBe(0);
  });

  it('device without biometric hardware cannot unlock', async () => {
    await signedInWithBiometrics();
    device.hasHardware = false;
    const res = await session.unlockWithBiometrics('prompt');
    expect(res.kind).toBe('signed-out');
  });

  it('reports a failed keystore write (e.g. Expo Go without Face ID permission)', async () => {
    const { token } = loginRoute();
    await session.signIn('a@example.test', 'pw', 'prompt');
    secure.failBioWrite = 'Missing NSFaceIDUsageDescription';
    await expect(session.enableBiometric(token, 'prompt')).resolves.toEqual({ ok: false, reason: 'dev-build-required' });
    // Normal authentication keeps working.
    await expect(session.restore()).resolves.toMatchObject({ kind: 'signed-in', token });
  });

  it('disabling moves the session back to the normal slot', async () => {
    const token = await signedInWithBiometrics();
    await session.disableBiometric(token);
    expect(await session.isBiometricEnabled()).toBe(false);
    await expect(session.restore()).resolves.toMatchObject({ kind: 'signed-in', token });
  });
});

describe('logout and account switching', () => {
  it('logout without biometrics clears every trace of the session', async () => {
    const { token } = loginRoute();
    await session.signIn('a@example.test', 'pw', 'prompt');
    await expect(session.signOut(token)).resolves.toEqual({ kind: 'signed-out' });
    expect(secure.items.size).toBe(0);
    await expect(session.restore()).resolves.toEqual({ kind: 'signed-out' });
  });

  it('logout with biometrics keeps only the protected slot, so the next sign-in uses the fingerprint', async () => {
    const { token } = loginRoute();
    await session.signIn('a@example.test', 'pw', 'prompt');
    await session.enableBiometric(token, 'prompt');
    await expect(session.signOut(token)).resolves.toEqual({ kind: 'locked', email: userA.email });
    const copies = [...secure.items.values()].filter((i) => i.value === token);
    expect(copies).toHaveLength(1);
    expect(copies[0].requireAuth).toBe(true);
    await expect(session.restore()).resolves.toEqual({ kind: 'locked', email: userA.email });
    await expect(session.unlockWithBiometrics('prompt')).resolves.toMatchObject({ kind: 'unlocked', token });
  });

  it('expired biometric session: password once, then biometric unlock resumes automatically', async () => {
    const expired = loginRoute(userA, past);
    await session.signIn('a@example.test', 'pw', 'prompt');
    await session.enableBiometric(expired.token, 'prompt');
    await expect(session.unlockWithBiometrics('prompt')).resolves.toEqual({ kind: 'signed-out', reason: 'expired', biometricResume: true });
    expect([...secure.items.values()].some((i) => i.value === expired.token)).toBe(false);
    await expect(session.restore()).resolves.toEqual({ kind: 'signed-out', biometricResume: true });

    const fresh = loginRoute(userA);
    const res = await session.signIn('a@example.test', 'pw', 'prompt');
    expect(res.ok && res.biometricKept).toBe(true);
    await expect(session.restore()).resolves.toEqual({ kind: 'locked', email: userA.email });
    await expect(session.unlockWithBiometrics('prompt')).resolves.toMatchObject({ kind: 'unlocked', token: fresh.token });
  });

  it('a 401 on a biometric session keeps only the resume flag, no token', async () => {
    const { token } = loginRoute();
    await session.signIn('a@example.test', 'pw', 'prompt');
    await session.enableBiometric(token, 'prompt');
    await expect(session.expireSession()).resolves.toBe(true);
    expect([...secure.items.values()].some((i) => i.value === token)).toBe(false);
  });

  it('another user signing in after a biometric logout does not inherit it', async () => {
    const first = loginRoute(userA);
    await session.signIn('a@example.test', 'pw', 'prompt');
    await session.enableBiometric(first.token, 'prompt');
    await session.signOut(first.token);
    loginRoute(userB);
    const res = await session.signIn('b@example.test', 'pw', 'prompt');
    expect(res.ok && res.biometricKept).toBe(false);
    expect([...secure.items.values()].some((i) => i.value === first.token)).toBe(false);
  });

  it('signing in as another user drops the previous user biometric setting', async () => {
    const first = loginRoute(userA);
    await session.signIn('a@example.test', 'pw', 'prompt');
    await session.enableBiometric(first.token, 'prompt');

    const second = loginRoute(userB);
    const res = await session.signIn('b@example.test', 'pw', 'prompt');
    expect(res.ok && res.accountChanged).toBe(true);
    expect(res.ok && res.biometricKept).toBe(false);
    expect([...secure.items.values()].some((i) => i.value === first.token)).toBe(false);
    await expect(session.restore()).resolves.toMatchObject({ kind: 'signed-in', token: second.token });
  });

  it('same user signing in again keeps biometric unlock', async () => {
    const first = loginRoute(userA);
    await session.signIn('a@example.test', 'pw', 'prompt');
    await session.enableBiometric(first.token, 'prompt');
    loginRoute(userA);
    const res = await session.signIn('a@example.test', 'pw', 'prompt');
    expect(res.ok && res.biometricKept).toBe(true);
  });
});

describe('API client session handling', () => {
  it('sends the session as a Cookie header and triggers the expiry handler on 401', async () => {
    const onUnauthorized = jest.fn();
    bindSession({ getToken: () => 'tok123', onUnauthorized });
    const calls = mockFetch(() => ({ status: 401, body: { error: 'Unauthorized' } }));
    await expect(request('/api/projects')).rejects.toMatchObject({ status: 401 });
    expect((calls[0].headers as Record<string, string>).Cookie).toBe('auth-token=tok123');
    expect(calls[0].credentials).toBe('omit');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('never sends the session on anonymous requests', async () => {
    bindSession({ getToken: () => 'tok123', onUnauthorized: jest.fn() });
    const calls = mockFetch(() => ({ status: 200, body: {} }));
    await request('/api/auth/forgot-password', { method: 'POST', body: {}, anonymous: true });
    expect((calls[0].headers as Record<string, string>).Cookie).toBeUndefined();
  });

  it('surfaces server validation messages', async () => {
    bindSession({ getToken: () => 't', onUnauthorized: jest.fn() });
    mockFetch(() => ({ status: 400, body: { error: 'Project name is required' } }));
    await expect(request('/api/projects', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 400, message: 'Project name is required' });
  });
});
