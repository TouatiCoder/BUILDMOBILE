import type { Tone } from '@/theme/tokens';

type T = (key: string, params?: Record<string, string | number>, fallback?: string) => string;

/** Company / subscription / payment status label from the website's `platform.status` catalog. */
export function platformStatusLabel(t: T, status: string | null | undefined): string {
  if (!status) return t('platform.status.none');
  return t(`platform.status.${status}`, undefined, status);
}

export function platformStatusTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'active':
    case 'paid':
    case 'completed':
    case 'processed':
      return 'success';
    case 'trialing':
    case 'pending':
    case 'created':
      return 'info';
    case 'past_due':
      return 'warning';
    case 'suspended':
    case 'failed':
    case 'canceled':
    case 'rejected':
    case 'dead_letter':
    case 'expired':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function cadenceLabel(t: T, cadence: string): string {
  return t(`platform.cadence_${cadence}`, undefined, cadence);
}

export function methodLabel(t: T, method: string): string {
  return t(`platform.method_${method}`, undefined, method);
}

/** Plan code (free | pro | enterprise) → the website's plan label. */
export function planLabel(t: T, code: string): string {
  const keys: Record<string, string> = { free: 'platform.planFree', pro: 'platform.planPro', enterprise: 'platform.planEnterprise' };
  return keys[code] ? t(keys[code]) : code;
}
