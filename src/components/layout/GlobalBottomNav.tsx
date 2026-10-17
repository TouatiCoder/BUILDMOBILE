import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/primitives';
import { usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { TAB_FEATURES } from '@/lib/access';
import { colors, spacing } from '@/theme/tokens';

type NavItem = {
  key: string;
  label: string;
  activeIcon: React.ComponentProps<typeof Ionicons>['name'];
  icon: React.ComponentProps<typeof Ionicons>['name'];
  href: string;
  visible: boolean;
  matches: (path: string) => boolean;
};

export function GlobalBottomNav() {
  const { t } = useI18n();
  const { allows } = usePermissions();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const items: NavItem[] = [
    {
      key: 'dashboard',
      label: t('common.dashboard'),
      activeIcon: 'grid',
      icon: 'grid-outline',
      href: '/(app)/(tabs)',
      visible: true,
      matches: (path) => path === '/' || path === '/index' || path.endsWith('/(tabs)'),
    },
    {
      key: 'inventory',
      label: t('common.inventory'),
      activeIcon: 'cube',
      icon: 'cube-outline',
      href: '/(app)/(tabs)/inventory',
      visible: allows(TAB_FEATURES.inventory),
      matches: (path) => path.includes('inventory') || path.includes('materials') || path.includes('warehouses'),
    },
    {
      key: 'projects',
      label: t('common.projects'),
      activeIcon: 'construct',
      icon: 'construct-outline',
      href: '/(app)/(tabs)/projects',
      visible: allows(TAB_FEATURES.projects),
      matches: (path) => path.includes('projects'),
    },
    {
      key: 'costs',
      label: t('common.costs'),
      activeIcon: 'cash',
      icon: 'cash-outline',
      href: '/(app)/(tabs)/costs',
      visible: allows(TAB_FEATURES.costs),
      matches: (path) => path.includes('costs') || path.includes('suppliers') || path.includes('orders'),
    },
    {
      key: 'account',
      label: t('tabs.account'),
      activeIcon: 'person-circle',
      icon: 'person-circle-outline',
      href: '/(app)/(tabs)/more',
      visible: true,
      matches: (path) => path.includes('more') || path.includes('settings') || path.includes('notifications') || path.includes('reports') || path.includes('checklists') || path.includes('tools'),
    },
  ];

  const visibleItems = items.filter((item) => item.visible);
  const activeKey = visibleItems.find((item) => item.matches(pathname))?.key ?? 'dashboard';

  return (
    <View
      accessibilityRole="toolbar"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingTop: spacing.xs,
        paddingBottom: Math.max(insets.bottom, spacing.xs),
        paddingHorizontal: spacing.xs,
        minHeight: 60 + insets.bottom,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}>
      {visibleItems.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => {
              if (!active) router.replace(item.href as never);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              opacity: pressed ? 0.72 : 1,
            })}>
            <Ionicons
              name={active ? item.activeIcon : item.icon}
              size={22}
              color={active ? colors.brand : colors.textMuted}
            />
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ fontSize: 10, fontWeight: active ? '700' : '500' }}
              color={active ? colors.brand : colors.textMuted}>
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
