/**
 * In-memory stand-ins for the native modules. They model the platform
 * behaviour the app relies on: SecureStore items written with
 * `requireAuthentication` can only be read through an OS prompt whose outcome
 * the test controls, and they become unreadable after an enrollment change.
 */
type BioBehaviour = 'success' | 'cancel' | 'invalidated' | 'invalidated-silent';

const mockSecure = {
  items: new Map<string, { value: string; requireAuth: boolean }>(),
  nextBioRead: 'success' as BioBehaviour,
  failBioWrite: null as string | null,
};

const mockDevice = {
  hasHardware: true,
  enrolled: true,
  types: [2] as number[],
  promptResult: { success: true } as { success: boolean; error?: string },
  /** SecurityLevel reported by getEnrolledLevelAsync (3 = BIOMETRIC_STRONG). */
  level: 3,
};

(globalThis as Record<string, unknown>).__secure = mockSecure;
(globalThis as Record<string, unknown>).__device = mockDevice;

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (key: string, options?: { requireAuthentication?: boolean }) => {
    const item = mockSecure.items.get(key);
    if (!item) return null;
    if (item.requireAuth) {
      if (!options?.requireAuthentication) throw new Error('Item requires authentication');
      if (mockSecure.nextBioRead === 'cancel') throw new Error('User canceled the authentication');
      if (mockSecure.nextBioRead === 'invalidated-silent') {
        mockSecure.items.delete(key);
        return null;
      }
      if (mockSecure.nextBioRead === 'invalidated') throw new Error('KeyPermanentlyInvalidatedException: Key permanently invalidated');
    }
    return item.value;
  }),
  setItemAsync: jest.fn(async (key: string, value: string, options?: { requireAuthentication?: boolean }) => {
    if (options?.requireAuthentication && mockSecure.failBioWrite) throw new Error(mockSecure.failBioWrite);
    mockSecure.items.set(key, { value, requireAuth: !!options?.requireAuthentication });
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecure.items.delete(key);
  }),
}));

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(async () => (mockDevice.enrolled ? mockDevice.level : 0)),
  hasHardwareAsync: jest.fn(async () => mockDevice.hasHardware),
  isEnrolledAsync: jest.fn(async () => mockDevice.enrolled),
  supportedAuthenticationTypesAsync: jest.fn(async () => mockDevice.types),
  authenticateAsync: jest.fn(async () => mockDevice.promptResult),
}));

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

jest.mock('@react-native-async-storage/async-storage', () =>
  // jest.mock factories are hoisted and must use require().
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr', languageTag: 'fr-FR' }],
}));
