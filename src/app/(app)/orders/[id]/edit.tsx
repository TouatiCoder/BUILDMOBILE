import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { inventoryApi, ordersApi } from '@/api/endpoints';
import type { PurchaseOrderDetail } from '@/api/types';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { DateField, SelectField, type Option } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, SectionHeader } from '@/components/primitives';
import {
  AddArticleFab,
  emptyOrderLine,
  OrderLinesEditor,
  orderLinePrice,
  orderLineQuantity,
  validateOrderLines,
  type OrderLineDraft,
} from '@/features/orders/OrderLinesEditor';
import { useApiMutation, usePermissions } from '@/hooks/common';
import { useActiveSuppliers } from '@/hooks/useActiveSuppliers';
import { useI18n } from '@/i18n/I18nProvider';
import { toNumber } from '@/lib/format';
import { orderStatusLabel, ORDER_STATUSES } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

/**
 * Edit a purchase order: header through PATCH /api/purchase-orders/[id]
 * (status, dates) and lines through PUT /api/purchase-orders/[id]/items
 * (articles: add with +, choose the material, quantity, unit price, remove).
 */
export default function EditOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const order = useQuery({ queryKey: ['orders', 'detail', id], queryFn: () => ordersApi.get(id) });
  const title = locale === 'ar' ? 'تعديل الطلب' : locale === 'en' ? 'Edit order' : 'Modifier la commande';

  if (order.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (order.isError || !order.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </Screen>
    );
  }

  return <EditOrderForm key={order.data.id} order={order.data} title={title} />;
}

function EditOrderForm({ order: o, title }: { order: PurchaseOrderDetail; title: string }) {
  const { t, locale } = useI18n();
  const { allows } = usePermissions();
  const canEdit = allows('orders.edit');
  const tr = (fr: string, en: string, ar: string) => (locale === 'ar' ? ar : locale === 'en' ? en : fr);
  const { withActiveSupplier } = useActiveSuppliers();
  const materials = useQuery({ queryKey: ['inventory', 'materials', 'purchase-order'], queryFn: () => inventoryApi.materials({}) });

  // Lines whose material no longer exists cannot be re-sent to the server.
  const [initialLines] = useState<OrderLineDraft[]>(() => o.items.filter((it) => it.material?.id).map((it) => ({
    key: it.id,
    materialId: it.material!.id,
    name: it.material?.name ?? '—',
    unit: it.material?.unit ?? '',
    quantity: String(toNumber(it.quantity)),
    unitPrice: String(toNumber(it.unitPrice)),
  })));
  const [status, setStatus] = useState<string | null>(o.status);
  const [orderDate, setOrderDate] = useState<string | null>(o.orderDate ? o.orderDate.slice(0, 10) : null);
  const [expectedDelivery, setExpectedDelivery] = useState<string | null>(o.expectedDelivery ? o.expectedDelivery.slice(0, 10) : null);
  const [lines, setLines] = useState<OrderLineDraft[]>(initialLines);
  const [error, setError] = useState<string | undefined>();

  const supplierMaterials = (materials.data ?? []).map(withActiveSupplier).filter((m) => m.supplierId === o.supplierId);
  const canAddArticle = canEdit && supplierMaterials.some((m) => !lines.some((line) => line.materialId === m.id));

  const signature = (items: OrderLineDraft[]) =>
    JSON.stringify(items.map((l) => [l.materialId, orderLineQuantity(l), orderLinePrice(l)]));
  const linesChanged = signature(lines) !== signature(initialLines);

  const save = useApiMutation({
    mutationFn: async () => {
      await ordersApi.update(o.id, { status: status ?? undefined, orderDate, expectedDelivery });
      if (linesChanged) {
        await ordersApi.replaceItems(
          o.id,
          lines.map((line) => ({ material_id: line.materialId!, quantity: orderLineQuantity(line), unit_price: orderLinePrice(line) })),
        );
      }
    },
    invalidate: [['orders']],
    successMessage: t('costs.orderUpdated'),
    onSuccess: () => router.back(),
  });

  const submit = () => {
    const invalid = validateOrderLines(lines, tr);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(undefined);
    save.mutate();
  };

  const statusOptions: Option[] = ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel(t, s) }));

  return (
    <Screen
      keyboard
      footer={canEdit ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <AddArticleFab
            label={tr('Ajouter un article', 'Add an article', 'زيد سلعة')}
            onPress={() => { setError(undefined); setLines((current) => [...current, emptyOrderLine()]); }}
            disabled={!canAddArticle}
          />
          <View style={{ flex: 1 }}>
            <AppButton title={t('common.save')} onPress={submit} loading={save.isPending} disabled={save.isPending} />
          </View>
        </View>
      ) : undefined}>
      <Stack.Screen options={{ title }} />
      <AppCard style={{ gap: spacing.lg }}>
        <AppText variant="heading">{o.orderNumber}</AppText>
        <SelectField label={t('costs.status')} value={status} options={statusOptions} onChange={setStatus} disabled={!canEdit} />
        <DateField label={t('costs.orderDate')} value={orderDate} onChange={setOrderDate} />
        <DateField label={t('costs.expectedDelivery')} value={expectedDelivery} onChange={setExpectedDelivery} />
      </AppCard>

      <AppCard style={{ gap: spacing.md }}>
        <SectionHeader
          title={`${t('costs.orderItems')} (${lines.length})`}
          subtitle={canEdit ? tr(
            'Appuyez sur + pour ajouter un article, puis choisissez le matériau.',
            'Tap + to add an article, then choose its material.',
            'اضغط على + باش تزيد سلعة، ومن بعد اختار المادة.',
          ) : undefined}
        />
        {materials.isLoading ? (
          <ListSkeleton rows={2} />
        ) : (
          <OrderLinesEditor
            lines={lines}
            onChange={(next) => { setError(undefined); setLines(next); }}
            supplierMaterials={supplierMaterials}
            editable={canEdit}
          />
        )}
      </AppCard>
      {error ? <AppCard><AppText color={colors.danger}>{error}</AppText></AppCard> : null}
    </Screen>
  );
}
