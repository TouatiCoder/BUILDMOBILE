import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { warehousesApi } from '@/api/endpoints';
import type { Warehouse } from '@/api/types';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { SwitchRow, AppInput } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard } from '@/components/primitives';
import { useApiMutation, useConfirm } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { parseDecimalInput, toNumberOrNull } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/** Create (POST /api/warehouses) or edit/delete (PUT/DELETE /api/warehouses/[id]). */
export default function WarehouseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useI18n();
  const existing = useQuery({ queryKey: ['warehouses', id], queryFn: () => warehousesApi.get(id!), enabled: !!id });
  const title = id ? t('warehouse.editWarehouse') : t('warehouse.newWarehouse');

  return (
    <>
      <Stack.Screen options={{ title }} />
      {!id ? (
        <WarehouseForm />
      ) : existing.isLoading ? (
        <Screen>
          <ListSkeleton rows={2} />
        </Screen>
      ) : existing.isError || !existing.data ? (
        <Screen>
          <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
        </Screen>
      ) : (
        <WarehouseForm warehouse={existing.data} />
      )}
    </>
  );
}

function WarehouseForm({ warehouse }: { warehouse?: Warehouse }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const editing = !!warehouse;
  const initialCapacity = toNumberOrNull(warehouse?.capacity ?? null);
  const [name, setName] = useState(warehouse?.name ?? '');
  const [location, setLocation] = useState(warehouse?.location ?? '');
  const [capacity, setCapacity] = useState(initialCapacity !== null ? String(initialCapacity) : '');
  const [isMain, setIsMain] = useState(warehouse?.isMain ?? false);
  const [isActive, setIsActive] = useState(warehouse?.isActive ?? true);
  const [errors, setErrors] = useState<{ name?: string; capacity?: string }>({});

  const back = () => router.back();
  const create = useApiMutation({ mutationFn: warehousesApi.create, invalidate: [['warehouses']], successMessage: t('warehouse.createdSuccess'), onSuccess: back });
  const update = useApiMutation({
    mutationFn: (input: Parameters<typeof warehousesApi.update>[1]) => warehousesApi.update(warehouse!.id, input),
    invalidate: [['warehouses'], ['inventory']],
    successMessage: t('warehouse.updatedSuccess'),
    onSuccess: back,
  });
  const remove = useApiMutation({
    mutationFn: () => warehousesApi.remove(warehouse!.id),
    invalidate: [['warehouses'], ['inventory']],
    successMessage: t('common.success'),
    onSuccess: back,
  });

  const submit = () => {
    const cap = parseDecimalInput(capacity);
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('warehouse.nameRequiredError');
    if (cap !== null && (!Number.isFinite(cap) || cap < 0)) next.capacity = t('common.invalidNumber');
    setErrors(next);
    if (Object.keys(next).length) return;
    const payload = { name: name.trim(), location: location.trim() || null, capacity: cap };
    if (editing) update.mutate({ ...payload, isMain, isActive });
    else create.mutate(payload);
  };

  return (
    <Screen keyboard footer={<AppButton title={editing ? t('common.save') : t('common.create')} onPress={submit} loading={create.isPending || update.isPending} />}>
      <AppCard style={{ gap: spacing.lg }}>
        <AppInput label={t('warehouse.warehouseName')} required value={name} onChangeText={setName} error={errors.name} placeholder={t('warehouse.warehouseNameExample')} />
        <AppInput label={t('warehouse.location')} value={location} onChangeText={setLocation} placeholder={t('warehouse.locationExample')} />
        <AppInput label={t('warehouse.capacity')} value={capacity} onChangeText={setCapacity} keyboardType="decimal-pad" error={errors.capacity} />
        {editing ? (
          <>
            <SwitchRow label={t('warehouse.mainWarehouse')} value={isMain} onValueChange={setIsMain} />
            <SwitchRow label={t('warehouse.active')} value={isActive} onValueChange={setIsActive} />
          </>
        ) : null}
      </AppCard>
      {editing ? (
        <AppButton
          title={t('common.delete')}
          icon="trash-outline"
          variant="danger"
          loading={remove.isPending}
          onPress={async () => {
            if (await confirm({ message: t('warehouse.deleteConfirm') })) remove.mutate();
          }}
        />
      ) : null}
    </Screen>
  );
}
