import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { FlatList, View } from 'react-native';

import { warehousesApi } from '@/api/endpoints';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { ListRow } from '@/components/layout';
import { StatusBadge, IconButton } from '@/components/primitives';
import { usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatNumber, toNumberOrNull } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

export default function WarehousesScreen() {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const q = useQuery({ queryKey: ['warehouses'], queryFn: warehousesApi.list });
  const canManage = can('manage_inventory');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: t('warehouse.title'),
          headerRight: canManage
            ? () => <IconButton icon="add-circle" color={colors.brand} accessibilityLabel={t('warehouse.newWarehouse')} onPress={() => router.push('/warehouses/form')} />
            : undefined,
        }}
      />
      {q.isLoading ? (
        <View style={{ padding: spacing.lg }}>
          <ListSkeleton rows={3} />
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(w) => w.id}
          refreshing={false}
          onRefresh={() => q.refetch()}
          renderItem={({ item: w }) => {
            const capacity = toNumberOrNull(w.capacity);
            return (
              <ListRow
                icon="business-outline"
                iconTone={w.isMain ? 'brand' : 'neutral'}
                title={w.name}
                subtitle={[w.location, capacity !== null ? `${t('warehouse.capacity')}: ${formatNumber(capacity, locale)}` : null].filter(Boolean).join(' · ') || undefined}
                meta={w.isMain ? <StatusBadge label={t('warehouse.mainWarehouse')} tone="brand" /> : undefined}
                onPress={canManage ? () => router.push({ pathname: '/warehouses/form', params: { id: w.id } }) : undefined}
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="business-outline"
              title={t('warehouse.startByCreatingFirst')}
              actionLabel={canManage ? t('warehouse.createFirst') : undefined}
              onAction={() => router.push('/warehouses/form')}
            />
          }
        />
      )}
    </View>
  );
}
