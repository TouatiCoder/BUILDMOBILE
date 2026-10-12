// Copied verbatim from the website (livreee/lib/permissions.ts) so the app
// hides the same actions the web UI hides. The server remains the authority.
export type UserRole = "admin" | "site_manager" | "structural_engineer" | "user";

export type Permission = 
  | "view_dashboard" 
  | "view_inventory" 
  | "view_projects" 
  | "view_costs" 
  | "view_settings" 
  | "view_reports"
  | "manage_users"
  | "manage_inventory"
  | "create_project"
  | "edit_project"
  | "delete_project"
  | "approve_orders";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "view_dashboard",
    "view_inventory",
    "view_projects",
    "view_costs",
    "view_settings",
    "view_reports",
    "manage_users",
    "manage_inventory",
    "create_project",
    "edit_project",
    "delete_project",
    "approve_orders",
  ],
  site_manager: [
    "view_dashboard",
    "view_inventory",
    "view_projects",
    "view_costs",
    "view_settings",
    "view_reports",
    "manage_inventory",
    "create_project",
    "edit_project",
    "delete_project",
  ],
  structural_engineer: [
    "view_dashboard",
    "view_projects",
    "view_settings",
    "view_reports",
    "edit_project",
  ],
  user: [
    "view_dashboard",
  ]
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  return permissions.every((p) => hasPermission(role, p));
}
