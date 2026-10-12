import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import LoginScreen from '@/app/(auth)/login';
import { enableLabelKey, getBiometricStatus, type BiometricStatus } from '@/auth/biometrics';
import { ToastProvider } from '@/components/toast';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translate } from '@/i18n/translate';

import { device, resetNative } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted and must use require()
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const FINGERPRINT = 1;
const FACE = 2;
const IRIS = 3;

function onPlatform(os: 'ios' | 'android') {
  jest.replaceProperty(Platform, 'OS', os);
}

beforeEach(() => resetNative());
afterEach(() => jest.restoreAllMocks());

describe('detected biometric method', () => {
  it('iPhone with Face ID', async () => {
    onPlatform('ios');
    device.types = [FACE];
    await expect(getBiometricStatus()).resolves.toEqual({ state: 'available', kind: 'faceId' });
  });

  it('iPhone with Touch ID', async () => {
    onPlatform('ios');
    device.types = [FINGERPRINT];
    await expect(getBiometricStatus()).resolves.toEqual({ state: 'available', kind: 'touchId' });
  });

  it('Android fingerprint (strong)', async () => {
    onPlatform('android');
    device.types = [FINGERPRINT];
    await expect(getBiometricStatus()).resolves.toEqual({ state: 'available', kind: 'fingerprint' });
  });

  it('Android face unlock certified strong (Class 3) is accepted', async () => {
    onPlatform('android');
    device.types = [FACE];
    await expect(getBiometricStatus()).resolves.toEqual({ state: 'available', kind: 'faceUnlock' });
  });

  it('Android face unlock that is only weak (Class 2) is refused, never used as a fallback', async () => {
    onPlatform('android');
    device.types = [FACE];
    device.level = 2;
    await expect(getBiometricStatus()).resolves.toEqual({ state: 'weak-only', kind: 'faceUnlock' });
  });

  it('Android with several sensors uses the generic label (the system prompt chooses)', async () => {
    onPlatform('android');
    device.types = [FINGERPRINT, FACE];
    await expect(getBiometricStatus()).resolves.toEqual({ state: 'available', kind: 'generic' });
    device.types = [IRIS];
    await expect(getBiometricStatus()).resolves.toEqual({ state: 'available', kind: 'iris' });
  });

  it('unsupported: no hardware, or nothing enrolled', async () => {
    device.hasHardware = false;
    await expect(getBiometricStatus()).resolves.toEqual({ state: 'no-hardware' });
    device.hasHardware = true;
    device.enrolled = false;
    await expect(getBiometricStatus()).resolves.toMatchObject({ state: 'not-enrolled' });
  });

  it('Sécurité switch label follows the method', () => {
    expect(translate('fr', enableLabelKey('faceId'))).toBe('Activer Face ID');
    expect(translate('fr', enableLabelKey('fingerprint'))).toBe('Activer l’empreinte digitale');
    expect(translate('fr', enableLabelKey('faceUnlock'))).toBe('Activer la reconnaissance faciale');
    expect(translate('fr', enableLabelKey('generic'))).toBe('Activer la connexion biométrique');
  });
});

type AuthMock = {
  state: { status: 'signed-out' } | { status: 'locked'; email: string };
  signIn: jest.Mock;
  unlock: jest.Mock;
  enableBiometric: jest.Mock;
  getBiometricStatus: jest.Mock;
};

const mockAuth: AuthMock = {
  state: { status: 'signed-out' },
  signIn: jest.fn(),
  unlock: jest.fn(async () => undefined),
  enableBiometric: jest.fn(async () => ({ ok: true })),
  getBiometricStatus: jest.fn(),
};
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => mockAuth }));

async function renderLogin(status: BiometricStatus) {
  mockAuth.getBiometricStatus.mockResolvedValue(status);
  await AsyncStorage.setItem('app.locale', 'fr');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ToastProvider>
          <LoginScreen />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('login button label', () => {
  beforeEach(() => {
    mockAuth.state = { status: 'signed-out' };
    mockAuth.unlock.mockClear();
  });

  it.each<[BiometricStatus, string]>([
    [{ state: 'available', kind: 'faceId' }, 'Se connecter avec Face ID'],
    [{ state: 'available', kind: 'fingerprint' }, 'Se connecter avec empreinte digitale'],
    [{ state: 'available', kind: 'faceUnlock' }, 'Se connecter avec reconnaissance faciale'],
    [{ state: 'available', kind: 'generic' }, 'Se connecter avec biométrie'],
  ])('%j → %s', async (status, label) => {
    await renderLogin(status);
    expect(await screen.findByText(label)).toBeTruthy();
  });

  it('Face ID session saved: the button unlocks it', async () => {
    mockAuth.state = { status: 'locked', email: 'chef@example.test' };
    await renderLogin({ state: 'available', kind: 'faceId' });
    await fireEvent.press(await screen.findByText('Se connecter avec Face ID'));
    await waitFor(() => expect(mockAuth.unlock).toHaveBeenCalled());
  });

  it('weak-only Android face unlock: explains instead of unlocking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderLogin({ state: 'weak-only', kind: 'faceUnlock' });
    await fireEvent.press(await screen.findByText('Se connecter avec reconnaissance faciale'));
    expect(mockAuth.unlock).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Reconnaissance faciale', expect.stringContaining('pas assez sécurisée'));
  });
});
