import { useQuery } from '@tanstack/react-query';
import { Stack, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';

import { inventoryApi } from '@/api/endpoints';
import type { StockMovementRow } from '@/api/types';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { ListRow } from '@/components/layout';
import { AppText, StatusBadge, AppButton } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDateTime, formatNumber, fullName } from '@/lib/format';
import { movementLabel, movementTone } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

const PAGE = 50;

/** GET /api/inventory/movements?limit= — the API has no offset, so "load more" raises the limit. */
export default function MovementsScreen() {
  const { t, locale } = useI18n();
  const isFocused = useIsFocused();
  const [limit, setLimit] = useState(PAGE);
  const q = useQuery({
    queryKey: ['inventory', 'movements', limit],
    queryFn: () => inventoryApi.movements(limit),
    placeholderData: (prev) => prev,
    refetchInterval: isFocused ? 1_000 : false,
    refetchIntervalInBackground: false,
  });

  useFocusEffect(
    useCallback(() => {
      void q.refetch();
    }, [q]),
  );

  const describeRoute = (m: StockMovementRow) => {
    const from = m.source_warehouse?.name ?? (m.source_type === 'supplier' ? t('inventory.supplier') : null);
    const to = m.destination_warehouse?.name ?? m.project?.name ?? (m.destination_type === 'project' ? t('inventory.locationToSite') : null);
    return [from, to].filter(Boolean).join(' → ');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: t('inventory.stockMovements') }} />
      {q.isLoading ? (
        <View style={{ padding: spacing.lg }}>
          <ListSkeleton />
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(m) => m.id}
          refreshing={false}
          onRefresh={() => q.refetch()}
          renderItem={({ item: m }) => {
            const user = m.user ? fullName({ firstName: m.user.firstName ?? m.user.first_name, lastName: m.user.lastName ?? m.user.last_name }) : '';
            return (
              <ListRow
                icon={m.movement_type === 'in' ? 'arrow-down-circle-outline' : m.movement_type === 'transfer' ? 'swap-horizontal-outline' : 'arrow-up-circle-outline'}
                iconTone={movementTone(m.movement_type)}
                title={m.material?.name ?? t('inventory.unknownMaterial')}
                subtitle={[describeRoute(m), m.description].filter(Boolean).join(' · ') || undefined}
                meta={
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                    <StatusBadge label={movementLabel(t, m.movement_type)} tone={movementTone(m.movement_type)} />
                    <AppText variant="caption">
                      {formatDateTime(m.movement_date, locale)}
                      {user ? ` · ${t('inventory.byUser')} ${user}` : ''}
                    </AppText>
                  </View>
                }
                right={<AppText variant="bodyStrong">{`${formatNumber(Number(m.quantity), locale)} ${m.material?.unit ?? ''}`}</AppText>}
              />
            );
          }}
          ListEmptyComponent={<EmptyState icon="swap-horizontal-outline" title={t('inventory.noRecentMovements')} />}
          ListFooterComponent={
            q.data && q.data.length >= limit ? (
              <AppButton title={t('common.loadMore')} variant="ghost" loading={q.isFetching} onPress={() => setLimit((l) => l + PAGE)} style={{ margin: spacing.lg }} />
            ) : null
          }
        />
      )}
    </View>
  );
}
