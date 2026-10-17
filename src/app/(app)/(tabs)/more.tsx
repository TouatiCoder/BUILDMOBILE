import { router, Stack, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { ListGroup, ListRow, Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, SectionHeader, StatusBadge, type IconName } from '@/components/primitives';
import { useConfirm, usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { localeNames } from '@/i18n/locale';
import { fullName, initials } from '@/lib/format';
import { roleLabel } from '@/lib/labels';
import { colors, radius, spacing } from '@/theme/tokens';

type Entry = { icon: IconName; label: string; subtitle?: string; href: Href; show: boolean };

/**
 * E. Mon compte / Réglages (backlog). Every role manages its profile,
 * security (password, biometrics) and language; only the admin sees company
 * administration (employees, invitations, subscription).
 */
export default function AccountScreen() {
  const { t, locale } = useI18n();
  const { user, signOut } = useAuth();
  const { allows } = usePermissions();
  const confirm = useConfirm();

  const sections: { title: string; entries: Entry[] }[] = [
    {
      title: t('settings.securityTitle'),
      entries: [
        { icon: 'person-circle-outline', label: t('settings.profileTitle'), href: '/settings/profile', show: true },
        { icon: 'finger-print-outline', label: t('common.security'), subtitle: t('biometric.sectionTitle'), href: '/settings/security', show: true },
      ],
    },
    {
      title: t('common.company'),
      entries: [
        { icon: 'business-outline', label: t('settings.companyInfoTitle'), href: '/settings/company', show: allows('company') },
        { icon: 'people-outline', label: t('dashboard.manageUsers'), href: '/settings/users', show: allows('users') },
        { icon: 'storefront-outline', label: t('common.suppliers'), href: '/suppliers', show: allows('suppliers') },
        { icon: 'card-outline', label: t('subscription.title'), href: '/settings/subscription', show: allows('subscription') },
      ],
    },
    {
      title: t('common.general'),
      entries: [
        { icon: 'notifications-outline', label: t('common.notifications'), href: '/notifications', show: allows('notifications') },
        { icon: 'bar-chart-outline', label: t('common.reports'), href: '/reports', show: allows('reports') },
        { icon: 'calculator-outline', label: t('common.calculationHubTitle'), href: '/tools', show: allows('tools') },
        { icon: 'checkbox-outline', label: t('common.checklistsPageTitle'), href: '/checklists', show: allows('checklists') },
      ],
    },
    {
      title: t('settings.appSection'),
      entries: [{ icon: 'language-outline', label: t('common.language'), subtitle: localeNames[locale], href: '/settings/language', show: true }],
    },
  ];

  const name = fullName(user);
  return (
    <Screen>
      <Stack.Screen options={{ title: t('tabs.account') }} />
      <AppCard elevated style={styles.identity}>
        <View style={styles.avatar}>
          <AppText variant="heading" color={colors.textOnBrand}>
            {initials(name || user?.email || '')}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="title">{name || user?.email}</AppText>
          <AppText variant="small" numberOfLines={1}>
            {user?.email}
          </AppText>
          {user ? <StatusBadge label={roleLabel(t, user.role)} tone="brand" /> : null}
        </View>
      </AppCard>

      {sections.map((section) => {
        const visible = section.entries.filter((e) => e.show);
        if (visible.length === 0) return null;
        return (
          <View key={section.title}>
            <SectionHeader title={section.title} />
            <ListGroup>
              {visible.map((e) => (
                <ListRow key={e.label} icon={e.icon} title={e.label} subtitle={e.subtitle} onPress={() => router.push(e.href)} />
              ))}
            </ListGroup>
          </View>
        );
      })}

      <AppButton
        title={t('common.logout')}
        icon="log-out-outline"
        variant="danger"
        size="lg"
        onPress={async () => {
          if (await confirm({ title: t('common.logout'), message: t('session.logoutConfirm'), confirmLabel: t('common.logout') })) {
            await signOut();
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
