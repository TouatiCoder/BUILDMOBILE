import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlueprintBackdrop, LogoTile } from '@/components/brand';
import { AppButton, AppText } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { isRtl, type Locale } from '@/i18n/locale';
import { translate } from '@/i18n/translate';
import { colors, radius, shadows, spacing, TOUCH_TARGET } from '@/theme/tokens';

type LanguageOption = { locale: Locale; native: string; code: string };

// Each language is written in its own script so it is recognizable whatever the current UI language.
const OPTIONS: LanguageOption[] = [
  { locale: 'fr', native: 'Français', code: 'FR' },
  { locale: 'ar', native: 'العربية', code: 'AR' },
  { locale: 'en', native: 'English', code: 'EN' },
];

/**
 * First screen of the app (before login). The choice is persisted by
 * I18nProvider (AsyncStorage `app.locale`); once saved this screen is skipped
 * on later launches. The language can be changed again in My account › Language.
 */
export default function LanguageScreen() {
  const { locale, setLocale } = useI18n();
  const [selected, setSelected] = useState<Locale>(locale);
  const [saving, setSaving] = useState(false);
  // Preview the copy and the reading direction in the language being selected.
  const tr = (key: string) => translate(selected, key);
  const rtl = isRtl(selected);

  const onContinue = async () => {
    setSaving(true);
    try {
      await setLocale(selected);
      // The auth stack then shows the login screen (Stack.Protected guard).
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { direction: rtl ? 'rtl' : 'ltr' }]}>
      <BlueprintBackdrop />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <View style={styles.hero}>
            <LogoTile size={76} />
            <AppText variant="display" color={colors.textOnBrand} style={styles.center}>
              BuildStock Pro
            </AppText>
            <AppText variant="body" color={colors.textOnBrandMuted} style={styles.center}>
              {tr('auth.login.subtitle')}
            </AppText>
          </View>

          <View style={styles.sheet}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="heading" accessibilityRole="header">
                {tr('welcome.title')}
              </AppText>
              <AppText variant="small">{tr('welcome.subtitle')}</AppText>
            </View>

            <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
              {OPTIONS.map((option) => {
                const active = option.locale === selected;
                return (
                  <Pressable
                    key={option.locale}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={option.native}
                    onPress={() => setSelected(option.locale)}
                    style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && { opacity: 0.9 }]}>
                    <View style={[styles.code, active && styles.codeActive]}>
                      <AppText variant="label" color={active ? colors.textOnBrand : colors.textSecondary}>
                        {option.code}
                      </AppText>
                    </View>
                    <AppText variant="title" style={styles.flex} color={active ? colors.brandDark : colors.text}>
                      {option.native}
                    </AppText>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={24}
                      color={active ? colors.brand : colors.borderStrong}
                    />
                  </Pressable>
                );
              })}
            </View>

            <AppButton title={tr('welcome.continue')} size="lg" iconRight="arrow-forward" loading={saving} onPress={onContinue} />
            <AppText variant="caption" style={styles.center}>
              {tr('welcome.changeLater')}
            </AppText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandDeep },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl, paddingBottom: spacing.xxl },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl + 8,
    borderTopRightRadius: radius.xl + 8,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    ...shadows.lg,
  },
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
  code: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  codeActive: { backgroundColor: colors.brand },
});
