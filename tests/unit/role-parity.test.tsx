import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';
import { router, Slot, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Text } from 'react-native';

import AppLayout from '@/app/(app)/_layout';
import TabsLayout from '@/app/(app)/(tabs)/_layout';
import MoreScreen from '@/app/(app)/(tabs)/more';
import ToolsHubScreen from '@/app/(app)/tools';
import { ToastProvider } from '@/components/toast';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translate } from '@/i18n/translate';
import { canAccess, FEATURE_RULES, ROUTE_FEATURES, TAB_FEATURES, type Feature } from '@/lib/access';

/**
 * Mobile ↔ website role parity. The expected values below are read off the
 * website (livreee): components/layout/nav-pages.ts, app/settings/settings-client.tsx,
 * the page guards of checklists / tools / calculations, and the API role
 * checks for actions. See docs/ROLE_PARITY.md.
 */
const ROLES = ['admin', 'site_manager', 'structural_engineer', 'user'] as const;
type Role = (typeof ROLES)[number];

const EXPECTED: Record<Feature, Role[]> = {
  dashboard: ['admin', 'site_manager', 'structural_engineer', 'user'],
  inventory: ['admin', 'site_manager'],
  'inventory.manage': ['admin', 'site_manager'],
  projects: ['admin', 'site_manager', 'structural_engineer'],
  'projects.create': ['admin', 'site_manager'],
  'projects.edit': ['admin', 'site_manager', 'structural_engineer'],
  'projects.delete': ['admin', 'site_manager'],
  'projects.status': ['admin', 'site_manager'],
  costs: ['admin', 'site_manager'],
  'orders.create': ['admin'],
  'orders.edit': ['admin', 'site_manager'],
  suppliers: ['admin', 'site_manager'],
  reports: ['admin', 'site_manager', 'structural_engineer'],
  notifications: ['admin', 'site_manager', 'structural_engineer'],
  company: ['admin'],
  users: ['admin'],
  subscription: ['admin'],
  checklists: ['site_manager', 'structural_engineer'],
  tools: ['site_manager', 'structural_engineer'],
  'tools.steel': ['structural_engineer'],
  account: ['admin', 'site_manager', 'structural_engineer', 'user'],
};

describe('feature matrix (role by role, as on the website)', () => {
  it.each(ROLES)('%s', (role) => {
    for (const feature of Object.keys(EXPECTED) as Feature[]) {
      expect([feature, canAccess(role, feature)]).toEqual([feature, EXPECTED[feature].includes(role)]);
    }
  });

  it('covers every feature the app defines', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(FEATURE_RULES).sort());
  });

  it('refuses unknown or missing roles', () => {
    for (const feature of Object.keys(FEATURE_RULES) as Feature[]) {
      expect(canAccess(undefined, feature)).toBe(false);
      expect(canAccess('intruder', feature)).toBe(false);
    }
  });
});

describe('every company-app screen is covered by a rule', () => {
  const appDir = join(__dirname, '../../src/app/(app)');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.tsx')) files.push(relative(appDir, full).replace(/\\/g, '/').replace(/\.tsx$/, ''));
    }
  };
  walk(appDir);
  const screens = files.filter((f) => !f.startsWith('(tabs)/') && !f.endsWith('_layout'));

  it('no screen is left unprotected', () => {
    expect(screens.filter((s) => !(s in ROUTE_FEATURES))).toEqual([]);
  });

  it('no rule points to a screen that does not exist', () => {
    expect(Object.keys(ROUTE_FEATURES).filter((r) => !screens.includes(r))).toEqual([]);
  });
});

