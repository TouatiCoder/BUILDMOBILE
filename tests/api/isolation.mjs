#!/usr/bin/env node
/**
 * Backend data-isolation regression suite (BuildStock API).
 *
 *   ISOTEST_FIXTURE=/path/to/isotest-fixture.json node tests/api/isolation.mjs
 *
 * !! Runs WRITE probes (PATCH/PUT/DELETE/POST with foreign ids, deactivation,
 * invitations). Only run it against a disposable test backend + database
 * seeded with test accounts — never against production. The fixture must
 * declare `base` (backend URL), the accounts and the record ids per company.
 *
 * Every check asserts the SECURE behaviour; a FAIL is an authorization hole.
 * Access model verified (from the code, see docs/DATA_ISOLATION_AUDIT.md):
 *   - company = tenant; business data is shared inside a company by role;
 *   - notifications, tool calculations, checklists are private to their user
 *     (checklists also to the project's assigned manager/engineer);
 *   - user management is admin-only and limited to the admin's company.
 */
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(process.env.ISOTEST_FIXTURE ?? '', 'utf8'));
const { base, accounts: acc, records: rec, companies } = fixture;
if (!/localhost|127\.0\.0\.1/.test(base) && process.env.ISOTEST_ALLOW_REMOTE !== '1') {
  console.error(`Refusing to run write probes against ${base}. Set ISOTEST_ALLOW_REMOTE=1 for a remote *test* server.`);
  process.exit(2);
}

const results = [];
/** `ok` true → PASS, false → FAIL, null → INCONCLUSIVE (a precondition such as a plan limit blocked the probe). */
function check(area, name, ok, detail = '') {
  results.push({ area, name, ok });
  const label = ok === null ? 'INCONCLUSIVE' : ok ? 'PASS' : 'FAIL';
  console.log(`${label}  [${area}] ${name}${detail ? `  — ${detail}` : ''}`);
}
/** Subscription feature gates answer 403 too; such a 403 says nothing about authorization. */
const planGate = (r) => r.status === 403 && !!r.json?.gate;

