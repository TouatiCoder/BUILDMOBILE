import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SubscriptionScreen from '@/app/(app)/settings/subscription';
import SignupScreen from '@/app/(auth)/signup';
import { ToastProvider } from '@/components/toast';
import { I18nProvider } from '@/i18n/I18nProvider';
import { computeCadencePrice, PLAN_MONTHLY_MAD } from '@/lib/pricing';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted and must use require()
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) }));

const mockSignIn = jest.fn();
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ signIn: mockSignIn, user: { role: 'admin' } }) }));
jest.mock('@/hooks/common', () => {
  const actual = jest.requireActual('@/hooks/common');
  return { ...actual, usePermissions: () => ({ isAdmin: true, role: 'admin', can: () => true, isFieldRole: false }) };
});

const mockApi = {
  status: jest.fn(async () => ({ open: true })),
  register: jest.fn(async (_input: unknown): Promise<unknown> => undefined),
  subscription: jest.fn(),
  paymentMethods: jest.fn(async () => ({ stripe: true, paypal: false, cash: true })),
  checkout: jest.fn(async (_input: unknown) => ({ checkout_url: 'https://checkout.stripe.test/session/abc' })),
  manualRequest: jest.fn(async (_input: unknown) => ({ item: {} })),
  changePlan: jest.fn(async (_plan: string) => ({})),
};
jest.mock('@/api/endpoints', () => ({
  registrationApi: { status: () => mockApi.status(), register: (i: unknown) => mockApi.register(i) },
  companyApi: { subscription: () => mockApi.subscription() },
  billingApi: {
    paymentMethods: () => mockApi.paymentMethods(),
    checkout: (i: unknown) => mockApi.checkout(i),
    manualRequest: (i: unknown) => mockApi.manualRequest(i),
    changePlan: (p: string) => mockApi.changePlan(p),
  },
}));

const freeSubscription = {
  subscription: {
    id: 's1',
    status: 'free',
    planCode: 'free',
    planName: 'Free',
    price: 0,
    isTrialing: false,
    trialDaysLeft: null,
    trialExpired: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    features: {},
  },
  plans: [
    { code: 'enterprise', name: 'Enterprise', price: 500, isCurrent: false, features: [] },
    { code: 'free', name: 'Free', price: 0, isCurrent: true, features: [{ featureCode: 'max_projects', limitValue: 2, enabled: true }] },
    { code: 'pro', name: 'Pro', price: 300, isCurrent: false, features: [] },
  ],
  pendingPayment: null,
};

async function renderWith(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ToastProvider>{node}</ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('app.locale', 'fr');
  mockApi.subscription.mockResolvedValue(freeSubscription);
});

describe('pricing mirrors the website', () => {
  it('applies the quarterly (-10 %) and annual (-20 %) discounts', () => {
    expect(computeCadencePrice(PLAN_MONTHLY_MAD.pro, 'monthly')).toEqual({ totalMad: 300, perMonthMad: 300, months: 1 });
    expect(computeCadencePrice(PLAN_MONTHLY_MAD.pro, 'quarterly')).toEqual({ totalMad: 810, perMonthMad: 270, months: 3 });
    expect(computeCadencePrice(PLAN_MONTHLY_MAD.enterprise, 'annual')).toEqual({ totalMad: 4800, perMonthMad: 400, months: 12 });
  });
});

describe('sign-up (company admin only)', () => {
  async function fillForm() {
    await fireEvent.changeText(await screen.findByLabelText("Nom de l'entreprise"), 'Atlas BTP');
    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Sara');
    await fireEvent.changeText(screen.getByLabelText('Nom'), 'Alaoui');
    await fireEvent.changeText(screen.getByLabelText('Email professionnel'), 'Sara@Atlas.test');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'Secure123');
    await fireEvent.changeText(screen.getByLabelText('Confirmer le mot de passe'), 'Secure123');
  }

  it('registers the company + admin, then signs in', async () => {
    mockApi.register.mockResolvedValue({ success: true, isPlatformAdmin: false });
    mockSignIn.mockResolvedValue({ ok: true, biometricEnabled: false });
    await renderWith(<SignupScreen />);
    await fillForm();
    await fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('sara@atlas.test', 'Secure123'));
    expect(mockApi.register).toHaveBeenCalledWith({
      companyName: 'Atlas BTP',
      siret: null,
      firstName: 'Sara',
      lastName: 'Alaoui',
      email: 'sara@atlas.test',
      password: 'Secure123',
    });
  }, 15000);

  it('never continues with a super-admin account', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockApi.register.mockResolvedValue({ success: true, isPlatformAdmin: true });
    await renderWith(<SignupScreen />);
    await fillForm();
    await fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('enforces the server password rules before calling the API', async () => {
    await renderWith(<SignupScreen />);
    await fillForm();
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'weakpass');
    await fireEvent.changeText(screen.getByLabelText('Confirmer le mot de passe'), 'weakpass');
    await fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(screen.getAllByText('Au moins 8 caractères').length).toBeGreaterThan(0));
    expect(mockApi.register).not.toHaveBeenCalled();
  });
});

describe('subscription purchase inside the app', () => {
  it('card: creates a Stripe checkout and opens it in the in-app browser', async () => {
    const WebBrowser = jest.requireMock('expo-web-browser') as { openBrowserAsync: jest.Mock };
    await renderWith(<SubscriptionScreen />);
    await fireEvent.press(await screen.findByText('Annuel (-20%)'));
    const choose = await screen.findAllByText('Choisir ce plan'); // Pro, Enterprise (sorted free, pro, enterprise)
    await fireEvent.press(choose[0]);
    await fireEvent.press(await screen.findByText('Carte bancaire (Stripe)'));
    await waitFor(() =>
      expect(mockApi.checkout).toHaveBeenCalledWith(expect.objectContaining({ planCode: 'pro', cadence: 'annual', idempotencyKey: expect.any(String) })),
    );
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://checkout.stripe.test/session/abc', expect.any(Object)));
  });

  it('cash: sends a manual payment request (confirmed later by the platform admin)', async () => {
    await renderWith(<SubscriptionScreen />);
    const choose = await screen.findAllByText('Choisir ce plan');
    await fireEvent.press(choose[1]);
    await fireEvent.press(await screen.findByText('Espèces'));
    await waitFor(() => expect(mockApi.manualRequest).toHaveBeenCalledWith({ planCode: 'enterprise', cadence: 'monthly', method: 'cash' }));
  });

  it('only offers the payment methods enabled on the server', async () => {
    await renderWith(<SubscriptionScreen />);
    await fireEvent.press((await screen.findAllByText('Choisir ce plan'))[0]);
    await screen.findByText('Carte bancaire (Stripe)');
    expect(screen.queryByText('PayPal')).toBeNull();
  });

  it('blocks new purchases while a payment is pending', async () => {
    mockApi.subscription.mockResolvedValue({
      ...freeSubscription,
      pendingPayment: { planCode: 'pro', cadence: 'monthly', amountMad: 300, method: 'cash', status: 'pending' },
    });
    await renderWith(<SubscriptionScreen />);
    await screen.findByText(/en attente de confirmation/);
    const choose = await screen.findAllByText('Choisir ce plan');
    await fireEvent.press(choose[0]);
    expect(screen.queryByText('Carte bancaire (Stripe)')).toBeNull();
  });
});
