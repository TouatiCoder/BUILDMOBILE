import { Stack } from 'expo-router';

import { useDirectionStyle, useI18n } from '@/i18n/I18nProvider';
import { colors } from '@/theme/tokens';

/**
 * Super-admin (platform operator) workspace. Reached only when the session
 * profile has `isPlatformAdmin` (root Stack.Protected guard); every endpoint
 * used here is also protected server-side by requirePlatformAdmin.
 */
export default function PlatformLayout() {
  const { t } = useI18n();
  const direction = useDirectionStyle();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.brand,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.surface },
        headerBackTitle: t('common.back'),
        contentStyle: [{ backgroundColor: colors.background }, direction],
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="company/[id]" options={{ title: t('platform.companyDetails') }} />
    </Stack>
  );
}