async function call(token, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Cookie: `auth-token=${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, text, json };
}

async function login({ email, password }) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const token = ((res.headers.get('set-cookie') || '').match(/auth-token=([^;,\s]+)/) || [])[1];
  if (!token) throw new Error(`login failed for ${email}: ${res.status}`);
  return token;
}

const denied = (s) => s === 401 || s === 403 || s === 404;
const leaks = (r, ...needles) => needles.some((n) => n && r.text.includes(n));

const t = {};
for (const [key, a] of Object.entries(acc)) t[key] = await login(a);
const B = rec.B;
const A = rec.A;
const A2 = rec.A2;
const bNeedles = [B.project, B.material, B.warehouse, B.order, B.supplier, B.checklist, 'Supplier B', 'Project B', 'Material B', 'Warehouse B'];

// 1. Cross-company reads by id --------------------------------------------------
for (const [label, path] of [
  ['project', `/api/projects/${B.project}`],
  ['material', `/api/materials/${B.material}`],
  ['warehouse', `/api/warehouses/${B.warehouse}`],
  ['purchase order', `/api/purchase-orders/${B.order}`],
  ['checklist', `/api/checklists/${B.checklist}`],
  ['company settings', `/api/company/${companies.B}`],
  ['invitations list', `/api/invitations?companyId=${companies.B}`],
]) {
  const r = await call(t.adminA, 'GET', path);
  check('cross-company read', `admin A cannot read company B ${label}`, denied(r.status) && !leaks(r, ...bNeedles), `HTTP ${r.status}`);
}
{
  const r = await call(t.managerA, 'GET', `/api/projects/${B.project}/materials`);
  check('cross-company read', 'project materials route rejects a foreign project id', denied(r.status), `HTTP ${r.status}`);
}

// 2. Lists never contain another company's records -----------------------------
for (const path of [
  '/api/projects',
  '/api/materials',
  '/api/warehouses',
  '/api/purchase-orders',
  '/api/suppliers',
  '/api/inventory/materials',
  '/api/inventory/movements',
  '/api/users',
  '/api/company/users',
  '/api/analytics/projects',
]) {
  const r = await call(t.adminA, 'GET', path);
  check('cross-company list', `GET ${path} (admin A) has no company B data`, !leaks(r, ...bNeedles, acc.managerB.email, acc.adminB.email), `HTTP ${r.status}`);
}

// 3. Cross-company writes by id -------------------------------------------------
const writes = [
  ['PATCH', `/api/projects/${B.project}`, { name: 'hijacked' }],
  ['PUT', `/api/materials/${B.material}`, { name: 'hijacked', unit: 'kg' }],
  ['PUT', `/api/warehouses/${B.warehouse}`, { name: 'hijacked' }],
  ['PATCH', `/api/purchase-orders/${B.order}`, { status: 'cancelled' }],
  ['PATCH', `/api/checklists/${B.checklist}`, { title: 'hijacked' }],
  ['PUT', `/api/company/${companies.B}`, { name: 'hijacked' }],
  ['DELETE', `/api/purchase-orders/${B.order}`],
  ['DELETE', `/api/warehouses/${B.warehouse}`],
  ['DELETE', `/api/materials/${B.material}`],
  ['DELETE', `/api/projects/${B.project}`],
];
for (const [method, path, body] of writes) {
  const r = await call(t.adminA, method, path, body);
  check('cross-company write', `admin A ${method} ${path.replace(/[0-9a-f-]{36}/g, ':B')}`, denied(r.status), `HTTP ${r.status}`);
}
{
  const p = await call(t.managerB, 'GET', `/api/projects/${B.project}`);
  const o = await call(t.managerB, 'GET', `/api/purchase-orders/${B.order}`);
  check('cross-company write', 'company B records unchanged afterwards', p.status === 200 && !p.text.includes('hijacked') && o.status === 200 && !o.text.includes('cancelled'), `project ${p.status}, order ${o.status}`);
}

// 4. Foreign ids inside request bodies ----------------------------------------
{
  const r = await call(t.adminA, 'PUT', `/api/materials/${A.material}`, { name: 'Material A', unit: 'kg', supplierId: B.supplier });
  check('foreign id in body', 'material update rejects a company B supplierId', denied(r.status) || r.status === 400 ? true : !leaks(r, 'Supplier B', 'supplier-B@'), `HTTP ${r.status}${leaks(r, 'supplier-B@') ? ' — response contains company B supplier contact' : ''}`);
  await call(t.adminA, 'PUT', `/api/materials/${A.material}`, { name: 'Material A', unit: 'kg', supplierId: A.supplier });
}
{
  const r = await call(t.adminA, 'POST', '/api/purchase-orders', { supplierId: B.supplier });
  check('foreign id in body', 'order creation rejects a company B supplierId', r.status === 400 || denied(r.status), `HTTP ${r.status}${leaks(r, 'Supplier B') ? ' — returned company B supplier name' : ''}`);
  if (r.json?.id) await call(t.adminA, 'DELETE', `/api/purchase-orders/${r.json.id}`);
}
{
  const r = await call(t.adminA, 'PATCH', `/api/projects/${A.project}`, { siteManagerId: acc.managerB.id });
  const after = await call(t.adminA, 'GET', `/api/projects/${A.project}`);
  check('foreign id in body', 'project update rejects a company B user as site manager', !(after.json?.siteManager?.id === acc.managerB.id || after.json?.project?.siteManager?.id === acc.managerB.id), `PATCH ${r.status}`);
  await call(t.adminA, 'PATCH', `/api/projects/${A.project}`, { siteManagerId: acc.managerA.id });
}

// 5. Private per-user records inside the same company --------------------------
{
  const r = await call(t.managerA2, 'GET', `/api/checklists/${A.checklist}`);
  check('private records', "manager A2 cannot open manager A's checklist", denied(r.status), `HTTP ${r.status}`);
  const n = await call(t.managerA2, 'GET', '/api/notifications');
  check('private records', "manager A2's notifications exclude manager A's", !n.text.includes('Notif A"'), `HTTP ${n.status}`);
  const c = await call(t.managerA2, 'GET', '/api/tools/calculations');
  check('private records', "manager A2's calculations exclude manager A's", !c.text.includes(A.calc), `HTTP ${c.status}`);
  const d = await call(t.managerA2, 'DELETE', `/api/checklists/${A.checklist}`);
  check('private records', "manager A2 cannot delete manager A's checklist", denied(d.status), `HTTP ${d.status}`);
}

// 6. Shared company data stays available to members ----------------------------
for (const [who, path] of [
  ['managerA2', `/api/projects/${A.project}`],
  ['managerA2', `/api/materials/${A.material}`],
  ['managerA2', `/api/warehouses/${A.warehouse}`],
  ['managerA2', `/api/purchase-orders/${A.order}`],
  ['engineerA', `/api/projects/${A.project}`],
  ['managerA', `/api/checklists/${A.checklist}`],
]) {
  const r = await call(t[who], 'GET', path);
  check('shared company data', `${who} can read ${path.replace(/[0-9a-f-]{36}/g, ':A')}`, r.status === 200, `HTTP ${r.status}`);
}

// 7. User management scope -------------------------------------------------------
{
  const r = await call(t.adminA, 'GET', '/api/company/users');
  const emails = Array.isArray(r.json) ? r.json.map((u) => u.email) : [];
  const expected = [acc.adminA, acc.managerA, acc.managerA2, acc.engineerA, acc.basicA].map((a) => a.email);
  check('user management', 'admin A sees exactly company A accounts', r.status === 200 && expected.every((e) => emails.includes(e)) && emails.every((e) => expected.includes(e)), `${emails.length} accounts`);
  const m = await call(t.managerA, 'GET', '/api/company/users');
  check('user management', 'site manager cannot list users (admin only)', m.status === 403, `HTTP ${m.status}`);
  const d = await call(t.adminA, 'DELETE', `/api/company/users/${acc.managerB.id}`);
  check('user management', 'admin A cannot deactivate a company B user', denied(d.status), `HTTP ${d.status}`);
  const ok = await call(t.managerB, 'GET', '/api/auth/me');
  check('user management', 'company B user still active afterwards', ok.status === 200, `HTTP ${ok.status}`);
}

// 8. Role policy inside the company (lib/permissions.ts matrix) ----------------
for (const [who, method, path, body, why] of [
  ['basicA', 'PATCH', `/api/projects/${A2.project}`, { name: 'Project A2' }, '"user" has no edit_project'],
  ['engineerA', 'PATCH', `/api/purchase-orders/${A.order}`, { status: 'approved' }, 'engineer has no approve_orders'],
  ['engineerA', 'DELETE', `/api/warehouses/${A2.warehouse}`, undefined, 'engineer has no manage_inventory'],
  ['basicA', 'PUT', `/api/materials/${A2.material}`, { name: 'Material A2', unit: 'kg' }, '"user" has no manage_inventory'],
  ['basicA', 'GET', '/api/purchase-orders', undefined, '"user" has no view_costs'],
]) {
  const r = await call(t[who], method, path, body);
  check('role policy', `${who} ${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')} denied (${why})`, planGate(r) ? null : r.status === 403, `HTTP ${r.status}`);
}

// 9. Invitation token cannot take over an account in another company ----------
{
  const email = `victim-${fixture.runId.slice(0, 8)}-${Date.now()}@isotest.invalid`;
  // Company B is below its plan's user limit, so the invitation itself is not blocked by a feature gate.
  const inv = await call(t.adminB, 'POST', '/api/invitations', { email, role: 'site_manager', companyId: companies.B });
  // An admin can always learn the token (create response, invitation list, or the e-mail link it sends).
  let token = inv.json?.token;
  if (!token) {
    const list = await call(t.adminB, 'GET', `/api/invitations?companyId=${companies.B}`);
    const rows = Array.isArray(list.json) ? list.json : (list.json?.invitations ?? []);
    token = rows.find((r) => r.email === email)?.token;
  }
  const victimPassword = `Victim${Date.now()}A1`;
  await call(null, 'POST', '/api/register', { companyName: `Victim Co ${Date.now()}`, firstName: 'Vic', lastName: 'Tim', email, password: victimPassword, siret: null });
  const attackerPassword = `Attacker${Date.now()}A1`;
  const accept = token ? await call(null, 'POST', '/api/auth/accept-invite', { token, password: attackerPassword }) : { status: 0 };
  const takeover = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: attackerPassword }) });
  check('account takeover', 'a stale invitation cannot reset the password of a user who registered elsewhere', token ? takeover.status !== 200 : null, `invite ${inv.status}${token ? ' (token returned to admin)' : ''}, accept ${accept.status}, attacker login ${takeover.status}`);
}

