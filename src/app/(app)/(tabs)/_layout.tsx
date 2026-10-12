import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';

import { usePermissions } from '@/hooks/common';
import { TAB_FEATURES } from '@/lib/access';
import { useDirectionStyle, useI18n } from '@/i18n/I18nProvider';
import { colors } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(active: IconName, inactive: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : inactive} color={color} size={size} />;
  }
  return TabIcon;
}

/**
 * The five navigation sections of the backlog (Architecture de l'Information):
 * A. Tableau de bord · B. Stock/Inventaire · C. Calculs structurels (Projets) ·
 * D. Coûts/Fournisseurs · E. Mon compte/Réglages.
 * Each role gets the sections the website's sidebar gives it
 * (lib/access.ts ← livreee/components/layout/nav-pages.ts): admin and site
 * manager all five; structural engineer Dashboard, Projects, Account; the
 * `user` role Dashboard and Account.
 */
export default function TabsLayout() {
  const { t } = useI18n();
  const direction = useDirectionStyle();
  const { allows } = usePermissions();

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
      <Tabs.Screen name="index" options={{ title: t('common.dashboard'), tabBarIcon: icon('grid', 'grid-outline') }} />
      <Tabs.Protected guard={allows(TAB_FEATURES.inventory)}>
        <Tabs.Screen name="inventory" options={{ title: t('common.inventory'), tabBarIcon: icon('cube', 'cube-outline') }} />
      </Tabs.Protected>
      <Tabs.Protected guard={allows(TAB_FEATURES.projects)}>
        <Tabs.Screen name="projects" options={{ title: t('common.projects'), tabBarIcon: icon('construct', 'construct-outline') }} />
      </Tabs.Protected>
      <Tabs.Protected guard={allows(TAB_FEATURES.costs)}>
        <Tabs.Screen name="costs" options={{ title: t('common.costs'), tabBarIcon: icon('cash', 'cash-outline') }} />
      </Tabs.Protected>
      <Tabs.Screen name="more" options={{ title: t('tabs.account'), tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
