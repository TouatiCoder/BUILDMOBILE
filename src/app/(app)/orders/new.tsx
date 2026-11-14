import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { inventoryApi, ordersApi } from '@/api/endpoints';
import type { InventoryMaterial } from '@/api/types';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { AppInput, DateField, SelectField } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, SectionHeader, StatusBadge } from '@/components/primitives';
import { useApiMutation } from '@/hooks/common';
import { useActiveSuppliers } from '@/hooks/useActiveSuppliers';
import { useI18n } from '@/i18n/I18nProvider';
import type { Locale } from '@/i18n/locale';
import { formatCurrency, formatNumber, parseDecimalInput, toIsoDate, toNumber } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

type OrderLineDraft = { material: InventoryMaterial; quantity: string; unitPrice: string };

const tr = (locale: Locale, fr: string, en: string, ar: string) => (locale === 'ar' ? ar : locale === 'en' ? en : fr);

const sanitizeDecimal = (value: string) => value.replace(',', '.').replace(/[^0-9.]/g, '');

/**
 * New purchase order, mirroring the website's /costs/orders/new:
 * - choosing a supplier restricts the material list to that supplier's materials;
 * - choosing a material immediately adds an editable line (quantity, unit price
 *   prefilled from the material, line total) with stock per warehouse as info.
 * An order is a supply request: requested quantities are not limited by stock.
 */
