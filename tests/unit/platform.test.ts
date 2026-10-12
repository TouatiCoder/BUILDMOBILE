import { workspaceFor } from '@/auth/workspace';
import { translate } from '@/i18n/translate';
import { cadenceLabel, planLabel, platformStatusLabel, platformStatusTone } from '@/lib/platform';

const t = (key: string, params?: Record<string, string | number>, fallback?: string) => translate('fr', key, params, fallback);

describe('workspace routing', () => {
  it('sends platform super-admins to the console and everyone else to the company app', () => {
    expect(workspaceFor({ isPlatformAdmin: true })).toBe('platform');
    expect(workspaceFor({ isPlatformAdmin: false })).toBe('company');
    // Unknown profile: the root waits (or offers a retry) instead of guessing.
    expect(workspaceFor(null)).toBeNull();
  });
});

describe('platform labels reuse the website catalog', () => {
  it('maps statuses to labels and tones', () => {
    expect(platformStatusLabel(t, 'suspended')).toBe('Suspendu');
    expect(platformStatusLabel(t, 'past_due')).toBe('Impayé');
    expect(platformStatusLabel(t, 'rejected')).toBe('Rejeté');
    expect(platformStatusLabel(t, null)).toBe('Aucun');
    expect(platformStatusTone('suspended')).toBe('danger');
    expect(platformStatusTone('trialing')).toBe('info');
    expect(platformStatusTone('active')).toBe('success');
  });

  it('labels plans and billing cycles in each language', () => {
    expect(planLabel(t, 'pro')).toBe('Pro');
    expect(cadenceLabel(t, 'annual')).toBe('Annuel');
    expect(cadenceLabel((k, p, f) => translate('ar', k, p, f), 'monthly')).toBe('شهري');
  });
});