// 10. Deactivated accounts lose access immediately ------------------------------
{
  const tokenBefore = t.basicA;
  const d = await call(t.adminA, 'DELETE', `/api/company/users/${acc.basicA.id}`);
  for (const [method, path, body] of [
    ['GET', '/api/projects'],
    ['GET', `/api/company/${companies.A}`],
    ['PUT', '/api/auth/me', { firstName: 'still here' }],
    ['GET', `/api/invitations?companyId=${companies.A}`],
  ]) {
    const r = await call(tokenBefore, method, path, body);
    check('deactivated account', `deactivated user's token rejected on ${method} ${path.replace(/[0-9a-f-]{36}/g, ':A')}`, denied(r.status), `deactivate ${d.status}, HTTP ${r.status}`);
  }
}

// 11. Unauthenticated access ------------------------------------------------------
for (const path of ['/api/projects', '/api/materials', '/api/company/users', `/api/company/${companies.A}`, '/api/notifications']) {
  const r = await call(null, 'GET', path);
  check('unauthenticated', `GET ${path.replace(/[0-9a-f-]{36}/g, ':A')} requires a session`, r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}
{
  const r = await call(null, 'POST', '/api/send-welcome', { email: 'nobody@isotest.invalid', name: '<b>x</b>' });
  check('unauthenticated', 'POST /api/send-welcome requires a session', r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}

// 12. Legitimate flows keep working (no over-blocking) ------------------------
{
  const email = `invitee-${Date.now()}@isotest.invalid`;
  const inv = await call(t.adminB, 'POST', '/api/company/users/invite', { email, role: 'site_manager', firstName: 'New', lastName: 'Member' });
  let token = inv.json?.token;
  if (!token) {
    const list = await call(t.adminB, 'GET', `/api/invitations?companyId=${companies.B}`);
    const rows = Array.isArray(list.json) ? list.json : (list.json?.invitations ?? []);
    token = rows.find((r) => r.email === email)?.token;
  }
  const password = `Member${Date.now()}A1`;
  const accept = token ? await call(null, 'POST', '/api/auth/accept-invite', { token, password }) : { status: 0 };
  const signIn = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  check('legitimate flows', 'an invited employee can accept and sign in', planGate(inv) ? null : signIn.status === 200, `invite ${inv.status}, accept ${accept.status}, login ${signIn.status}`);
}
for (const [who, method, path, body, label] of [
  ['managerA', 'PUT', `/api/materials/${A.material}`, { name: 'Material A', unit: 'kg', supplierId: A.supplier }, 'site manager updates a material with its own supplier'],
  ['engineerA', 'PATCH', `/api/projects/${A.project}`, { name: 'Project A' }, 'engineer edits a project (edit_project)'],
  ['adminA', 'PATCH', `/api/projects/${A.project}`, { siteManagerId: acc.managerA2.id }, 'admin assigns a site manager of the same company'],
  ['adminA', 'PATCH', `/api/purchase-orders/${A.order}`, { status: 'approved' }, 'admin approves an order'],
  ['engineerA', 'GET', `/api/purchase-orders/${A.order}`, undefined, 'engineer reads an order (technical opinion)'],
]) {
  const r = await call(t[who], method, path, body);
  check('legitimate flows', label, planGate(r) ? null : r.status >= 200 && r.status < 300, `HTTP ${r.status}`);
}
{
  // Authorization only: a stock entry currently fails with 500 for everyone because lib/db.ts adds
  // `updatedAt` to every create and StockMovement has no such column (existing bug, unrelated to access).
  const r = await call(t.managerA, 'POST', '/api/inventory', { operation: 'entry', material_id: A.material, warehouse_id: A.warehouse, quantity: 1 });
  check('legitimate flows', 'site manager is authorized to record a stock entry (not 401/403)', r.status !== 401 && r.status !== 403, `HTTP ${r.status}${r.status === 500 ? ' (known StockMovement.updatedAt bug)' : ''}`);
}

const failed = results.filter((r) => r.ok === false);
const inconclusive = results.filter((r) => r.ok === null);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed, ${failed.length} failed, ${inconclusive.length} inconclusive.`);
if (failed.length) {
  console.log('\nFailing checks (authorization holes):');
  for (const f of failed) console.log(`  - [${f.area}] ${f.name}`);
}
process.exit(failed.length || inconclusive.length ? 1 : 0);
