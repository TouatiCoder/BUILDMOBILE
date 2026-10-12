import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/feedback';
import { Screen } from '@/components/layout';
import { AppCard, AppText, KeyValue, SectionHeader } from '@/components/primitives';
import { useToast } from '@/components/toast';
import { useI18n } from '@/i18n/I18nProvider';
import { localeNames, locales, type Locale } from '@/i18n/locale';
import { translate } from '@/i18n/translate';
import { API_BASE_URL } from '@/lib/config';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

const CODES: Record<Locale, string> = { fr: 'FR', ar: 'AR', en: 'EN' };

/** Backlog "Langue & Région": choose FR / AR / EN at any time after the first-run screen. */
export default function LanguageScreen() {
  const { t, locale, setLocale } = useI18n();
  const toast = useToast();
  const [needsRestart, setNeedsRestart] = useState(false);

  const choose = async (next: Locale) => {
    if (next === locale) return;
    const restart = await setLocale(next);
    setNeedsRestart(restart);
    toast.show('success', translate(next, 'common.saved'));
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('common.language') }} />
      <SectionHeader title={t('common.language')} subtitle={t('welcome.subtitle')} />
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {locales.map((l) => {
          const active = l === locale;
          return (
            <Pressable
              key={l}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={localeNames[l]}
              onPress={() => void choose(l)}
              style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && { opacity: 0.9 }]}>
              <View style={[styles.code, active && styles.codeActive]}>
                <AppText variant="label" color={active ? colors.textOnBrand : colors.textSecondary}>
                  {CODES[l]}
                </AppText>
              </View>
              <AppText variant="title" style={{ flex: 1 }} color={active ? colors.brandDark : colors.text}>
                {localeNames[l]}
              </AppText>
              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={24} color={active ? colors.brand : colors.borderStrong} />
            </Pressable>
          );
        })}
      </View>
      {needsRestart ? <Banner tone="info" message={t('common.restartForRtl')} /> : null}
      <AppCard>
        <KeyValue label={t('settings.version')} value={Constants.expoConfig?.version ?? '—'} />
        <KeyValue label={t('auth.apiServer')} value={API_BASE_URL || '—'} />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET + 16,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  code: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  codeActive: { backgroundColor: colors.brand },
});
