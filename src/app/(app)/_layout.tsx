import { Stack } from 'expo-router';

import { usePermissions } from '@/hooks/common';

import { useDirectionStyle, useI18n } from '@/i18n/I18nProvider';
import { ROUTE_FEATURES, type Feature } from '@/lib/access';
import { colors } from '@/theme/tokens';

/** Route names grouped by the feature that unlocks them (lib/access.ts). */
const ROUTES_BY_FEATURE = Object.entries(ROUTE_FEATURES).reduce<Partial<Record<Feature, string[]>>>((acc, [route, feature]) => {
  (acc[feature] ??= []).push(route);
  return acc;
}, {});

export default function AppLayout() {
  const { t } = useI18n();
  const direction = useDirectionStyle();
  const { allows } = usePermissions();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.brand,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: true,
        headerBackTitle: t('common.back'),
        contentStyle: [{ backgroundColor: colors.background }, direction],
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('common.dashboard') }} />
      {/* Screens a role may not open (same rules as the website) are unreachable. */}
      {(Object.keys(ROUTES_BY_FEATURE) as Feature[]).map((feature) => (
        <Stack.Protected key={feature} guard={allows(feature)}>
          {ROUTES_BY_FEATURE[feature]!.map((name) => (
            <Stack.Screen key={name} name={name} />
          ))}
        </Stack.Protected>
      ))}
    </Stack>
  );
}
