import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { inventoryApi, ordersApi, suppliersApi } from '@/api/endpoints';
import type { InventoryMaterial } from '@/api/types';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { AppInput, DateField, SelectField } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, SectionHeader, StatusBadge } from '@/components/primitives';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatNumber, toIsoDate, toNumber } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

type OrderLineDraft = { material: InventoryMaterial; quantity: string };

export default function NewOrderScreen() {
  const { t, locale } = useI18n();
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const materials = useQuery({ queryKey: ['inventory', 'materials', 'purchase-order'], queryFn: () => inventoryApi.materials({}) });
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState<string | null>(toIsoDate(new Date()));
  const [expectedDelivery, setExpectedDelivery] = useState<string | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [lines, setLines] = useState<OrderLineDraft[]>([]);
  const [error, setError] = useState<string | undefined>();

  const supplierMaterials = useMemo(() => {
    const all = materials.data ?? [];
    // Show supplier-associated materials first, while still allowing materials
    // without a supplier association to be ordered from the chosen supplier.
    return supplierId ? [...all].sort((a, b) => Number(b.supplierId === supplierId) - Number(a.supplierId === supplierId)) : all;
  }, [materials.data, supplierId]);

  const create = useApiMutation({
    mutationFn: ordersApi.create,
    invalidate: [['orders']],
    successMessage: t('costs.success'),
    onSuccess: (order) => router.replace({ pathname: '/orders/[id]', params: { id: order.id } }),
  });

  const addMaterial = () => {
    if (!selectedMaterialId) return;
    const material = supplierMaterials.find((item) => item.id === selectedMaterialId);
    if (!material) return;
    setLines((current) => current.some((line) => line.material.id === material.id)
      ? current
      : [...current, { material, quantity: '1' }]);
    setSelectedMaterialId(null);
  };

  const submit = () => {
    if (!supplierId) {
      setError(t('costs.supplierRequired'));
      return;
    }
    if (lines.length === 0) {
      setError(locale === 'ar' ? 'اختار مادة واحدة على الأقل.' : locale === 'en' ? 'Add at least one material.' : 'Ajoutez au moins un matériau.');
      return;
    }
    // Existing API creates only the purchase-order header. Line items are
    // managed by a website server action and have no mobile HTTP endpoint.
    // Never create an empty order while presenting unsaved line drafts.
    setError(locale === 'ar'
      ? 'اختيار المواد وحساب المخزون جاهز، ولكن حفظ تفاصيل المواد يحتاج endpoint في الخادم غير متوفر حالياً. لم يتم إنشاء الطلب.'
      : locale === 'en'
        ? 'Materials and stock checks are ready, but saving order lines requires a backend endpoint that is not currently available. The order was not created.'
        : "Les matériaux et contrôles de stock sont prêts, mais l'enregistrement des lignes nécessite un endpoint backend indisponible. La commande n'a pas été créée.");
  };

  const stockFor = (material: InventoryMaterial) => material.inventory.reduce((sum, row) => sum + toNumber(row.quantity), 0);
  const minimumFor = (material: InventoryMaterial) => material.inventory.reduce((sum, row) => sum + toNumber(row.minThreshold), 0);

  return (
    <Screen footer={<AppButton title={t('costs.createOrderButton')} onPress={submit} loading={create.isPending} />}>
      <Stack.Screen options={{ title: t('costs.newOrderTitle') }} />
      {suppliers.isError ? <ErrorState error={suppliers.error} onRetry={() => suppliers.refetch()} /> : null}
      {materials.isError ? <ErrorState error={materials.error} onRetry={() => materials.refetch()} /> : null}
      <AppCard style={{ gap: spacing.lg }}>
        <SelectField
          label={t('costs.supplierLabel')}
          required
          value={supplierId}
          options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          onChange={(value) => { setSupplierId(value); setSelectedMaterialId(null); }}
          placeholder={t('costs.selectSupplier')}
          searchable
        />
        <DateField label={t('costs.orderDate')} value={orderDate} onChange={setOrderDate} />
        <DateField label={t('costs.expectedDeliveryDate')} value={expectedDelivery} onChange={setExpectedDelivery} />
      </AppCard>

      <AppCard style={{ gap: spacing.md }}>
        <SectionHeader
          title={locale === 'ar' ? 'المواد المطلوبة' : locale === 'en' ? 'Materials to order' : 'Matériaux à commander'}
          subtitle={locale === 'ar' ? 'اختار المواد وحدد الكمية المطلوبة' : locale === 'en' ? 'Choose materials and enter requested quantities' : 'Sélectionnez les matériaux et saisissez les quantités souhaitées'}
        />
        {materials.isLoading ? <ListSkeleton rows={3} /> : (
          <>
            <SelectField
              label={locale === 'ar' ? 'المادة' : locale === 'en' ? 'Material' : 'Matériau'}
              value={selectedMaterialId}
              options={supplierMaterials.map((material) => ({
                value: material.id,
                label: material.name,
                description: material.supplier?.name ?? (locale === 'ar' ? 'بدون مورد مرتبط' : locale === 'en' ? 'No linked supplier' : 'Aucun fournisseur associé'),
              }))}
              onChange={setSelectedMaterialId}
              placeholder={locale === 'ar' ? 'اختار مادة' : locale === 'en' ? 'Select a material' : 'Sélectionner un matériau'}
              searchable
              disabled={!supplierId}
            />
            <AppButton
              title={locale === 'ar' ? 'إضافة المادة' : locale === 'en' ? 'Add material' : 'Ajouter le matériau'}
              variant="secondary"
              icon="add"
              onPress={addMaterial}
              disabled={!supplierId || !selectedMaterialId}
            />
          </>
        )}
        {lines.length === 0 ? (
          <AppText variant="small">{locale === 'ar' ? 'مازال ما ضفتي حتى مادة.' : locale === 'en' ? 'No materials added yet.' : 'Aucun matériau ajouté pour le moment.'}</AppText>
        ) : lines.map((line) => {
          const stock = stockFor(line.material);
          const min = minimumFor(line.material);
          const requested = Math.max(0, Number(line.quantity) || 0);
          const missing = Math.max(0, requested - stock);
          const critical = stock <= min;
          return (
            <View key={line.material.id} style={{ gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText variant="bodyStrong">{line.material.name}</AppText>
                  <AppText variant="caption">{locale === 'ar' ? 'الوحدة' : locale === 'en' ? 'Unit' : 'Unité'}: {line.material.unit || '—'}</AppText>
                </View>
                <AppButton title={locale === 'ar' ? 'حذف' : locale === 'en' ? 'Remove' : 'Retirer'} variant="ghost" size="sm" onPress={() => setLines((current) => current.filter((item) => item.material.id !== line.material.id))} />
              </View>
              <AppInput
                label={locale === 'ar' ? 'الكمية المطلوبة' : locale === 'en' ? 'Requested quantity' : 'Quantité demandée'}
                value={line.quantity}
                onChangeText={(quantity) => setLines((current) => current.map((item) => item.material.id === line.material.id ? { ...item, quantity: quantity.replace(',', '.').replace(/[^0-9.]/g, '') } : item))}
                keyboardType="decimal-pad"
                required
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <AppText variant="small">{locale === 'ar' ? 'المخزون الحالي' : locale === 'en' ? 'Current stock' : 'Stock actuel'}</AppText>
                <AppText variant="bodyStrong">{formatNumber(stock, locale)} {line.material.unit}</AppText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <AppText variant="small">{locale === 'ar' ? 'الكمية الناقصة حسب الطلب' : locale === 'en' ? 'Quantity missing for this request' : 'Manque pour cette demande'}</AppText>
                <AppText variant="bodyStrong">{formatNumber(missing, locale)} {line.material.unit}</AppText>
              </View>
              {critical || missing > 0 ? (
                <View style={{ gap: spacing.xs, alignItems: 'flex-start' }}>
                  <StatusBadge label={critical
                    ? (locale === 'ar' ? 'المخزون حرج' : locale === 'en' ? 'Critical stock' : 'Stock critique')
                    : (locale === 'ar' ? 'المخزون غير كافٍ للطلب' : locale === 'en' ? 'Insufficient for requested quantity' : 'Stock insuffisant pour la demande')} tone={critical ? 'danger' : 'warning'} />
                  <AppText variant="caption">{critical
                    ? (locale === 'ar' ? 'المخزون الحالي وصل أو نزل على الحد الأدنى المسجل.' : locale === 'en' ? 'Current stock is at or below the configured minimum.' : 'Le stock actuel est au niveau ou sous le seuil minimum configuré.')
                    : (locale === 'ar' ? 'الكمية المطلوبة أكبر من المخزون المتوفر.' : locale === 'en' ? 'Requested quantity exceeds available stock.' : 'La quantité demandée dépasse le stock disponible.')}</AppText>
                </View>
              ) : <StatusBadge label={locale === 'ar' ? 'المخزون كافٍ' : locale === 'en' ? 'Stock available' : 'Stock disponible'} tone="success" />}
            </View>
          );
        })}
      </AppCard>
      {error ? <AppCard><AppText color={colors.danger}>{error}</AppText></AppCard> : null}
    </Screen>
  );
}
