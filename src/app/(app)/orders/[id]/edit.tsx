import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { inventoryApi, ordersApi } from '@/api/endpoints';
import type { PurchaseOrderDetail } from '@/api/types';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { AppInput, DateField, SelectField, type Option } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, SectionHeader } from '@/components/primitives';
import { useApiMutation, usePermissions } from '@/hooks/common';
import { useActiveSuppliers } from '@/hooks/useActiveSuppliers';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, parseDecimalInput, toNumber } from '@/lib/format';
import { orderStatusLabel, ORDER_STATUSES } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

/**
 * Edit a purchase order: header through PATCH /api/purchase-orders/[id]
 * (status, dates) and lines through PUT /api/purchase-orders/[id]/items
 * (quantity, unit price, add/remove materials of the order's supplier).
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

type LineDraft = { materialId: string; name: string; unit: string; quantity: string; unitPrice: string };

const sanitizeDecimal = (value: string) => value.replace(',', '.').replace(/[^0-9.]/g, '');

function EditOrderForm({ order: o, title }: { order: PurchaseOrderDetail; title: string }) {
  const { t, locale } = useI18n();
  const { allows } = usePermissions();
  const canEdit = allows('orders.edit');
  const tr = (fr: string, en: string, ar: string) => (locale === 'ar' ? ar : locale === 'en' ? en : fr);
  const { withActiveSupplier } = useActiveSuppliers();
  const materials = useQuery({ queryKey: ['inventory', 'materials', 'purchase-order'], queryFn: () => inventoryApi.materials({}) });

  // Lines whose material no longer exists cannot be re-sent to the server.
  const [initialLines] = useState<LineDraft[]>(() => o.items.filter((it) => it.material?.id).map((it) => ({
    materialId: it.material!.id,
    name: it.material?.name ?? '—',
    unit: it.material?.unit ?? '',
    quantity: String(toNumber(it.quantity)),
    unitPrice: String(toNumber(it.unitPrice)),
  })));
  const [status, setStatus] = useState<string | null>(o.status);
  const [orderDate, setOrderDate] = useState<string | null>(o.orderDate ? o.orderDate.slice(0, 10) : null);
  const [expectedDelivery, setExpectedDelivery] = useState<string | null>(o.expectedDelivery ? o.expectedDelivery.slice(0, 10) : null);
  const [lines, setLines] = useState<LineDraft[]>(initialLines);
  const [error, setError] = useState<string | undefined>();

  const supplierMaterials = (materials.data ?? [])
    .map(withActiveSupplier)
    .filter((m) => m.supplierId === o.supplierId && !lines.some((line) => line.materialId === m.id));

  const qty = (line: LineDraft) => parseDecimalInput(line.quantity) ?? 0;
  const price = (line: LineDraft) => parseDecimalInput(line.unitPrice) ?? 0;
  const lineTotal = (line: LineDraft) => {
    const value = qty(line) * price(line);
    return Number.isFinite(value) ? value : 0;
  };
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const updateLine = (materialId: string, patch: Partial<Pick<LineDraft, 'quantity' | 'unitPrice'>>) =>
    setLines((current) => current.map((line) => (line.materialId === materialId ? { ...line, ...patch } : line)));

  const signature = (items: LineDraft[]) => JSON.stringify(items.map((l) => [l.materialId, qty(l), price(l)]));
  const linesChanged = signature(lines) !== signature(initialLines);

  const save = useApiMutation({
    mutationFn: async () => {
      await ordersApi.update(o.id, { status: status ?? undefined, orderDate, expectedDelivery });
      if (linesChanged) {
        await ordersApi.replaceItems(o.id, lines.map((line) => ({ material_id: line.materialId, quantity: qty(line), unit_price: price(line) })));
      }
    },
    invalidate: [['orders']],
    successMessage: t('costs.orderUpdated'),
    onSuccess: () => router.back(),
  });

  const submit = () => {
    if (lines.length === 0) {
      setError(tr('Ajoutez au moins un matériau.', 'Add at least one material.', 'اختار مادة واحدة على الأقل.'));
      return;
    }
    const invalid = lines.find((line) => !(qty(line) > 0) || !(price(line) > 0));
    if (invalid) {
      setError(tr(
        `Quantité et prix unitaire doivent être supérieurs à 0 (${invalid.name}).`,
        `Quantity and unit price must be greater than 0 (${invalid.name}).`,
        `الكمية والثمن يجب أن يكونا أكبر من 0 (${invalid.name}).`,
      ));
      return;
    }
    setError(undefined);
    save.mutate();
  };

  const statusOptions: Option[] = ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel(t, s) }));

  return (
    <Screen
      keyboard
      footer={canEdit ? <AppButton title={t('common.save')} onPress={submit} loading={save.isPending} disabled={save.isPending} /> : undefined}>
      <Stack.Screen options={{ title }} />
      <AppCard style={{ gap: spacing.lg }}>
        <AppText variant="heading">{o.orderNumber}</AppText>
        <SelectField label={t('costs.status')} value={status} options={statusOptions} onChange={setStatus} disabled={!canEdit} />
        <DateField label={t('costs.orderDate')} value={orderDate} onChange={setOrderDate} />
        <DateField label={t('costs.expectedDelivery')} value={expectedDelivery} onChange={setExpectedDelivery} />
      </AppCard>

      <AppCard style={{ gap: spacing.md }}>
        <SectionHeader title={`${t('costs.orderItems')} (${lines.length})`} />
        <SelectField
          label={tr('Ajouter un matériau', 'Add a material', 'إضافة مادة')}
          value={null}
          options={supplierMaterials.map((m) => ({
            value: m.id,
            label: m.name,
            description: `${formatCurrency(toNumber(m.unitPrice), locale)} / ${m.unit || '—'}`,
          }))}
          onChange={(materialId) => {
            const m = supplierMaterials.find((item) => item.id === materialId);
            if (!m) return;
            setLines((current) => [...current, { materialId: m.id, name: m.name, unit: m.unit, quantity: '1', unitPrice: String(toNumber(m.unitPrice) || '') }]);
          }}
          placeholder={tr('Sélectionner un matériau', 'Select a material', 'اختار مادة')}
          searchable
          disabled={!canEdit || supplierMaterials.length === 0}
        />
        {lines.map((line) => (
          <View key={line.materialId} style={{ gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>{line.name}</AppText>
              {canEdit ? (
                <AppButton
                  title={tr('Retirer', 'Remove', 'حذف')}
                  variant="ghost"
                  size="sm"
                  onPress={() => setLines((current) => current.filter((item) => item.materialId !== line.materialId))}
                />
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label={`${tr('Quantité', 'Quantity', 'الكمية')}${line.unit ? ` (${line.unit})` : ''}`}
                  value={line.quantity}
                  onChangeText={(value) => updateLine(line.materialId, { quantity: sanitizeDecimal(value) })}
                  keyboardType="decimal-pad"
                  editable={canEdit}
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label={`${tr('Prix unitaire', 'Unit price', 'ثمن الوحدة')} (MAD)`}
                  value={line.unitPrice}
                  onChangeText={(value) => updateLine(line.materialId, { unitPrice: sanitizeDecimal(value) })}
                  keyboardType="decimal-pad"
                  editable={canEdit}
                  required
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <AppText variant="small">{tr('Total ligne', 'Line total', 'مجموع السطر')}</AppText>
              <AppText variant="bodyStrong">{formatCurrency(lineTotal(line), locale)}</AppText>
            </View>
          </View>
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <AppText variant="title">{t('costs.total')}</AppText>
          <AppText variant="title">{formatCurrency(total, locale)}</AppText>
        </View>
      </AppCard>
      {error ? <AppCard><AppText color={colors.danger}>{error}</AppText></AppCard> : null}
    </Screen>
  );
}
