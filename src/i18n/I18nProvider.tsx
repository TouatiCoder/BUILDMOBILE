import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';

import { defaultLocale, isRtl, normalizeLocale, type Locale } from './locale';
import { translate, type TranslateParams } from './translate';

// The locale is a UI preference, not sensitive data: AsyncStorage is appropriate.
// Its presence also records that the user has chosen a language (first-run screen).
const LOCALE_STORAGE_KEY = 'app.locale';

type I18nContextValue = {
  locale: Locale;
  /** True for Arabic. Screens mirror immediately through the layout `direction`. */
  rtl: boolean;
  /** False until the user picked a language on the first-run screen (or in settings). */
  hasChosenLocale: boolean;
  /**
   * Persists the language. Resolves to true when native navigation chrome
   * (headers, back gestures) will only mirror after the next app start.
   */
  setLocale: (locale: Locale) => Promise<boolean>;
  t: (key: string, params?: TranslateParams, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function deviceLocale(): Locale {
  try {
    return normalizeLocale(getLocales()[0]?.languageCode) ?? defaultLocale;
  } catch {
    return defaultLocale;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [hasChosenLocale, setHasChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((stored) => {
        const saved = normalizeLocale(stored);
        setLocaleState(saved ?? deviceLocale());
        setHasChosen(saved !== null);
      })
      .catch(() => setLocaleState(deviceLocale()))
      .finally(() => setReady(true));
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    setHasChosen(true);
    try {
      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Preference only: the choice still applies for this session.
    }
    const wantRtl = isRtl(next);
    if (I18nManager.isRTL === wantRtl) return false;
    // Content mirrors right away (see `direction` in the layouts); native
    // navigation chrome follows I18nManager, which applies at the next start.
    I18nManager.allowRTL(wantRtl);
    I18nManager.forceRTL(wantRtl);
    return true;
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      rtl: isRtl(locale),
      hasChosenLocale,
      setLocale,
      t: (key, params, fallback) => translate(locale, key, params, fallback),
    }),
    [locale, hasChosenLocale, setLocale],
  );

  // Children (and the biometric prompt text) wait for the saved locale; the
  // native splash screen stays visible meanwhile.
  if (!ready) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

/** Layout direction style for a screen container, so Arabic mirrors without a restart. */
export function useDirectionStyle() {
  const { rtl } = useI18n();
  return { direction: rtl ? ('rtl' as const) : ('ltr' as const) };
}
