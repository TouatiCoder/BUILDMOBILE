import type { Decimalish } from '@/api/types';
import type { Locale } from '@/i18n/locale';

/** Prisma Decimal values arrive as strings; everything numeric goes through here. */
export function toNumber(value: Decimalish | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toNumberOrNull(value: Decimalish | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const intlLocale: Record<Locale, string> = { fr: 'fr-MA', en: 'en-US', ar: 'ar-MA' };

/** Non-breaking space: groups thousands without letting the number wrap. */
const THOUSANDS_SPACE = ' ';

/**
 * French reading used everywhere in the app: thousands separated by a space and
 * the comma as the ONLY decimal mark (1 950,9 kg ; 78,04 sacs ; 8 550,00 MAD).
 * fr-MA used a dot for thousands (1.950,9), which users confused with a decimal
 * point. Built on en-US output so the result is the same on every JS engine.
 */
function formatFrench(value: number, minimumFractionDigits: number, maximumFractionDigits: number): string {
  const en = value.toLocaleString('en-US', { minimumFractionDigits, maximumFractionDigits });
  return en.replace(/,/g, THOUSANDS_SPACE).replace('.', ',');
}

/** Amounts in MAD with 2 decimals, e.g. "8 550,00 MAD". */
export function formatCurrency(amount: number, locale: Locale = 'fr', currency = 'MAD'): string {
  try {
    if (locale === 'fr') return `${formatFrench(amount, 2, 2)} ${currency}`;
    return amount.toLocaleString(intlLocale[locale], { style: 'currency', currency, maximumFractionDigits: 2 });
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(value: number, locale: Locale = 'fr', maximumFractionDigits = 2): string {
  try {
    if (locale === 'fr') return formatFrench(value, 0, maximumFractionDigits);
    return value.toLocaleString(intlLocale[locale], { maximumFractionDigits });
  } catch {
    return String(Math.round(value * 100) / 100);
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * dd/mm/yyyy — the date format required by the backlog (Langue & Région),
 * identical in every UI language. `_locale` is kept for call-site compatibility.
 */
export function formatDate(value: string | Date | null | undefined, _locale: Locale = 'fr'): string {
  const date = toDate(value);
  if (!date) return '—';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** dd/mm/yyyy HH:mm (24 h). */
export function formatDateTime(value: string | Date | null | undefined, locale: Locale = 'fr'): string {
  const date = toDate(value);
  if (!date) return '—';
  return `${formatDate(date, locale)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** YYYY-MM-DD in local time, the format the web forms send to the API. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fullName(user: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
  if (!user) return '';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '').concat(parts[1]?.[0] ?? '').toUpperCase() || 'U';
}

/** Parses a user-typed decimal ("1 500,50" or "1500.5"). Returns null when empty, NaN when invalid. */
export function parseDecimalInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}
