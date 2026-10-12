// Mirrors the website's locale model (livreee/lib/i18n.ts): fr (default), en, ar (RTL).
export type Locale = 'fr' | 'en' | 'ar';
export const locales: Locale[] = ['fr', 'en', 'ar'];
export const defaultLocale: Locale = 'fr';

export const localeNames: Record<Locale, string> = { fr: 'Français', en: 'English', ar: 'العربية' };

export function normalizeLocale(input: string | null | undefined): Locale | null {
  if (!input) return null;
  const base = input.toLowerCase().split(/[-_]/)[0];
  return (locales as string[]).includes(base) ? (base as Locale) : null;
}

export function isRtl(locale: Locale): boolean {
  return locale === 'ar';
}
