import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { companyApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { Banner, EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { ListGroup, ListRow, Screen } from '@/components/layout';
import { AppText, StatusBadge, AppButton, IconButton, SectionHeader } from '@/components/primitives';
import { useApiMutation, useConfirm, usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDate, formatDateTime, fullName } from '@/lib/format';
import { roleLabel } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

/** Admin-only on the server: GET /api/company/users, DELETE (deactivate), invitations. */
export default function UsersScreen() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const confirm = useConfirm();

  const users = useQuery({ queryKey: ['company', 'users'], queryFn: companyApi.users, enabled: isAdmin });
  const invitations = useQuery({
    queryKey: ['company', 'invitations'],
    queryFn: () => companyApi.invitations(user!.companyId),
    enabled: isAdmin && !!user,
  });

  const deactivate = useApiMutation({ mutationFn: companyApi.deactivateUser, invalidate: [['company', 'users']], successMessage: t('settings.deleteUserSuccess') });
  const cancelInvite = useApiMutation({ mutationFn: companyApi.cancelInvitation, invalidate: [['company', 'invitations']], successMessage: t('settings.invitationCanceled') });

  if (!isAdmin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('settings.usersTitle') }} />
        <Banner tone="warning" message={t('network.forbidden')} />
      </Screen>
    );
  }

  const invitationStatus = (inv: { acceptedAt: string | null; expiresAt: string }) =>
    inv.acceptedAt
      ? { label: t('settings.invitationStatusAccepted'), tone: 'success' as const }
      : new Date(inv.expiresAt) < new Date()
        ? { label: t('settings.invitationStatusExpired'), tone: 'danger' as const }
        : { label: t('settings.invitationStatusPending'), tone: 'warning' as const };

  return (
    <Screen
      refreshing={users.isRefetching}
      onRefresh={() => {
        void users.refetch();
        void invitations.refetch();
      }}>
      <Stack.Screen options={{ title: t('settings.usersTitle') }} />
      <AppButton title={t('settings.inviteMember')} icon="person-add-outline" onPress={() => router.push('/settings/invite')} />

      <View>
        <SectionHeader title={t('settings.usersTitle')} />
        {users.isLoading ? (
          <ListSkeleton rows={3} />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : (users.data ?? []).length === 0 ? (
          <EmptyState icon="people-outline" title={t('settings.noUsersFound')} />
        ) : (
          <ListGroup>
            {(users.data ?? []).map((u) => {
              const name = fullName(u) || u.email;
              const active = u.active ?? u.isActive;
              return (
                <ListRow
                  key={u.id}
                  icon="person-outline"
                  iconTone={active ? 'brand' : 'neutral'}
                  title={name}
                  subtitle={u.email}
                  meta={
                    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                      <StatusBadge label={roleLabel(t, u.role)} tone="info" />
                      <StatusBadge label={active ? t('common.active') : t('common.inactive')} tone={active ? 'success' : 'neutral'} />
                      {u.lastLoginAt ? <AppText variant="caption">{formatDateTime(u.lastLoginAt, locale)}</AppText> : null}
                    </View>
                  }
                  right={
                    active && u.id !== user?.id ? (
                      <IconButton
                        icon="person-remove-outline"
                        color={colors.danger}
                        accessibilityLabel={`${t('users.deactivate')} ${name}`}
                        onPress={async () => {
                          if (await confirm({ message: t('users.deactivateConfirm', { name }), confirmLabel: t('users.deactivate') })) deactivate.mutate(u.id);
                        }}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </View>

      <View>
        <SectionHeader title={t('settings.invitationsTitle')} />
        {invitations.isError ? (
          <ErrorState error={invitations.error} onRetry={() => invitations.refetch()} />
        ) : (invitations.data ?? []).length === 0 ? (
          <AppText variant="small">{t('settings.noInvitationsFound')}</AppText>
        ) : (
          <ListGroup>
            {(invitations.data ?? []).map((inv) => {
              const st = invitationStatus(inv);
              return (
                <ListRow
                  key={inv.id}
                  icon="mail-outline"
                  title={inv.email}
                  subtitle={`${roleLabel(t, inv.role)} · ${t('settings.invitedAt')} ${formatDate(inv.createdAt, locale)} · ${t('settings.expiresAt')} ${formatDate(inv.expiresAt, locale)}`}
                  meta={<StatusBadge label={st.label} tone={st.tone} />}
                  right={
                    !inv.acceptedAt ? (
                      <IconButton
                        icon="close-circle-outline"
                        color={colors.danger}
                        accessibilityLabel={t('settings.cancelInvitation')}
                        onPress={async () => {
                          if (await confirm({ message: `${t('settings.cancelInvitation')} — ${inv.email}`, confirmLabel: t('settings.cancelInvitation') })) cancelInvite.mutate(inv.id);
                        }}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </View>
    </Screen>
  );
}
