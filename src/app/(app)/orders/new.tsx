import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { inventoryApi, ordersApi } from '@/api/endpoints';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { DateField, SelectField } from '@/components/fields';
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
import { useApiMutation } from '@/hooks/common';
import { useActiveSuppliers } from '@/hooks/useActiveSuppliers';
import { useI18n } from '@/i18n/I18nProvider';
import { toIsoDate } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

/**
 * New purchase order, mirroring the website's /costs/orders/new: choose the
 * supplier, then add articles with the "+" button and pick each article's
 * material among that supplier's materials. An order is a supply request:
 * requested quantities are not limited by stock.
 */
export default function NewOrderScreen() {
  const { t, locale } = useI18n();
  const tr = (fr: string, en: string, ar: string) => (locale === 'ar' ? ar : locale === 'en' ? en : fr);
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

  const canAddArticle = !!supplierId && supplierMaterials.some((m) => !lines.some((line) => line.materialId === m.id));
  const addArticle = () => {
    setError(undefined);
    setLines((current) => [...current, emptyOrderLine()]);
  };

  const submit = () => {
    if (!supplierId) {
      setError(t('costs.supplierRequired'));
      return;
    }
    const invalid = validateOrderLines(lines, tr);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(undefined);
    create.mutate({
      supplierId,
      orderDate,
      expectedDelivery,
      items: lines.map((line) => ({
        material_id: line.materialId!,
        quantity: orderLineQuantity(line),
        unit_price: orderLinePrice(line),
      })),
    });
  };

  return (
    <Screen
      keyboard
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <AddArticleFab label={tr('Ajouter un article', 'Add an article', 'زيد سلعة')} onPress={addArticle} disabled={!canAddArticle} />
          <View style={{ flex: 1 }}>
            <AppButton title={t('costs.createOrderButton')} onPress={submit} loading={create.isPending} disabled={create.isPending} />
          </View>
        </View>
      }>
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
            // Materials are tied to the supplier: changing it starts again with one empty article.
            if (value !== supplierId) setLines(value ? [emptyOrderLine()] : []);
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
          title={tr('Articles de la commande', 'Order articles', 'سلع الطلب')}
          subtitle={tr(
            'Appuyez sur + pour ajouter un article, puis choisissez le matériau.',
            'Tap + to add an article, then choose its material.',
            'اضغط على + باش تزيد سلعة، ومن بعد اختار المادة.',
          )}
        />
        {!supplierId ? (
          <AppText variant="small">{tr("Choisissez d'abord un fournisseur.", 'Choose a supplier first.', 'اختار المورد أولاً.')}</AppText>
        ) : materials.isLoading ? (
          <ListSkeleton rows={2} />
        ) : supplierMaterials.length === 0 ? (
          <AppText variant="small" color="warning">
            {tr(
              "Aucun matériau n'est associé à ce fournisseur. Associez-le depuis la fiche matériau (Modifier → Fournisseur).",
              'No material is linked to this supplier. Link one from the material sheet (Edit → Supplier).',
              'ما كاين حتى مادة مرتبطة بهذا المورد. اربطها من صفحة المادة (تعديل ← المورد).',
            )}
          </AppText>
        ) : (
          <OrderLinesEditor lines={lines} onChange={(next) => { setError(undefined); setLines(next); }} supplierMaterials={supplierMaterials} />
        )}
      </AppCard>
      {error ? <AppCard><AppText color={colors.danger}>{error}</AppText></AppCard> : null}
    </Screen>
  );
}