export default function NewOrderScreen() {
  const { t, locale } = useI18n();
  const { suppliers, withActiveSupplier } = useActiveSuppliers();
  const materials = useQuery({ queryKey: ['inventory', 'materials', 'purchase-order'], queryFn: () => inventoryApi.materials({}) });
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState<string | null>(toIsoDate(new Date()));
  const [expectedDelivery, setExpectedDelivery] = useState<string | null>(null);
  const [lines, setLines] = useState<OrderLineDraft[]>([]);
  const [error, setError] = useState<string | undefined>();

  const create = useApiMutation({
    mutationFn: ordersApi.create,
    invalidate: [['orders']],
    successMessage: t('costs.success'),
    onSuccess: (order) => router.replace({ pathname: '/orders/[id]', params: { id: order.id } }),
  });

  const supplierMaterials = useMemo(() => {
    if (!supplierId) return [];
    return (materials.data ?? []).map(withActiveSupplier).filter((m) => m.supplierId === supplierId);
  }, [materials.data, supplierId, withActiveSupplier]);

  const availableMaterials = supplierMaterials.filter((m) => !lines.some((line) => line.material.id === m.id));

  const addMaterial = (materialId: string | null) => {
    const material = supplierMaterials.find((item) => item.id === materialId);
    if (!material) return;
    setError(undefined);
    setLines((current) => current.some((line) => line.material.id === material.id)
      ? current
      : [...current, { material, quantity: '1', unitPrice: String(toNumber(material.unitPrice) || '') }]);
  };

  const updateLine = (materialId: string, patch: Partial<Pick<OrderLineDraft, 'quantity' | 'unitPrice'>>) =>
    setLines((current) => current.map((line) => (line.material.id === materialId ? { ...line, ...patch } : line)));

  const lineQuantity = (line: OrderLineDraft) => parseDecimalInput(line.quantity) ?? 0;
  const linePrice = (line: OrderLineDraft) => parseDecimalInput(line.unitPrice) ?? 0;
  const lineTotal = (line: OrderLineDraft) => {
    const total = lineQuantity(line) * linePrice(line);
    return Number.isFinite(total) ? total : 0;
  };
  const orderTotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  const submit = () => {
    if (!supplierId) {
      setError(t('costs.supplierRequired'));
      return;
    }
    if (lines.length === 0) {
      setError(tr(locale, 'Ajoutez au moins un matériau.', 'Add at least one material.', 'اختار مادة واحدة على الأقل.'));
      return;
    }
    const invalid = lines.find((line) => !(lineQuantity(line) > 0) || !(linePrice(line) > 0));
    if (invalid) {
      setError(tr(
        locale,
        `Quantité et prix unitaire doivent être supérieurs à 0 (${invalid.material.name}).`,
        `Quantity and unit price must be greater than 0 (${invalid.material.name}).`,
        `الكمية والثمن يجب أن يكونا أكبر من 0 (${invalid.material.name}).`,
      ));
      return;
    }
    setError(undefined);
    create.mutate({
      supplierId,
      orderDate,
      expectedDelivery,
      items: lines.map((line) => ({
        material_id: line.material.id,
        quantity: lineQuantity(line),
        unit_price: linePrice(line),
      })),
    });
  };

  const stockRows = (material: InventoryMaterial) => {
    const byWarehouse = new Map<string, { name: string; quantity: number }>();
    for (const row of material.inventory) {
      const key = row.warehouseId ?? '__none__';
      const name = row.warehouse?.name ?? t('inventory.noWarehouse');
      const entry = byWarehouse.get(key) ?? { name, quantity: 0 };
      entry.quantity += toNumber(row.quantity);
      byWarehouse.set(key, entry);
    }
    return [...byWarehouse.values()].filter((row) => row.quantity !== 0);
  };

  return (
    <Screen keyboard footer={<AppButton title={t('costs.createOrderButton')} onPress={submit} loading={create.isPending} disabled={create.isPending} />}>
      <Stack.Screen options={{ title: t('costs.newOrderTitle') }} />
      {suppliers.isError ? <ErrorState error={suppliers.error} onRetry={() => suppliers.refetch()} /> : null}
      {materials.isError ? <ErrorState error={materials.error} onRetry={() => materials.refetch()} /> : null}
      <AppCard style={{ gap: spacing.lg }}>
        <SelectField
          label={t('costs.supplierLabel')}
          required
          value={supplierId}
          options={(suppliers.data ?? []).filter((s) => s.isActive !== false).map((s) => ({ value: s.id, label: s.name }))}
          onChange={(value) => {
            // Materials are tied to the supplier: changing it resets the lines.
            if (value !== supplierId) setLines([]);
            setSupplierId(value);
            setError(undefined);
          }}
          placeholder={t('costs.selectSupplier')}
          searchable
        />
        <DateField label={t('costs.orderDate')} value={orderDate} onChange={setOrderDate} />
        <DateField label={t('costs.expectedDeliveryDate')} value={expectedDelivery} onChange={setExpectedDelivery} />
      </AppCard>

      <AppCard style={{ gap: spacing.md }}>
        <SectionHeader
          title={tr(locale, 'Matériaux à commander', 'Materials to order', 'المواد المطلوبة')}
          subtitle={tr(
            locale,
            'Matériaux associés au fournisseur sélectionné',
            'Materials linked to the selected supplier',
            'المواد المرتبطة بالمورد المختار',
          )}
        />
        {materials.isLoading ? <ListSkeleton rows={3} /> : (
          <>
            <SelectField
              label={tr(locale, 'Ajouter un matériau', 'Add a material', 'إضافة مادة')}
              value={null}
              options={availableMaterials.map((material) => ({
                value: material.id,
                label: material.name,
                description: `${formatCurrency(toNumber(material.unitPrice), locale)} / ${material.unit || '—'}`,
              }))}
              onChange={addMaterial}
              placeholder={supplierId
                ? tr(locale, 'Sélectionner un matériau', 'Select a material', 'اختار مادة')
                : tr(locale, "Choisissez d'abord un fournisseur", 'Choose a supplier first', 'اختار المورد أولاً')}
              searchable
              disabled={!supplierId || availableMaterials.length === 0}
            />
            {supplierId && supplierMaterials.length === 0 ? (
              <AppText variant="small" color="warning">
                {tr(
                  locale,
                  "Aucun matériau n'est associé à ce fournisseur. Associez-le depuis la fiche matériau (Modifier → Fournisseur).",
                  'No material is linked to this supplier. Link one from the material sheet (Edit → Supplier).',
                  'ما كاين حتى مادة مرتبطة بهذا المورد. اربطها من صفحة المادة (تعديل ← المورد).',
                )}
              </AppText>
            ) : null}
          </>
        )}
        {lines.length === 0 ? (
          <AppText variant="small">{tr(locale, 'Aucun matériau ajouté pour le moment.', 'No materials added yet.', 'مازال ما ضفتي حتى مادة.')}</AppText>
        ) : lines.map((line) => {
          const unit = line.material.unit || '';
          const rows = stockRows(line.material);
          const stock = rows.reduce((sum, row) => sum + row.quantity, 0);
          const min = line.material.inventory.length ? Math.max(0, ...line.material.inventory.map((r) => toNumber(r.minThreshold))) : 0;
          const belowMin = min > 0 && stock <= min;
          return (
            <View key={line.material.id} style={{ gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText variant="bodyStrong">{line.material.name}</AppText>
                  <AppText variant="caption">{tr(locale, 'Unité', 'Unit', 'الوحدة')}: {unit || '—'}</AppText>
                </View>
                <AppButton
                  title={tr(locale, 'Retirer', 'Remove', 'حذف')}
                  variant="ghost"
                  size="sm"
                  onPress={() => setLines((current) => current.filter((item) => item.material.id !== line.material.id))}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <AppInput
                    label={`${tr(locale, 'Quantité', 'Quantity', 'الكمية')}${unit ? ` (${unit})` : ''}`}
                    value={line.quantity}
                    onChangeText={(value) => updateLine(line.material.id, { quantity: sanitizeDecimal(value) })}
                    keyboardType="decimal-pad"
                    required
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput
                    label={`${tr(locale, 'Prix unitaire', 'Unit price', 'ثمن الوحدة')} (MAD)`}
                    value={line.unitPrice}
                    onChangeText={(value) => updateLine(line.material.id, { unitPrice: sanitizeDecimal(value) })}
                    keyboardType="decimal-pad"
                    required
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <AppText variant="small">{tr(locale, 'Total ligne', 'Line total', 'مجموع السطر')}</AppText>
                <AppText variant="bodyStrong">{formatCurrency(lineTotal(line), locale)}</AppText>
              </View>
              <View style={{ gap: 2 }}>
                <AppText variant="caption">{tr(locale, 'Stock actuel par dépôt', 'Current stock by warehouse', 'المخزون الحالي حسب المستودع')}</AppText>
                {rows.length === 0 ? (
                  <AppText variant="small">{`0 ${unit}`.trim()}</AppText>
                ) : rows.map((row) => (
                  <View key={row.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                    <AppText variant="small">{row.name}</AppText>
                    <AppText variant="small">{`${formatNumber(row.quantity, locale)} ${unit}`.trim()}</AppText>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                  <AppText variant="bodyStrong">Total</AppText>
                  <AppText variant="bodyStrong">{`${formatNumber(stock, locale)} ${unit}`.trim()}</AppText>
                </View>
              </View>
              {belowMin ? (
                <View style={{ alignItems: 'flex-start' }}>
                  <StatusBadge
                    label={tr(locale, 'Sous le seuil minimum', 'Below minimum threshold', 'تحت الحد الأدنى')}
                    tone="warning"
                  />
                </View>
              ) : null}
            </View>
          );
        })}
        {lines.length > 0 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            <AppText variant="title">{t('costs.total')}</AppText>
            <AppText variant="title">{formatCurrency(orderTotal, locale)}</AppText>
          </View>
        ) : null}
      </AppCard>
      {error ? <AppCard><AppText color={colors.danger}>{error}</AppText></AppCard> : null}
    </Screen>
  );
}
