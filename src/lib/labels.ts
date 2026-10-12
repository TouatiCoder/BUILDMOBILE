import type { ChecklistType } from '@/api/types';
import type { Tone } from '@/theme/tokens';

type T = (key: string, params?: Record<string, string | number>, fallback?: string) => string;

/** Project statuses and the website's own label keys (project namespace). */
export const PROJECT_STATUSES = ['planning', 'active', 'paused', 'completed', 'cancelled'] as const;

/** Allowed transitions, identical to STATUS_FLOW in app/api/projects/[id]/status/route.ts. */
export const PROJECT_STATUS_FLOW: Record<string, string[]> = {
  planning: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function projectStatusLabel(t: T, status: string): string {
  const normalized = status === 'in_progress' ? 'active' : status;
  return t(`project.${normalized}`, undefined, status);
}

export function projectStatusTone(status: string): Tone {
  switch (status) {
    case 'active':
    case 'in_progress':
      return 'brand';
    case 'completed':
      return 'success';
    case 'paused':
      return 'warning';
    case 'cancelled':
      return 'danger';
    default:
      return 'violet';
  }
}

/**
 * Values stored by the web project form (app/projects/new/page.tsx) with their
 * label keys. Any other value is a free-text custom type ("Other" on the web).
 */
export const PROJECT_TYPES: { value: string; labelKey: string }[] = [
  { value: 'R+2', labelKey: 'project.rPlus2Residential' },
  { value: 'Villa', labelKey: 'project.villa' },
  { value: 'Immeuble', labelKey: 'project.building' },
  { value: 'Commercial', labelKey: 'project.commercial' },
  { value: 'Industrial', labelKey: 'project.industrial' },
];

export function projectTypeLabel(t: T, type: string | null | undefined): string {
  if (!type) return t('project.notDefined');
  const known = PROJECT_TYPES.find((p) => p.value === type);
  return known ? t(known.labelKey) : type;
}

/** Statuses accepted by PATCH /api/purchase-orders/[id]. */
export const ORDER_STATUSES = ['draft', 'pending', 'approved', 'ordered', 'partially_delivered', 'delivered', 'cancelled'] as const;

const orderStatusKeys: Record<string, string> = {
  draft: 'costs.statusDraft',
  pending: 'costs.statusPending',
  approved: 'costs.statusApproved',
  ordered: 'costs.statusOrdered',
  partially_delivered: 'costs.statusPartiallyDelivered',
  delivered: 'costs.statusDelivered',
  cancelled: 'costs.statusCancelled',
};

export function orderStatusLabel(t: T, status: string): string {
  return orderStatusKeys[status] ? t(orderStatusKeys[status]) : status;
}

export function orderStatusTone(status: string): Tone {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'approved':
    case 'ordered':
      return 'brand';
    case 'partially_delivered':
      return 'info';
    case 'cancelled':
      return 'danger';
    case 'draft':
      return 'neutral';
    default:
      return 'warning';
  }
}

export function roleLabel(t: T, role: string): string {
  switch (role) {
    case 'admin':
      return t('common.admin');
    case 'site_manager':
      return t('common.siteManager');
    case 'structural_engineer':
      return t('common.engineer');
    default:
      return t('common.user');
  }
}

/** Stock state using the same thresholds as inventoryService.getInventoryStats. */
export type StockState = 'critical' | 'low' | 'normal' | 'overstocked';

export function stockState(quantity: number, minThreshold: number, maxThreshold: number | null): StockState {
  if (quantity <= 0) return 'critical';
  if (minThreshold > 0 && quantity <= minThreshold) return 'low';
  if (maxThreshold !== null && maxThreshold > 0 && quantity > maxThreshold) return 'overstocked';
  return 'normal';
}

export function stockStateLabel(t: T, state: StockState): string {
  const keys: Record<StockState, string> = {
    critical: 'inventory.statusCritical',
    low: 'inventory.statusLow',
    normal: 'inventory.statusNormal',
    overstocked: 'inventory.statusOverstocked',
  };
  return t(keys[state]);
}

export function stockStateTone(state: StockState): Tone {
  return state === 'critical' ? 'danger' : state === 'low' ? 'warning' : state === 'overstocked' ? 'info' : 'success';
}

export function movementLabel(t: T, type: string): string {
  const keys: Record<string, string> = {
    in: 'inventory.movementIn',
    out: 'inventory.movementOut',
    transfer: 'inventory.movementTransfer',
    return: 'inventory.movementReturn',
    consumption: 'inventory.locationConsumption',
  };
  return keys[type] ? t(keys[type]) : type;
}

export function movementTone(type: string): Tone {
  return type === 'in' || type === 'return' ? 'success' : type === 'transfer' ? 'info' : 'warning';
}

/** Values accepted by /api/checklists (CHECKLIST_TYPES in the route). */
export const CHECKLIST_TYPES: ChecklistType[] = ['safety', 'daily', 'quality', 'equipment', 'general'];
