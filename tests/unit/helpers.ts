export type SecureMock = {
  items: Map<string, { value: string; requireAuth: boolean }>;
  nextBioRead: 'success' | 'cancel' | 'invalidated' | 'invalidated-silent';
  failBioWrite: string | null;
};
export type DeviceMock = {
  hasHardware: boolean;
  enrolled: boolean;
  types: number[];
  promptResult: { success: boolean; error?: string };
  level: number;
};

export const secure = (globalThis as unknown as { __secure: SecureMock }).__secure;
export const device = (globalThis as unknown as { __device: DeviceMock }).__device;

export function resetNative() {
  secure.items.clear();
  secure.nextBioRead = 'success';
  secure.failBioWrite = null;
  device.hasHardware = true;
  device.enrolled = true;
  device.types = [2];
  device.promptResult = { success: true };
  device.level = 3;
}

/** Builds an unsigned JWT-shaped token; the app never verifies signatures. */
export function makeToken(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.signature`;
}

type Route = (init: RequestInit & { url: string }) => { status: number; body?: unknown; headers?: Record<string, string> };

/** Replaces global fetch with a router; records every request. */
export function mockFetch(route: Route) {
  const calls: (RequestInit & { url: string })[] = [];
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const req = { ...(init ?? {}), url: String(url) };
    calls.push(req);
    const res = route(req);
    const headers = new Headers(res.headers ?? {});
    return {
      status: res.status,
      headers,
      text: async () => (res.body === undefined ? '' : JSON.stringify(res.body)),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return calls;
}