// Read-only cross-check against the website sources when they are on this machine.
const WEB = 'C:/xampp1/htdocs/livreee';
const webIt = existsSync(join(WEB, 'lib/permissions.ts')) ? it : it.skip;
describe('website sources (read-only)', () => {
  webIt('mobile permission matrix is the website one', () => {
    const matrix = (text: string) => text.slice(text.indexOf('const ROLE_PERMISSIONS'), text.indexOf('export function hasPermission')).replace(/\s+/g, '');
    const web = readFileSync(join(WEB, 'lib/permissions.ts'), 'utf8');
    const mobile = readFileSync(join(__dirname, '../../src/lib/permissions.ts'), 'utf8');
    expect(matrix(mobile)).toBe(matrix(web));
  });

  webIt('tab/section permissions equal the website sidebar', () => {
    const nav = readFileSync(join(WEB, 'components/layout/nav-pages.ts'), 'utf8');
    const permissionOf = (href: string) => nav.match(new RegExp(`href: "${href.replace('?', '\\?')}",[^}]*permission: "([a-z_]+)"`))?.[1];
    expect(FEATURE_RULES.dashboard).toMatchObject({ permission: permissionOf('/dashboard') });
    expect(FEATURE_RULES.inventory).toMatchObject({ permission: permissionOf('/inventory') });
    expect(permissionOf('/warehouses')).toBe(permissionOf('/inventory'));
    expect(FEATURE_RULES.projects).toMatchObject({ permission: permissionOf('/projects') });
    expect(FEATURE_RULES.costs).toMatchObject({ permission: permissionOf('/costs') });
    expect(FEATURE_RULES.reports).toMatchObject({ permission: permissionOf('/reports') });
    expect(permissionOf('/settings?tab=users')).toBe('manage_users');
  });

  webIt('page guards equal the website pages', () => {
    const allowed = (page: string) => {
      const src = readFileSync(join(WEB, page), 'utf8');
      const list = src.match(/if \(!\[([^\]]+)\]\.includes\(user\.role\)\)/);
      if (list) return list[1].match(/"([a-z_]+)"/g)!.map((s) => s.replace(/"/g, '')).sort();
      const single = src.match(/if \(user\.role !== "([a-z_]+)"\)/);
      return single ? [single[1]] : null;
    };
    const rolesOf = (f: Feature) => ROLES.filter((r) => canAccess(r, f)).sort();
    expect(rolesOf('checklists')).toEqual(allowed('app/checklists/page.tsx'));
    expect(rolesOf('tools')).toEqual(allowed('app/tools/concrete-calculator/page.tsx'));
    expect(rolesOf('tools')).toEqual(allowed('app/tools/formwork-calculator/page.tsx'));
    expect(rolesOf('tools')).toEqual(allowed('app/tools/mesh-calculator/page.tsx'));
    expect(rolesOf('tools.steel')).toEqual(allowed('app/tools/steel-calculator/page.tsx'));
    const settings = readFileSync(join(WEB, 'app/settings/settings-client.tsx'), 'utf8');
    expect(settings).toMatch(/canOpenCompanySettings = hasRole\("admin"\)/);
    expect(rolesOf('company')).toEqual(['admin']);
  });
});

// ---------------------------------------------------------------------------
// Rendered screens per role
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted and must use require()
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

let mockRole: Role = 'admin';
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'u@test.invalid', firstName: 'Test', lastName: 'User', role: mockRole, companyId: 'c1', isPlatformAdmin: false },
    state: { status: 'signed-in' },
    signOut: jest.fn(),
    biometricEnabled: false,
  }),
}));

const fr = (key: string) => translate('fr', key);
const TAB_LABEL: Record<keyof typeof TAB_FEATURES, string> = {
  index: fr('common.dashboard'),
  inventory: fr('common.inventory'),
  projects: fr('common.projects'),
  costs: fr('common.costs'),
  more: fr('tabs.account'),
};
const MENU: { label: string; feature: Feature }[] = [
  { label: fr('settings.profileTitle'), feature: 'account' },
  { label: fr('common.security'), feature: 'account' },
  { label: fr('settings.companyInfoTitle'), feature: 'company' },
  { label: fr('dashboard.manageUsers'), feature: 'users' },
  { label: fr('subscription.title'), feature: 'subscription' },
  { label: fr('common.notifications'), feature: 'notifications' },
  { label: fr('common.reports'), feature: 'reports' },
  { label: fr('common.calculationHubTitle'), feature: 'tools' },
  { label: fr('common.checklistsPageTitle'), feature: 'checklists' },
  { label: fr('common.suppliers'), feature: 'suppliers' },
  { label: fr('common.language'), feature: 'account' },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('app.locale', 'fr');
});

