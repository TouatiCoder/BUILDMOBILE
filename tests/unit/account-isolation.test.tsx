import { act, render } from '@testing-library/react-native';

import { request } from '@/api/client';
import { companyApi } from '@/api/endpoints';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { queryClient } from '@/lib/query-client';

import { makeToken, mockFetch, resetNative } from './helpers';

/**
 * Account isolation on the device: data fetched for one account must never be
 * visible to the next one, and a stale 401 for an ended session must not end
 * the current one.
 */
const future = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
const users = {
  a: { id: 'user-a', email: 'a@example.test', firstName: 'A', lastName: 'A', role: 'site_manager', companyId: 'company-a', isPlatformAdmin: false },
  b: { id: 'user-b', email: 'b@example.test', firstName: 'B', lastName: 'B', role: 'site_manager', companyId: 'company-b', isPlatformAdmin: false },
};
const tokens = { a: makeToken({ userId: users.a.id, exp: future }), b: makeToken({ userId: users.b.id, exp: future }) };

/** Fake backend: each account only sees its own company's projects; token A is revoked on demand. */
let revokeA = false;
function backend() {
  return mockFetch(({ url, body, headers }) => {
    const cookie = (headers as Record<string, string> | undefined)?.Cookie ?? '';
    const who = cookie.includes(tokens.a) ? 'a' : cookie.includes(tokens.b) ? 'b' : null;
    if (url.endsWith('/api/auth/login')) {
      const key = JSON.parse(String(body)).email.startsWith('a@') ? 'a' : 'b';
      return { status: 200, body: { user: users[key] }, headers: { 'set-cookie': `auth-token=${tokens[key]}; Path=/; HttpOnly` } };
    }
    if (url.endsWith('/api/auth/logout')) return { status: 200, body: { success: true } };
    if (!who || (who === 'a' && revokeA)) return { status: 401, body: { error: 'Unauthorized' } };
    if (url.endsWith('/api/auth/me')) return { status: 200, body: { user: users[who] } };
    if (url.endsWith('/api/projects')) return { status: 200, body: [{ id: `project-of-${who}` }] };
    return { status: 404, body: {} };
  });
}

let auth: ReturnType<typeof useAuth>;
function Probe() {
  // Test probe: exposes the hook value to the assertions below.
  // eslint-disable-next-line react-hooks/globals
  auth = useAuth();
  return null;
}

async function mount() {
  await render(
    <I18nProvider>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </I18nProvider>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  resetNative();
  revokeA = false;
  queryClient.clear();
});

it('signing out and in as another account starts from an empty cache', async () => {
  backend();
  await mount();
  await act(async () => {
    await auth.signIn(users.a.email, 'pw');
  });
  await act(async () => {
    await queryClient.fetchQuery({ queryKey: ['projects'], queryFn: () => request('/api/projects') });
  });
  expect(queryClient.getQueryData(['projects'])).toEqual([{ id: 'project-of-a' }]);

  await act(async () => {
    await auth.signOut();
  });
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

  await act(async () => {
    await auth.signIn(users.b.email, 'pw');
  });
  expect(queryClient.getQueryData(['projects'])).toBeUndefined();
  await act(async () => {
    await queryClient.fetchQuery({ queryKey: ['projects'], queryFn: () => request('/api/projects') });
  });
  expect(queryClient.getQueryData(['projects'])).toEqual([{ id: 'project-of-b' }]);
});

it('a late 401 carrying the previous account token does not end the current session', async () => {
  backend();
  // Hold the answer to one request until account B is signed in.
  const answer = global.fetch;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  let hold = true;
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (hold && String(url).endsWith('/api/projects')) {
      hold = false;
      await gate;
    }
    return answer(url, init);
  }) as typeof fetch;

  await mount();
  await act(async () => {
    await auth.signIn(users.a.email, 'pw');
  });
  const stale = request('/api/projects').catch((e: unknown) => e);
  await act(async () => {
    await auth.signOut();
    await auth.signIn(users.b.email, 'pw');
  });
  revokeA = true;
  release();
  await act(async () => {
    await expect(stale).resolves.toMatchObject({ status: 401 });
  });
  expect(auth.state.status).toBe('signed-in');
  expect(auth.user?.id).toBe(users.b.id);
});

it('a 401 for the current session ends it (server revoked or expired)', async () => {
  backend();
  await mount();
  await act(async () => {
    await auth.signIn(users.a.email, 'pw');
  });
  revokeA = true;
  await act(async () => {
    await request('/api/projects').catch(() => undefined);
  });
  expect(auth.state.status).toBe('signed-out');
});

describe('Users screen data after switching from Super Admin to Admin', () => {
  const superAdmin = { ...users.a, id: 'super', email: 'super@example.test', role: 'admin', isPlatformAdmin: true };
  const admin = { ...users.b, id: 'admin', email: 'admin@example.test', role: 'admin' };
  const superToken = makeToken({ userId: superAdmin.id, exp: future });
  const adminToken = makeToken({ userId: admin.id, exp: future });
  // What the server returns for each session (its own company's users).
  const listFor = {
    super: [{ id: 'super', email: superAdmin.email }, { id: 'x', email: 'other-company@example.test' }],
    admin: [{ id: 'admin', email: admin.email }, { id: 'y', email: 'colleague@example.test' }],
  };
  // Same key and request as src/app/(app)/settings/users.tsx.
  const usersQuery = () => ({ queryKey: ['company', 'users'], queryFn: () => companyApi.users() });

  it('never shows the previous account list and refetches with the new session', async () => {
    const calls = mockFetch(({ url, body, headers }) => {
      const cookie = (headers as Record<string, string> | undefined)?.Cookie ?? '';
      const who = cookie.includes(superToken) ? 'super' : cookie.includes(adminToken) ? 'admin' : null;
      if (url.endsWith('/api/auth/login')) {
        const isSuper = JSON.parse(String(body)).email === superAdmin.email;
        return { status: 200, body: { user: isSuper ? superAdmin : admin }, headers: { 'set-cookie': `auth-token=${isSuper ? superToken : adminToken}; Path=/` } };
      }
      if (url.endsWith('/api/auth/logout')) return { status: 200, body: { success: true } };
      if (!who) return { status: 401, body: {} };
      if (url.endsWith('/api/auth/me')) return { status: 200, body: { user: who === 'super' ? superAdmin : admin } };
      if (url.endsWith('/api/company/users')) return { status: 200, body: listFor[who] };
      return { status: 404, body: {} };
    });
    await mount();

    await act(async () => {
      await auth.signIn(superAdmin.email, 'pw');
    });
    await act(async () => {
      await queryClient.fetchQuery(usersQuery());
    });
    expect(queryClient.getQueryData(['company', 'users'])).toEqual(listFor.super);

    await act(async () => {
      await auth.signOut();
      await auth.signIn(admin.email, 'pw');
    });
    // Nothing from the Super Admin session survives the switch…
    expect(queryClient.getQueryData(['company', 'users'])).toBeUndefined();

    // …and the list is fetched again with the Admin's own session cookie.
    let shown: unknown;
    await act(async () => {
      shown = await queryClient.fetchQuery(usersQuery());
    });
    expect(shown).toEqual(listFor.admin);
    const lastUsersCall = calls.filter((c) => c.url.endsWith('/api/company/users')).at(-1)!;
    expect((lastUsersCall.headers as Record<string, string>).Cookie).toBe(`auth-token=${adminToken}`);
    expect(JSON.stringify(shown)).not.toContain(superAdmin.email);
  });
});
