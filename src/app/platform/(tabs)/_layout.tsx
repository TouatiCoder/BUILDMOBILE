import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { platformApi } from '@/api/endpoints';
import { useDirectionStyle, useI18n } from '@/i18n/I18nProvider';
import { colors } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(active: IconName, inactive: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : inactive} color={color} size={size} />;
  }
  return TabIcon;
}

/** Super-admin console: Overview · Companies · Payments · Account. */
export default function PlatformTabsLayout() {
  const { t } = useI18n();
  const direction = useDirectionStyle();
  // Pending manual payments drive the badge on the Payments tab.
  const payments = useQuery({ queryKey: ['platform', 'manual-payments'], queryFn: platformApi.manualPayments });
  const pending = (payments.data?.items ?? []).filter((p) => p.status === 'pending').length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { paddingVertical: 4 },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerShadowVisible: false,
        sceneStyle: [{ backgroundColor: colors.background }, direction],
      }}>
      <Tabs.Screen name="index" options={{ title: t('platform.overview'), headerShown: false, tabBarIcon: icon('speedometer', 'speedometer-outline') }} />
      <Tabs.Screen name="companies" options={{ title: t('platform.companies.title'), tabBarIcon: icon('business', 'business-outline') }} />
      <Tabs.Screen
        name="payments"
        options={{
          title: t('platform.manualPayments.title'),
          tabBarIcon: icon('card', 'card-outline'),
          tabBarBadge: pending > 0 ? pending : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="account" options={{ title: t('tabs.account'), tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
