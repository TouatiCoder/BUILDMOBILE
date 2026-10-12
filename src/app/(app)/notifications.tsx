import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { FlatList, View } from 'react-native';

import { notificationsApi } from '@/api/endpoints';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { ListRow } from '@/components/layout';
import { AppText, AppButton } from '@/components/primitives';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDateTime } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

/** GET /api/notifications (latest 100), POST /[id]/read and /read-all. */
export default function NotificationsScreen() {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list });
  const markOne = useApiMutation({ mutationFn: notificationsApi.markRead, invalidate: [['notifications']] });
  const markAll = useApiMutation({ mutationFn: notificationsApi.markAllRead, invalidate: [['notifications']], successMessage: t('common.success') });
  const unread = (q.data ?? []).filter((n) => !n.isRead).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: t('common.notifications') }} />
      {q.isLoading ? (
        <View style={{ padding: spacing.lg }}>
          <ListSkeleton />
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(n) => n.id}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListHeaderComponent={
            unread > 0 ? (
              <View style={{ padding: spacing.lg }}>
                <AppButton title={t('common.markAllRead')} icon="checkmark-done-outline" variant="secondary" loading={markAll.isPending} onPress={() => markAll.mutate(undefined)} />
              </View>
            ) : null
          }
          renderItem={({ item: n }) => (
            <ListRow
              icon={n.isRead ? 'notifications-outline' : 'notifications'}
              iconTone={n.isRead ? 'neutral' : 'brand'}
              title={n.title}
              subtitle={n.bodyText ?? undefined}
              meta={<AppText variant="caption">{formatDateTime(n.createdAt, locale)}</AppText>}
              onPress={n.isRead ? undefined : () => markOne.mutate(n.id)}
              accessibilityLabel={n.isRead ? n.title : `${n.title}. ${t('notifications.markRead')}`}
            />
          )}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title={t('common.noNotifications')} />}
        />
      )}
    </View>
  );
}