function Providers({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, enabled: false } } });
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

const stub = (name: string) =>
  function Stub() {
    return <Text>{`screen:${name}`}</Text>;
  };

async function renderApp(role: Role) {
  mockRole = role;
  const routes: Record<string, React.ComponentType> = {
    _layout: () => (
      <Providers>
        <Slot />
      </Providers>
    ),
    '(app)/_layout': AppLayout,
    '(app)/(tabs)/_layout': TabsLayout,
    '(app)/(tabs)/index': stub('dashboard'),
    '(app)/(tabs)/inventory': stub('inventory'),
    '(app)/(tabs)/projects': stub('projects'),
    '(app)/(tabs)/costs': stub('costs'),
    '(app)/(tabs)/more': stub('more'),
  };
  for (const route of Object.keys(ROUTE_FEATURES)) routes[`(app)/${route}`] = stub(route);
  await act(async () => {
    renderRouter(routes, { initialUrl: '/' });
  });
  await screen.findByText('screen:dashboard');
}

describe.each(ROLES)('%s — tabs and blocked navigation', (role) => {
  it('shows exactly the website sections as tabs', async () => {
    await renderApp(role);
    for (const [tab, feature] of Object.entries(TAB_FEATURES) as [keyof typeof TAB_FEATURES, Feature][]) {
      expect([tab, screen.queryAllByText(TAB_LABEL[tab]).length > 0]).toEqual([tab, canAccess(role, feature)]);
    }
  });

  it('cannot open a screen outside its rights by navigating to it', async () => {
    await renderApp(role);
    for (const [route, path] of [
      ['orders/[id]', '/orders/o1'],
      ['warehouses/index', '/warehouses'],
      ['suppliers', '/suppliers'],
      ['settings/company', '/settings/company'],
      ['settings/users', '/settings/users'],
      ['tools/steel', '/tools/steel'],
    ] as const) {
      await act(async () => {
        router.push(path);
      });
      const shown = screen.queryByText(`screen:${route}`) !== null;
      expect([route, shown]).toEqual([route, canAccess(role, ROUTE_FEATURES[route])]);
      await act(async () => {
        if (router.canGoBack()) router.back();
      });
    }
  });
});

async function renderScreen(role: Role, Screen: React.ComponentType) {
  mockRole = role;
  await act(async () => {
    renderRouter(
      {
        _layout: () => (
          <Providers>
            <Stack />
          </Providers>
        ),
        index: Screen as any,
      },
      { initialUrl: '/' },
    );
  });
}

describe.each(ROLES)('%s — account menu and calculators', (role) => {
  it('lists exactly the website entries in the account menu', async () => {
    await renderScreen(role, MoreScreen);
    await screen.findByText(fr('settings.profileTitle'));
    for (const entry of MENU) {
      expect([entry.label, screen.queryAllByText(entry.label).length > 0]).toEqual([entry.label, canAccess(role, entry.feature)]);
    }
  });

  it('lists the calculators the website allows', async () => {
    await renderScreen(role, ToolsHubScreen);
    await screen.findByText(fr('common.concreteCalculator'));
    const steelListed = screen.queryByText(fr('common.steelCalculator')) !== null;
    // Roles without calculator access see the (disabled) list with a warning, like before.
    expect(steelListed).toBe(canAccess(role, 'tools') ? canAccess(role, 'tools.steel') : true);
  });
});
