import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { inventoryApi, materialsApi } from '@/api/endpoints';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { ListGroup, ListRow, Screen, StatCard, StatGrid } from '@/components/layout';
import { AppText, StatusBadge, AppButton, AppCard, KeyValue, SectionHeader } from '@/components/primitives';
import { useApiMutation, useConfirm, usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatNumber, toNumber } from '@/lib/format';
import { aggregateStock } from '@/lib/inventory';
import { stockState, stockStateLabel, stockStateTone } from '@/lib/labels';
import { spacing } from '@/theme/tokens';

export default function MaterialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const confirm = useConfirm();

  const material = useQuery({ queryKey: ['inventory', 'material', id], queryFn: () => materialsApi.get(id) });
  // GET /api/materials/[id] only includes the latest inventory row; the inventory
  // list carries every warehouse row for this material.
  const allMaterials = useQuery({ queryKey: ['inventory', 'materials', { all: true }], queryFn: () => inventoryApi.materials({}) });
  const rows = allMaterials.data?.find((m) => m.id === id)?.inventory ?? material.data?.inventory ?? [];

  const remove = useApiMutation({
    mutationFn: () => materialsApi.remove(id),
    invalidate: [['inventory']],
    successMessage: t('common.success'),
    onSuccess: () => router.back(),
  });

  if (material.isLoading) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (material.isError || !material.data) {
    return (
      <Screen>
        <ErrorState error={material.error} onRetry={() => material.refetch()} />
      </Screen>
    );
  }

  const m = material.data;
  const s = aggregateStock(rows);
  const state = stockState(s.quantity, s.minThreshold, s.maxThreshold);
  const unitPrice = toNumber(m.unitPrice);

  return (
    <Screen refreshing={material.isRefetching} onRefresh={() => {
      void material.refetch();
      void allMaterials.refetch();
    }}>
      <Stack.Screen options={{ title: m.name }} />
      <AppCard style={{ gap: spacing.sm }}>
        <StatusBadge label={stockStateLabel(t, state)} tone={stockStateTone(state)} />
        <AppText variant="heading">{m.name}</AppText>
        {m.description ? <AppText variant="small">{m.description}</AppText> : null}
      </AppCard>

      <StatGrid>
        <StatCard icon="cube-outline" label={t('inventory.availableStock')} value={`${formatNumber(s.quantity, locale)} ${m.unit}`} tone={stockStateTone(state)} />
        <StatCard icon="cash-outline" label={t('inventory.stockValue')} value={formatCurrency(s.quantity * unitPrice, locale)} tone="violet" />
      </StatGrid>

      <AppCard style={{ gap: spacing.xs }}>
        <KeyValue label={t('inventory.category')} value={m.category ?? t('inventory.uncategorized')} />
        <KeyValue label={t('inventory.unit')} value={m.unit} />
        <KeyValue label={t('inventory.unitPrice')} value={formatCurrency(unitPrice, locale)} />
        <KeyValue label={t('inventory.supplier')} value={m.supplier?.name ?? t('inventory.noSupplier')} />
        <KeyValue label={t('inventory.minThreshold')} value={formatNumber(s.minThreshold, locale)} />
        <KeyValue label={t('inventory.maxStockLabel')} value={s.maxThreshold != null ? formatNumber(s.maxThreshold, locale) : '—'} />
      </AppCard>

      <View>
        <SectionHeader title={t('inventory.byWarehouse')} />
        <ListGroup>
          {rows.length === 0 ? (
            <ListRow title={t('inventory.noMaterialsFound')} />
          ) : (
            rows.map((r) => (
              <ListRow
                key={r.id}
                icon="business-outline"
                title={r.warehouse?.name ?? t('inventory.noWarehouse')}
                right={<AppText variant="bodyStrong">{`${formatNumber(toNumber(r.quantity), locale)} ${m.unit}`}</AppText>}
              />
            ))
          )}
        </ListGroup>
      </View>

      {can('manage_inventory') ? (
        <View style={{ gap: spacing.sm }}>
          <AppButton
            title={t('inventory.stockEntry')}
            icon="add-circle-outline"
            onPress={() => router.push({ pathname: '/inventory/operation', params: { mode: 'entry', materialId: id } })}
          />
          <AppButton
            title={t('inventory.stockTransfer')}
            icon="swap-horizontal-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: '/inventory/operation', params: { mode: 'transfer', materialId: id } })}
          />
          <AppButton title={t('inventory.actionEdit')} icon="create-outline" variant="secondary" onPress={() => router.push({ pathname: '/materials/[id]/edit', params: { id } })} />
          <AppButton
            title={t('inventory.actionDelete')}
            icon="trash-outline"
            variant="danger"
            loading={remove.isPending}
            onPress={async () => {
              if (await confirm({ message: `${m.name}\n${t('common.deleteIrreversible')}` })) remove.mutate();
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}
