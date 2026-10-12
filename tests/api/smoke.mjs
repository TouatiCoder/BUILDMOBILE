#!/usr/bin/env node
/**
 * Read-only API contract check against a running BuildStock backend.
 *
 *   BUILDSTOCK_API_URL=http://localhost:3000 \
 *   BUILDSTOCK_TEST_EMAIL=... BUILDSTOCK_TEST_PASSWORD=... npm run test:api
 *
 * - Performs exactly one POST (/api/auth/login, which the website itself logs
 *   as a "last login" notification) and otherwise only GET requests.
 * - Never calls GET /api/stock/alerts (that GET writes alerts/notifications).
 * - Reproduces the app's session flow: token read from Set-Cookie, replayed as
 *   a Cookie header.
 * - Credentials come from the environment and are never printed.
 */
const base = (process.env.BUILDSTOCK_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const email = process.env.BUILDSTOCK_TEST_EMAIL;
const password = process.env.BUILDSTOCK_TEST_PASSWORD;
if (!email || !password) {
  console.error('Set BUILDSTOCK_TEST_EMAIL and BUILDSTOCK_TEST_PASSWORD (a test account).');
  process.exit(2);
}

let failures = 0;
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const setCookie = login.headers.get('set-cookie') || '';
const token = (setCookie.match(/(?:^|[\s,;])auth-token=([^;,\s]+)/) || [])[1];
const loginBody = await login.json().catch(() => ({}));
record('login returns 200', login.status === 200, `status ${login.status}`);
record('login sets auth-token cookie readable by a native client', !!token);
if (!token) process.exit(1);
const role = loginBody.user?.role;
console.log(`      role under test: ${role}`);

const get = async (path) => {
  const res = await fetch(`${base}${path}`, { headers: { Cookie: `auth-token=${token}`, Accept: 'application/json' } });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
};

const hasKeys = (obj, keys) => obj && typeof obj === 'object' && keys.every((k) => k in obj);
const firstOf = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null);

// Bearer must NOT be accepted (documents why the app uses the Cookie header).
const bearer = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
record('Authorization: Bearer is not accepted by the backend (expected 401)', bearer.status === 401, `status ${bearer.status}`);

const me = await get('/api/auth/me');
record('GET /api/auth/me via Cookie header', me.status === 200 && hasKeys(me.body?.user, ['id', 'email', 'role', 'companyId']));

const isField = role === 'site_manager' || role === 'structural_engineer';

const checks = [
  ['/api/projects?limit=0&page=1&pageSize=5', (b) => hasKeys(b, ['projects', 'total', 'stats']) && (!firstOf(b.projects) || hasKeys(firstOf(b.projects), ['id', 'name', 'status', 'totalBudget', 'currentCost']))],
  ['/api/warehouses', (b) => Array.isArray(b) && (!firstOf(b) || hasKeys(firstOf(b), ['id', 'name', 'isMain']))],
  ['/api/suppliers', (b) => Array.isArray(b)],
  ['/api/purchase-orders?limit=5', (b) => Array.isArray(b) && (!firstOf(b) || hasKeys(firstOf(b), ['id', 'orderNumber', 'status', 'totalAmount', 'supplier']))],
  ['/api/notifications', (b) => Array.isArray(b) && (!firstOf(b) || hasKeys(firstOf(b), ['id', 'title', 'isRead', 'createdAt']))],
  ['/api/reports/budget-vs-actual', (b) => Array.isArray(b?.items)],
  ['/api/reports/project-summary', (b) => Array.isArray(b?.items)],
  ['/api/materials/library', (b) => Array.isArray(b?.items)],
];
if (role !== 'structural_engineer') {
  checks.push(
    ['/api/inventory/materials', (b) => Array.isArray(b) && (!firstOf(b) || hasKeys(firstOf(b), ['id', 'name', 'unit', 'inventory']))],
    ['/api/inventory/materials/filters', (b) => Array.isArray(b?.categories) && Array.isArray(b?.suppliers)],
    ['/api/inventory/stats', (b) => hasKeys(b, ['totalMaterials', 'totalValue', 'lowStockCount', 'criticalStockCount'])],
    ['/api/inventory/movements?limit=3', (b) => Array.isArray(b)],
  );
}
if (role === 'admin') {
  checks.push(['/api/company/users', (b) => Array.isArray(b)], ['/api/subscription', (b) => hasKeys(b, ['subscription', 'plans'])]);
}
if (isField) {
  checks.push(
    ['/api/checklists?limit=5', (b) => Array.isArray(b?.items)],
    ['/api/tools/calculations', (b) => Array.isArray(b?.items)],
    ['/api/tools/projects?scope=company', (b) => Array.isArray(b?.items)],
  );
}

for (const [path, validate] of checks) {
  const res = await get(path);
  record(`GET ${path}`, res.status === 200 && validate(res.body), `status ${res.status}`);
}

// Tenant scoping: company endpoint must refuse another company id.
if (me.body?.user?.companyId) {
  const own = await get(`/api/company/${me.body.user.companyId}`);
  record('GET /api/company/[own id]', own.status === 200 && hasKeys(own.body, ['id', 'name', 'updatedAt']));
  const other = await get('/api/company/00000000-0000-0000-0000-000000000000');
  record('GET /api/company/[foreign id] is refused', other.status === 401 || other.status === 403, `status ${other.status}`);
}

// Role restrictions the app mirrors in its UI.
if (!isField) {
  const res = await get('/api/checklists');
  record('checklists are refused for non-field roles (server rule)', res.status === 403, `status ${res.status}`);
}

// Backlog modules: report availability without failing the run.
for (const path of ['/api/stock/reservations', '/api/procurement/purchase-requests', '/api/qa/inspections']) {
  const res = await get(path);
  console.log(`INFO  GET ${path} -> ${res.status}${res.status >= 500 ? ' (backlog tables missing on this server)' : ''}`);
}

// Invalid token must be rejected.
const bad = await fetch(`${base}/api/auth/me`, { headers: { Cookie: 'auth-token=not.a.jwt' } });
record('invalid session token is rejected (401)', bad.status === 401, `status ${bad.status}`);

console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
