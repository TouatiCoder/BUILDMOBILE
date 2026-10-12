import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ordersApi } from '@/api/endpoints';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { DateField, SelectField, type Option } from '@/components/fields';
import { ListGroup, ListRow, Screen } from '@/components/layout';
import { AppText, StatusBadge, AppButton, AppCard, KeyValue, SectionHeader } from '@/components/primitives';
import { useApiMutation, useConfirm, usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDate, formatDateTime, formatNumber, fullName, toNumber } from '@/lib/format';
import { orderStatusLabel, orderStatusTone, ORDER_STATUSES } from '@/lib/labels';
import { spacing } from '@/theme/tokens';

/**
 * GET/PATCH/DELETE /api/purchase-orders/[id]. The server applies no role
 * check on PATCH/DELETE; following the backlog, only roles that manage costs
 * (admin, site manager) get the edit controls — the structural engineer
 * consults orders read-only ("Avis technique").
 */
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const confirm = useConfirm();
  const { allows } = usePermissions();
  const canEdit = allows('orders.edit');
  const order = useQuery({ queryKey: ['orders', 'detail', id], queryFn: () => ordersApi.get(id) });

  const update = useApiMutation({
    mutationFn: (input: Parameters<typeof ordersApi.update>[1]) => ordersApi.update(id, input),
    invalidate: [['orders']],
    successMessage: t('costs.orderUpdated'),
  });
  const remove = useApiMutation({
    mutationFn: () => ordersApi.remove(id),
    invalidate: [['orders']],
    successMessage: t('costs.orderDeletedSuccess'),
    onSuccess: () => router.back(),
  });

  if (order.isLoading) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (order.isError || !order.data) {
    return (
      <Screen>
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </Screen>
    );
  }

  const o = order.data;
  const statusOptions: Option[] = ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel(t, s) }));
  const itemsTotal = o.items.reduce((sum, it) => sum + toNumber(it.totalPrice), 0);

  return (
    <Screen refreshing={order.isRefetching} onRefresh={() => order.refetch()}>
      <Stack.Screen options={{ title: o.orderNumber }} />
      <AppCard style={{ gap: spacing.sm }}>
        <StatusBadge label={orderStatusLabel(t, o.status)} tone={orderStatusTone(o.status)} />
        <AppText variant="heading">{o.orderNumber}</AppText>
        <AppText variant="display">{formatCurrency(toNumber(o.totalAmount), locale)}</AppText>
        <AppText variant="caption">{t('costs.totalTaxIncluded')}</AppText>
      </AppCard>

      {canEdit ? (
      <AppCard style={{ gap: spacing.lg }}>
        <SectionHeader title={t('costs.editOrder')} />
        <SelectField
          label={t('costs.status')}
          value={o.status}
          options={statusOptions}
          onChange={(v) => v && v !== o.status && update.mutate({ status: v })}
          disabled={update.isPending}
        />
        <DateField label={t('costs.orderDate')} value={o.orderDate ? o.orderDate.slice(0, 10) : null} onChange={(v) => update.mutate({ orderDate: v })} />
        <DateField
          label={t('costs.expectedDelivery')}
          value={o.expectedDelivery ? o.expectedDelivery.slice(0, 10) : null}
          onChange={(v) => update.mutate({ expectedDelivery: v })}
        />
      </AppCard>
      ) : (
        <AppCard style={{ gap: spacing.xs }}>
          <KeyValue icon="calendar-outline" label={t('costs.orderDate')} value={formatDate(o.orderDate, locale)} />
          <KeyValue icon="time-outline" label={t('costs.expectedDelivery')} value={formatDate(o.expectedDelivery, locale)} />
        </AppCard>
      )}

      <AppCard style={{ gap: spacing.xs }}>
        <SectionHeader title={t('costs.supplierInfoTitle')} />
        <KeyValue label={t('costs.supplier')} value={o.supplier?.name ?? t('costs.notSpecified')} />
        <KeyValue label={t('costs.contactPerson')} value={o.supplier?.contactPerson ?? '—'} />
        <KeyValue label={t('costs.supplierPhone')} value={o.supplier?.phone ?? '—'} />
        <KeyValue label={t('costs.supplierEmail')} value={o.supplier?.email ?? '—'} />
        <KeyValue label={t('costs.requester')} value={fullName(o.createdBy) || t('costs.requesterNotAvailable')} />
        <KeyValue label={t('costs.actualDelivery')} value={formatDate(o.actualDelivery, locale)} />
        <KeyValue label={t('costs.lastUpdated')} value={formatDateTime(o.updatedAt, locale)} />
      </AppCard>

      <View>
        <SectionHeader title={`${t('costs.orderItems')} (${o.items.length})`} />
        {o.items.length === 0 ? (
          <AppText variant="small">{t('costs.noOrderItems')}</AppText>
        ) : (
          <ListGroup>
            {o.items.map((it) => (
              <ListRow
                key={it.id}
                title={it.material?.name ?? '—'}
                subtitle={`${formatNumber(toNumber(it.quantity), locale)} ${it.material?.unit ?? ''} × ${formatCurrency(toNumber(it.unitPrice), locale)}`}
                right={<AppText variant="bodyStrong">{formatCurrency(toNumber(it.totalPrice), locale)}</AppText>}
              />
            ))}
            <ListRow title={t('costs.total')} right={<AppText variant="title">{formatCurrency(itemsTotal, locale)}</AppText>} />
          </ListGroup>
        )}
      </View>

      {canEdit ? (
        <AppButton
          title={t('common.delete')}
          icon="trash-outline"
          variant="danger"
          loading={remove.isPending}
          onPress={async () => {
            if (await confirm({ message: t('costs.deleteOrderConfirm') })) remove.mutate();
          }}
        />
      ) : null}
    </Screen>
  );
}
