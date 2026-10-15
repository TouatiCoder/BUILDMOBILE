import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { inventoryApi, warehousesApi } from '@/api/endpoints';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { ChipGroup, SelectField, AppInput, type Option } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard } from '@/components/primitives';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { parseDecimalInput } from '@/lib/format';
import { spacing } from '@/theme/tokens';

type Mode = 'entry' | 'transfer';

/**
 * Stock entry and warehouse-to-warehouse transfer, the two operations of
 * POST /api/inventory used by the website's /inventory/entry/new and
 * /stock/consumption/new pages. Stock checks happen server-side in a transaction.
 */
export default function InventoryOperationScreen() {
  const params = useLocalSearchParams<{ mode?: string; materialId?: string }>();
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<Mode>(params.mode === 'transfer' ? 'transfer' : 'entry');
  const [materialId, setMaterialId] = useState<string | null>(params.materialId ?? null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const materials = useQuery({ queryKey: ['inventory', 'materials', { all: true }], queryFn: () => inventoryApi.materials({}) });
  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: warehousesApi.list });

  const onDone = () => router.back();
  const entry = useApiMutation({ mutationFn: inventoryApi.entry, invalidate: [['inventory']], successMessage: t('inventory.entrySaved'), onSuccess: onDone });
  const transfer = useApiMutation({ mutationFn: inventoryApi.transfer, invalidate: [['inventory']], successMessage: t('inventory.transferSaved'), onSuccess: onDone });

  const materialOptions: Option[] = (materials.data ?? []).map((m) => ({ value: m.id, label: m.name, description: m.unit }));
  const warehouseOptions: Option[] = (warehouses.data ?? []).map((w) => ({ value: w.id, label: w.name, description: w.location ?? undefined }));

  const submit = () => {
    const next: Record<string, string> = {};
    const qty = parseDecimalInput(quantity);
    if (!materialId) next.material = t('inventory.materialRequiredError');
    if (qty === null || !Number.isFinite(qty) || qty <= 0) next.quantity = t('inventory.quantityPositiveError');
    if (mode === 'entry' && !warehouseId) next.warehouse = t('inventory.warehouseRequiredError');
    if (mode === 'transfer') {
      if (!sourceId) next.source = t('inventory.sourceWarehouseRequiredError');
      if (!destinationId) next.destination = t('inventory.destinationWarehouseRequiredError');
      if (sourceId && destinationId && sourceId === destinationId) next.destination = t('inventory.destinationWarehouseRequiredError');
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !materialId || qty === null) return;
    if (mode === 'entry' && warehouseId) {
      entry.mutate({ material_id: materialId, warehouse_id: warehouseId, quantity: qty, notes: notes.trim() });
    } else if (mode === 'transfer' && sourceId && destinationId) {
      transfer.mutate({ material_id: materialId, source_warehouse_id: sourceId, destination_warehouse_id: destinationId, quantity: qty, notes: notes.trim() });
    }
  };

  const title = mode === 'entry' ? t('inventory.newStockEntryTitle') : t('inventory.newStockTransferTitle');
  const pending = entry.isPending || transfer.isPending;

  if (materials.isLoading || warehouses.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ListSkeleton rows={2} />
      </Screen>
    );
  }
  if (materials.isError || warehouses.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ErrorState error={materials.error ?? warehouses.error} onRetry={() => { void materials.refetch(); void warehouses.refetch(); }} />
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      footer={<AppButton title={mode === 'entry' ? t('common.save') : t('inventory.saveTransfer')} onPress={submit} loading={pending} disabled={pending} />}>
      <Stack.Screen options={{ title }} />
      <ChipGroup<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'entry', label: t('inventory.stockEntry') },
          { value: 'transfer', label: t('inventory.stockTransfer') },
        ]}
      />
      <AppCard style={{ gap: spacing.lg }}>
        <SelectField
          label={t('inventory.materials')}
          required
          value={materialId}
          options={materialOptions}
          onChange={setMaterialId}
          placeholder={t('inventory.selectMaterialPlaceholder')}
          error={errors.material}
          searchable
        />
        {mode === 'entry' ? (
          <SelectField
            label={t('inventory.destinationWarehouse')}
            required
            value={warehouseId}
            options={warehouseOptions}
            onChange={setWarehouseId}
            error={errors.warehouse}
          />
        ) : (
          <>
            <SelectField
              label={t('inventory.sourceWarehouse')}
              required
              value={sourceId}
              options={warehouseOptions}
              onChange={setSourceId}
              placeholder={t('inventory.selectSourceWarehouse')}
              error={errors.source}
            />
            <SelectField
              label={t('inventory.destinationWarehouse')}
              required
              value={destinationId}
              options={warehouseOptions.filter((w) => w.value !== sourceId)}
              onChange={setDestinationId}
              placeholder={t('inventory.selectDestinationWarehouse')}
              error={errors.destination}
            />
          </>
        )}
        <AppInput
          label={`${t('inventory.quantity')}${material ? ` (${material.unit})` : ''}`}
          required
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          error={errors.quantity}
        />
        <AppInput label={t('inventory.notesOptional')} value={notes} onChangeText={setNotes} multiline />
      </AppCard>
    </Screen>
  );
}
