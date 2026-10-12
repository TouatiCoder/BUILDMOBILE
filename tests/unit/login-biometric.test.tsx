import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import LoginScreen from '@/app/(auth)/login';
import { ToastProvider } from '@/components/toast';
import { I18nProvider } from '@/i18n/I18nProvider';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted and must use require()
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

type AuthMock = {
  state: { status: 'signed-out'; biometricResume?: boolean } | { status: 'locked'; email: string; autoPrompt?: boolean };
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
  getBiometricStatus: jest.fn(async () => ({ state: 'available', kind: 'fingerprint' })),
};

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => mockAuth }));

async function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
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

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('app.locale', 'fr');
  mockAuth.state = { status: 'signed-out' };
});

describe('login screen — fingerprint / Face ID button', () => {
  it('with a saved biometric session: prompts automatically and on tap, email pre-filled', async () => {
    mockAuth.state = { status: 'locked', email: 'chef@example.test' };
    await renderLogin();
    const button = await screen.findByText('Se connecter avec empreinte digitale');
    await waitFor(() => expect(mockAuth.unlock).toHaveBeenCalledTimes(1)); // automatic prompt
    await fireEvent.press(button);
    await waitFor(() => expect(mockAuth.unlock).toHaveBeenCalledTimes(2));
    expect(screen.getByDisplayValue('chef@example.test')).toBeTruthy();
  });

  it('after signing out with biometrics enabled: no automatic prompt, the button unlocks', async () => {
    mockAuth.state = { status: 'locked', email: 'chef@example.test', autoPrompt: false };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderLogin();
    const button = await screen.findByText('Se connecter avec empreinte digitale');
    expect(mockAuth.unlock).not.toHaveBeenCalled();
    await fireEvent.press(button);
    await waitFor(() => expect(mockAuth.unlock).toHaveBeenCalledTimes(1));
    expect(alert).not.toHaveBeenCalled();
  });

  it('after an expiry with biometrics enabled: says it resumes after one password login', async () => {
    mockAuth.state = { status: 'signed-out', biometricResume: true };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderLogin();
    await fireEvent.press(await screen.findByText('Se connecter avec empreinte digitale'));
    expect(mockAuth.unlock).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Connexion rapide', expect.stringContaining('réactivé automatiquement'));
  });

  it('without a saved session: explains that a first password login is needed (no unlock attempt)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderLogin();
    await fireEvent.press(await screen.findByText('Se connecter avec empreinte digitale'));
    expect(mockAuth.unlock).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Connexion rapide', expect.stringContaining('mot de passe'));
  });

  it('hides the button on a device without biometric hardware', async () => {
    mockAuth.getBiometricStatus.mockResolvedValueOnce({ state: 'no-hardware' });
    await renderLogin();
    await screen.findByText('Se connecter');
    await waitFor(() => expect(mockAuth.getBiometricStatus).toHaveBeenCalled());
    expect(screen.queryByText(/Se connecter avec/)).toBeNull();
  });

  it('after a password login, offers to enable biometrics — unless declined before', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockAuth.signIn.mockResolvedValue({ ok: true, biometricEnabled: false });
    await renderLogin();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'chef@example.test');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'secret');
    await fireEvent.press(screen.getByText('Se connecter'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Connexion rapide', expect.stringContaining('empreinte digitale'), expect.any(Array)));

    alert.mockClear();
    await AsyncStorage.setItem('app.biometricOfferDismissed', '1');
    await fireEvent.press(screen.getByText('Se connecter'));
    await waitFor(() => expect(mockAuth.signIn).toHaveBeenCalledTimes(2));
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('login screen — layout', () => {
  it('places the fingerprint / Face ID button below "Se connecter"', async () => {
    await renderLogin();
    await screen.findByText('Se connecter avec empreinte digitale');
    const texts = screen.getAllByText(/^(Se connecter|Se connecter avec empreinte digitale)$/).map((n) => n.props.children);
    expect(texts).toEqual(['Se connecter', 'Se connecter avec empreinte digitale']);
  });
});
