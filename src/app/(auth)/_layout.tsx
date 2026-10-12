import { Stack } from 'expo-router';

import { useDirectionStyle, useI18n } from '@/i18n/I18nProvider';
import { colors } from '@/theme/tokens';

/**
 * Signed-out flow: Language selection (first launch only) → Login → Forgot password / Sign-up.
 * The language screen is guarded by "no language saved yet"; after the choice
 * the guard flips and Expo Router moves to the login screen.
 */
export default function AuthLayout() {
  const { t, hasChosenLocale } = useI18n();
  const direction = useDirectionStyle();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.brand,
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        contentStyle: [{ backgroundColor: colors.background }, direction],
      }}>
      <Stack.Protected guard={!hasChosenLocale}>
        <Stack.Screen name="language" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={hasChosenLocale}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ title: t('auth.signup.title'), headerBackTitle: t('common.back') }} />
        <Stack.Screen name="forgot-password" options={{ title: t('auth.forgotPassword.title'), headerBackTitle: t('common.back') }} />
      </Stack.Protected>
    </Stack>
  );
}
