import type { UserProfile } from '@/api/types';

export type Workspace = 'platform' | 'company';

/**
 * Which interface a signed-in user gets. `isPlatformAdmin` comes from the
 * server (GET /api/auth/me or the login response) — the app never lets the
 * user pick it. Platform super-admins get the SaaS console; everybody else
 * gets the company application. `null` means the profile is not known yet.
 */
export function workspaceFor(user: Pick<UserProfile, 'isPlatformAdmin'> | null | undefined): Workspace | null {
  if (!user) return null;
  return user.isPlatformAdmin ? 'platform' : 'company';
}
