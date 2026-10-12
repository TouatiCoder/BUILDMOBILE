import { hasPermission, type Permission, type UserRole } from './permissions';

/**
 * Which role may open which part of the app — mirrors the WEBSITE (source of
 * truth), feature by feature:
 *  - navigation: livreee/components/layout/nav-pages.ts (sidebar permissions);
 *  - settings tabs: livreee/app/settings/settings-client.tsx;
 *  - page guards: livreee/app/{checklists,tools/*,calculations/new}/page.tsx.
 * Actions that the website shows but the API refuses for a role are hidden
 * here too (the server stays the authority; see docs/ROLE_PARITY.md).
 * The server still enforces everything — this only decides what the app shows.
 */
export type Feature =
  | 'dashboard'
  | 'inventory'
  | 'inventory.manage'
  | 'projects'
  | 'projects.create'
  | 'projects.edit'
  | 'projects.delete'
  | 'projects.status'
  | 'costs'
  | 'orders.create'
  | 'orders.edit'
  | 'suppliers'
  | 'reports'
  | 'notifications'
  | 'company'
  | 'users'
  | 'subscription'
  | 'checklists'
  | 'tools'
  | 'tools.steel'
  | 'account';

type Rule = { source: string } & ({ permission: Permission } | { roles: readonly UserRole[] });

const FIELD_ROLES = ['site_manager', 'structural_engineer'] as const;

export const FEATURE_RULES: Record<Feature, Rule> = {
  dashboard: { permission: 'view_dashboard', source: 'nav-pages: /dashboard' },
  inventory: { permission: 'view_inventory', source: 'nav-pages: /inventory, /warehouses' },
  'inventory.manage': { permission: 'manage_inventory', source: 'permissions.ts; API stock/material/warehouse writes' },
  projects: { permission: 'view_projects', source: 'nav-pages: /projects' },
  'projects.create': { permission: 'create_project', source: 'permissions.ts' },
  'projects.edit': { permission: 'edit_project', source: 'permissions.ts' },
  'projects.delete': { permission: 'delete_project', source: 'permissions.ts; API DELETE /api/projects/[id]' },
  'projects.status': { roles: ['admin', 'site_manager'], source: 'API PATCH /api/projects/[id]/status requireRoles' },
  costs: { permission: 'view_costs', source: 'nav-pages: /costs (orders, suppliers)' },
  'orders.create': { roles: ['admin'], source: 'API POST /api/purchase-orders requireRoles(["admin"])' },
  'orders.edit': { permission: 'view_costs', source: 'costs pages (admin, site_manager)' },
  suppliers: { permission: 'view_costs', source: 'nav-pages: /costs → /costs/suppliers' },
  reports: { permission: 'view_reports', source: 'nav-pages: /reports' },
  notifications: { roles: ['admin', 'site_manager', 'structural_engineer'], source: 'API /api/notifications requireRoles' },
  company: { roles: ['admin'], source: 'settings-client: canOpenCompanySettings = hasRole("admin")' },
  users: { roles: ['admin'], source: 'settings-client: manage_users || admin; nav-pages /settings?tab=users' },
  subscription: { roles: ['admin'], source: 'settings-client: billing tab (manage_users || admin)' },
  checklists: { roles: FIELD_ROLES, source: 'app/checklists/page.tsx' },
  tools: { roles: FIELD_ROLES, source: 'app/calculations/new, tools/{concrete,formwork,mesh}' },
  'tools.steel': { roles: ['structural_engineer'], source: 'app/tools/steel-calculator/page.tsx' },
  account: { roles: ['admin', 'site_manager', 'structural_engineer', 'user'], source: 'settings page has no guard (profile, security)' },
};

export function canAccess(role: string | null | undefined, feature: Feature): boolean {
  if (!role) return false;
  const rule = FEATURE_RULES[feature];
  if ('permission' in rule) return hasPermission(role as UserRole, rule.permission);
  return (rule.roles as readonly string[]).includes(role);
}

/**
 * Every screen of the signed-in company app (route name relative to
 * `src/app/(app)`, as Expo Router names it) → the feature needed to open it.
 * The (app) stack protects each group with `Stack.Protected`; a unit test
 * checks that every route file is listed here.
 */
export const ROUTE_FEATURES: Record<string, Feature> = {
  'inventory/movements': 'inventory',
  'inventory/operation': 'inventory.manage',
  'materials/new': 'inventory.manage',
  'materials/[id]/index': 'inventory',
  'materials/[id]/edit': 'inventory.manage',
  'warehouses/index': 'inventory',
  'warehouses/form': 'inventory.manage',
  'projects/new': 'projects.create',
  'projects/[id]/index': 'projects',
  'projects/[id]/edit': 'projects.edit',
  'orders/new': 'orders.create',
  'orders/[id]': 'costs',
  suppliers: 'suppliers',
  reports: 'reports',
  notifications: 'notifications',
  'settings/company': 'company',
  'settings/users': 'users',
  'settings/invite': 'users',
  'settings/subscription': 'subscription',
  'settings/profile': 'account',
  'settings/security': 'account',
  'settings/language': 'account',
  'checklists/index': 'checklists',
  'checklists/new': 'checklists',
  'checklists/[id]': 'checklists',
  'tools/index': 'tools',
  'tools/concrete': 'tools',
  'tools/formwork': 'tools',
  'tools/mesh': 'tools',
  'tools/steel': 'tools.steel',
};

/** Tabs of the company app and the feature each one needs. */
export const TAB_FEATURES = { index: 'dashboard', inventory: 'inventory', projects: 'projects', costs: 'costs', more: 'account' } as const satisfies Record<string, Feature>;
