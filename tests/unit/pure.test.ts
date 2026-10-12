import { classifySecureStoreError, mapError, resolveKind } from '@/auth/biometrics';
import { extractSessionToken, isTokenExpired } from '@/auth/token';
import { translate } from '@/i18n/translate';
import { parseDecimalInput, toNumber } from '@/lib/format';
import { aggregateStock } from '@/lib/inventory';
import { PROJECT_STATUS_FLOW, stockState } from '@/lib/labels';
import { hasPermission } from '@/lib/permissions';

import { makeToken } from './helpers';

describe('session token helpers', () => {
  it('extracts auth-token from a folded Set-Cookie header', () => {
    expect(extractSessionToken('foo=1; Path=/, auth-token=abc.def.ghi; Path=/; HttpOnly')).toBe('abc.def.ghi');
    expect(extractSessionToken('auth-token=; Path=/; Max-Age=0')).toBeNull();
    expect(extractSessionToken(null)).toBeNull();
  });

  it('detects expiry from the exp claim', () => {
    expect(isTokenExpired(makeToken({ exp: Math.floor(Date.now() / 1000) - 10 }))).toBe(true);
    expect(isTokenExpired(makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }))).toBe(false);
  });
});

describe('biometric classification', () => {
  it('labels Face ID / Touch ID on iOS and fingerprint on Android', () => {
    expect(resolveKind([2], 'ios')).toBe('faceId');
    expect(resolveKind([1], 'ios')).toBe('touchId');
    expect(resolveKind([1], 'android')).toBe('fingerprint');
    expect(resolveKind([2], 'android')).toBe('faceUnlock');
    expect(resolveKind([1, 2], 'android')).toBe('generic'); // the system prompt picks the method
  });

  it('maps OS errors to outcomes', () => {
    expect(mapError('user_cancel')).toBe('cancelled');
    expect(mapError('lockout')).toBe('lockout');
    expect(mapError('not_enrolled')).toBe('unavailable');
    expect(mapError('authentication_failed')).toBe('failed');
    expect(classifySecureStoreError(new Error('KeyPermanentlyInvalidatedException'))).toBe('invalidated');
    expect(classifySecureStoreError(new Error('User canceled'))).toBe('cancelled');
  });
});

describe('i18n', () => {
  it('uses website catalogs with French fallback and interpolation', () => {
    expect(translate('fr', 'common.save')).toBe('Enregistrer');
    expect(translate('en', 'common.save')).toBe('Save');
    expect(translate('fr', 'settings.inviteSuccess', { email: 'x@y.z' })).toBe('Invitation envoyée à x@y.z');
    expect(translate('ar', 'biometric.enableFaceId')).toContain('Face ID');
    expect(translate('fr', 'does.not.exist', undefined, 'fallback')).toBe('fallback');
  });
});

describe('business helpers mirror the website', () => {
  it('reads Prisma decimals serialized as strings', () => {
    expect(toNumber('2.8')).toBe(2.8);
    expect(toNumber(null)).toBe(0);
    expect(parseDecimalInput('1 500,50')).toBe(1500.5);
    expect(parseDecimalInput('')).toBeNull();
    expect(Number.isNaN(parseDecimalInput('abc'))).toBe(true);
  });

  it('aggregates stock across warehouses like inventoryService', () => {
    const agg = aggregateStock([
      { id: '1', quantity: '700', minThreshold: '2000', maxThreshold: '4000', warehouseId: 'w1', warehouse: null },
      { id: '2', quantity: '9000', minThreshold: '2000', maxThreshold: null, warehouseId: 'w2', warehouse: null },
    ]);
    expect(agg).toEqual({ quantity: 9700, minThreshold: 2000, maxThreshold: 4000 });
    expect(stockState(0, 5, null)).toBe('critical');
    expect(stockState(3, 5, null)).toBe('low');
    expect(stockState(10, 5, 8)).toBe('overstocked');
  });

  it('uses the server project status flow', () => {
    expect(PROJECT_STATUS_FLOW.planning).toEqual(['active', 'cancelled']);
    expect(PROJECT_STATUS_FLOW.completed).toEqual([]);
  });

  it('keeps the website permission matrix', () => {
    expect(hasPermission('structural_engineer', 'view_inventory')).toBe(false);
    expect(hasPermission('site_manager', 'manage_users')).toBe(false);
    expect(hasPermission('admin', 'approve_orders')).toBe(true);
    expect(hasPermission('user', 'view_projects')).toBe(false);
  });
});
