import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { ListGroup, ListRow, Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, StatusBadge, SectionHeader, type IconName } from '@/components/primitives';
import { useConfirm } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { localeNames } from '@/i18n/locale';
import { fullName, initials } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

/** Super-admin account: profile, security (password, biometrics), language, sign-out. */
export default function PlatformAccountScreen() {
  const { t, locale } = useI18n();
  const { user, signOut } = useAuth();
  const confirm = useConfirm();
  const name = fullName(user);

  const entries: { icon: IconName; label: string; subtitle?: string; href: Href }[] = [
    { icon: 'person-circle-outline', label: t('settings.profileTitle'), href: '/platform/profile' },
    { icon: 'finger-print-outline', label: t('common.security'), subtitle: t('biometric.sectionTitle'), href: '/platform/security' },
    { icon: 'language-outline', label: t('common.language'), subtitle: localeNames[locale], href: '/platform/language' },
  ];

  return (
    <Screen>
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
          <StatusBadge label={t('platform.layout.badge')} tone="violet" dot />
        </View>
      </AppCard>

      <View>
        <SectionHeader title={t('settings.securityTitle')} />
        <ListGroup>
          {entries.map((e) => (
            <ListRow key={e.label} icon={e.icon} title={e.label} subtitle={e.subtitle} onPress={() => router.push(e.href)} />
          ))}
        </ListGroup>
      </View>

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
    backgroundColor: colors.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
