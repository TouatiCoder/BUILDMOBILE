import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { ordersApi, suppliersApi } from '@/api/endpoints';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { ChipGroup, SearchInput, type Option } from '@/components/fields';
import { ListRow, StatCard, StatGrid } from '@/components/layout';
import { AppText, StatusBadge, IconButton, SectionHeader } from '@/components/primitives';
import { usePermissions } from '@/hooks/common';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDate, toNumber } from '@/lib/format';
import { orderStatusLabel, orderStatusTone, ORDER_STATUSES } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

/** Upper bound for the summary; the website's costs page loads every order. */
const SUMMARY_LIMIT = 1000;

export default function CostsScreen() {
  const { t, locale } = useI18n();
  const { allows } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const debounced = useDebouncedValue(search);

  const all = useQuery({ queryKey: ['orders', 'summary'], queryFn: () => ordersApi.list({ limit: SUMMARY_LIMIT }) });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const orders = useQuery({
    queryKey: ['orders', 'list', { search: debounced, status }],
    queryFn: () => ordersApi.list({ search: debounced || undefined, status: status === 'all' ? undefined : status, limit: 100 }),
  });

  // Keep the costs screen focused on orders whose supplier is still active.
  // Historical orders are not deleted; they are simply excluded from this active view.
  const activeSupplierIds = useMemo(
    () => new Set((suppliers.data ?? []).filter((supplier) => supplier.isActive !== false).map((supplier) => supplier.id)),
    [suppliers.data],
  );
  const activeOrders = useMemo(
    () => (orders.data ?? []).filter((order) => activeSupplierIds.has(order.supplierId)),
    [orders.data, activeSupplierIds],
  );
  const activeAllOrders = useMemo(
    () => (all.data ?? []).filter((order) => activeSupplierIds.has(order.supplierId)),
    [all.data, activeSupplierIds],
  );

  // Same aggregates as app/costs/page.tsx.
  const summary = useMemo(() => {
    const list = activeAllOrders;
    return {
      totalExpenses: list.reduce((sum, o) => sum + toNumber(o.totalAmount), 0),
      pending: list.filter((o) => o.status === 'pending').length,
    };
  }, [activeAllOrders]);

  const statusOptions: Option[] = [{ value: 'all', label: t('common.allStatus') }, ...ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel(t, s) }))];

  const header = (
    <View style={{ gap: spacing.lg, padding: spacing.lg }}>
      <StatGrid>
        <StatCard icon="wallet-outline" tone="violet" label={t('costs.totalExpenses')} value={all.data ? formatCurrency(summary.totalExpenses, locale) : '—'} />
        <StatCard icon="hourglass-outline" tone="warning" label={t('costs.pendingOrders')} value={all.data ? String(summary.pending) : '—'} hint={t('costs.pendingOrdersHint')} />
        <StatCard
          icon="people-outline"
          tone="info"
          label={t('costs.activeSuppliers')}
          value={suppliers.data ? String(suppliers.data.filter((supplier) => supplier.isActive !== false).length) : '—'}
          onPress={() => router.push('/suppliers')}
        />
      </StatGrid>
      <View style={{ gap: spacing.xs }}>
        <SectionHeader title={t('reports.title')} actionLabel={t('common.viewAll')} onAction={() => router.push('/reports')} />
        <AppText variant="caption">Budget prévu · dépenses réelles · écart par projet</AppText>
      </View>
      <SearchInput value={search} onChangeText={setSearch} />
      <ChipGroup options={statusOptions} value={status} onChange={setStatus} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerRight: allows('orders.create')
            ? () => <IconButton icon="add-circle" color={colors.brand} accessibilityLabel={t('costs.newOrder')} onPress={() => router.push('/orders/new')} />
            : undefined,
        }}
      />
      <FlatList
        data={activeOrders}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={header}
        refreshing={false}
        onRefresh={() => {
          void orders.refetch();
          void all.refetch();
          void suppliers.refetch();
        }}
        renderItem={({ item: o }) => (
          <ListRow
            icon="receipt-outline"
            title={o.orderNumber}
            subtitle={`${o.supplier?.name ?? t('costs.notSpecified')} · ${formatDate(o.orderDate ?? o.createdAt, locale)}`}
            meta={<StatusBadge label={orderStatusLabel(t, o.status)} tone={orderStatusTone(o.status)} />}
            right={<AppText variant="bodyStrong">{formatCurrency(toNumber(o.totalAmount), locale)}</AppText>}
            onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.id } })}
          />
        )}
        ListEmptyComponent={
          orders.isLoading ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListSkeleton rows={4} />
            </View>
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
          ) : (
            <EmptyState icon="receipt-outline" title={t('costs.noOrdersFound')} message={t('costs.noOrdersYetHint')} />
          )
        }
      />
    </View>
  );
}
