import * as SecureStore from 'expo-secure-store';

import type { UserProfile } from '@/api/types';

/**
 * Persistence of the session token in the platform keystore (iOS Keychain /
 * Android Keystore-backed storage). Nothing here ever touches AsyncStorage.
 *
 * Two mutually exclusive slots:
 * - PLAIN: readable while the device is unlocked (biometric unlock disabled).
 * - BIOMETRIC: written with `requireAuthentication`, so the OS demands Face ID /
 *   Touch ID / fingerprint before releasing it, and invalidates the key when the
 *   device's biometric enrollment changes.
 */
const TOKEN_KEY = 'bs.session.token';
const BIOMETRIC_TOKEN_KEY = 'bs.session.token.biometric';
const META_KEY = 'bs.session.meta';

const baseOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type SessionMeta = {
  userId: string;
  email: string;
  biometricEnabled: boolean;
  /**
   * Biometric sign-in was on when the session expired: the next password login
   * of the same account turns it back on without asking again.
   */
  resumeBiometric?: boolean;
  /** Non-secret profile snapshot so role-based navigation works before /api/auth/me answers. */
  user?: UserProfile;
};

export async function readMeta(): Promise<SessionMeta | null> {
  const raw = await SecureStore.getItemAsync(META_KEY, baseOptions);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionMeta>;
    if (typeof parsed.userId !== 'string' || typeof parsed.email !== 'string') return null;
    return {
      userId: parsed.userId,
      email: parsed.email,
      biometricEnabled: parsed.biometricEnabled === true,
      resumeBiometric: parsed.resumeBiometric === true,
      user: parsed.user,
    };
  } catch {
    return null;
  }
}

export async function writeMeta(meta: SessionMeta): Promise<void> {
  await SecureStore.setItemAsync(META_KEY, JSON.stringify(meta), baseOptions);
}

export async function readPlainToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY, baseOptions);
}

export async function writePlainToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, baseOptions);
}

/** Triggers the OS biometric prompt. Throws when cancelled, failed or invalidated. */
export async function readBiometricToken(prompt: string): Promise<string | null> {
  return SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY, {
    ...baseOptions,
    requireAuthentication: true,
    authenticationPrompt: prompt,
  });
}

export async function writeBiometricToken(token: string, prompt: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token, {
    ...baseOptions,
    requireAuthentication: true,
    authenticationPrompt: prompt,
  });
}

async function safeDelete(key: string, options: SecureStore.SecureStoreOptions) {
  try {
    await SecureStore.deleteItemAsync(key, options);
  } catch {
    // Already gone or key invalidated: nothing left to protect.
  }
}

export async function deleteBiometricToken(): Promise<void> {
  await safeDelete(BIOMETRIC_TOKEN_KEY, { ...baseOptions, requireAuthentication: true });
  await safeDelete(BIOMETRIC_TOKEN_KEY, baseOptions);
}

export async function deletePlainToken(): Promise<void> {
  await safeDelete(TOKEN_KEY, baseOptions);
}

/** Removes every piece of session material from the device. */
export async function clearAll(): Promise<void> {
  await deletePlainToken();
  await deleteBiometricToken();
  await safeDelete(META_KEY, baseOptions);
}
