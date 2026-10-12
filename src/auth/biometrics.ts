import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricKind = 'faceId' | 'touchId' | 'fingerprint' | 'faceUnlock' | 'iris' | 'generic';

export type BiometricStatus =
  | { state: 'available'; kind: BiometricKind }
  | { state: 'no-hardware' }
  | { state: 'not-enrolled'; kind: BiometricKind }
  /**
   * Android only: the enrolled biometrics are all "weak" (Class 2 — typically
   * camera-based face unlock). The biometric-protected keystore slot used by
   * SecureStore requires BIOMETRIC_STRONG, so they cannot protect the session.
   */
  | { state: 'weak-only'; kind: BiometricKind };

/**
 * Maps the OS-reported authenticator types to the label shown to the user.
 * iOS has one biometric per device (Face ID or Touch ID). On Android the
 * system prompt decides which enrolled method to use, so a device with more
 * than one sensor gets the generic "biometrics" label.
 */
export function resolveKind(
  types: LocalAuthentication.AuthenticationType[],
  platform: typeof Platform.OS = Platform.OS,
): BiometricKind {
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const hasIris = types.includes(LocalAuthentication.AuthenticationType.IRIS);
  if (platform === 'ios') {
    if (hasFace) return 'faceId';
    if (hasFinger) return 'touchId';
    return 'generic';
  }
  const count = [hasFinger, hasFace, hasIris].filter(Boolean).length;
  if (count !== 1) return 'generic';
  if (hasFinger) return 'fingerprint';
  if (hasFace) return 'faceUnlock';
  return 'iris';
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  const [hasHardware, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  if (!hasHardware) return { state: 'no-hardware' };
  const kind = resolveKind(types);
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return { state: 'not-enrolled', kind };
  if (Platform.OS === 'android') {
    // isEnrolledAsync() also accepts weak biometrics; the protected keystore slot does not.
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) return { state: 'weak-only', kind };
  }
  return { state: 'available', kind };
}

/** i18n key of the "enable" label for a given authenticator. */
export function enableLabelKey(kind: BiometricKind): string {
  switch (kind) {
    case 'faceId':
      return 'biometric.enableFaceId';
    case 'touchId':
      return 'biometric.enableTouchId';
    case 'fingerprint':
      return 'biometric.enableFingerprint';
    case 'faceUnlock':
      return 'biometric.enableFaceUnlock';
    default:
      return 'biometric.enableGeneric';
  }
}

export function kindLabelKey(kind: BiometricKind): string {
  const map: Record<BiometricKind, string> = {
    faceId: 'biometric.faceId',
    touchId: 'biometric.touchId',
    fingerprint: 'biometric.fingerprint',
    faceUnlock: 'biometric.faceUnlock',
    iris: 'biometric.iris',
    generic: 'biometric.generic',
  };
  return map[kind];
}

export type PromptOutcome = 'success' | 'cancelled' | 'lockout' | 'unavailable' | 'failed';

/** Explicit OS prompt, used to confirm presence before enabling the feature. */
export async function promptBiometric(message: string, cancelLabel: string): Promise<PromptOutcome> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: message,
    cancelLabel,
    // Only real biometrics may turn the feature on; the passcode is not a biometric.
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'strong',
  });
  if (result.success) return 'success';
  return mapError(result.error);
}

export function mapError(error: string | undefined): PromptOutcome {
  switch (error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
    case 'user_fallback':
      return 'cancelled';
    case 'lockout':
      return 'lockout';
    case 'not_enrolled':
    case 'not_available':
    case 'passcode_not_set':
      return 'unavailable';
    default:
      return 'failed';
  }
}

/**
 * Classifies an exception thrown by SecureStore when reading the
 * biometric-protected token. Invalidated keys (enrollment changed) must force
 * a password sign-in; cancellations keep the session locked (login screen with the biometric button).
 */
export function classifySecureStoreError(error: unknown): 'invalidated' | 'cancelled' | 'unavailable' | 'failed' {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/invalidat|permanently|key.*(changed|not found)|could not be decrypted|decrypt/.test(message)) return 'invalidated';
  if (/cancel/.test(message)) return 'cancelled';
  if (/not available|unavailable|not enrolled|no biometric|nsfaceidusagedescription/.test(message)) return 'unavailable';
  return 'failed';
}
