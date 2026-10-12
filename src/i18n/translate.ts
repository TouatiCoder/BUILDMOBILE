import ar from './messages/ar.json';
import en from './messages/en.json';
import fr from './messages/fr.json';
import type { Locale } from './locale';
import { mobileMessages } from './mobile-messages';

type Catalog = Record<string, unknown>;
const webCatalogs: Record<Locale, Catalog> = { fr, en, ar };

export type TranslateParams = Record<string, string | number>;

function lookup(catalog: Catalog, key: string): string | undefined {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Catalog)) {
      node = (node as Catalog)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Resolves `namespace.key` against the mobile dictionary first (mobile-only
 * strings), then the website catalog of the active locale, then French (the
 * website's default locale), then the provided fallback or the key itself.
 */
export function translate(locale: Locale, key: string, params?: TranslateParams, fallback?: string): string {
  const value =
    mobileMessages[locale][key] ??
    lookup(webCatalogs[locale], key) ??
    mobileMessages.fr[key] ??
    lookup(webCatalogs.fr, key) ??
    fallback ??
    key;
  return interpolate(value, params);
}
