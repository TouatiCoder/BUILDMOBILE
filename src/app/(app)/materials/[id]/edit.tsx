import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { inventoryApi, materialsApi } from '@/api/endpoints';
import type { MaterialInput } from '@/api/types';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { Screen } from '@/components/layout';
import { MaterialForm } from '@/features/materials/MaterialForm';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';

export default function EditMaterialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const material = useQuery({ queryKey: ['inventory', 'material', id], queryFn: () => materialsApi.get(id) });
  // The detail endpoint returns only one inventory row; use the inventory list's
  // complete warehouse rows so min/max thresholds are edited from the same data
  // used by the inventory screen.
  const inventory = useQuery({
    queryKey: ['inventory', 'materials', { all: true }],
    queryFn: () => inventoryApi.materials({}),
  });
  const update = useApiMutation({
    mutationFn: (input: MaterialInput) => materialsApi.update(id, input),
    invalidate: [['inventory']],
    successMessage: t('inventory.materialUpdatedSuccess'),
    onSuccess: () => router.back(),
  });
  return (
    <>
      <Stack.Screen options={{ title: t('inventory.editMaterialTitle') }} />
      {material.isLoading || inventory.isLoading ? (
        <Screen>
          <ListSkeleton rows={3} />
        </Screen>
      ) : material.isError || !material.data || inventory.isError ? (
        <Screen>
          <ErrorState
            error={material.error ?? inventory.error}
            onRetry={() => { void material.refetch(); void inventory.refetch(); }}
          />
        </Screen>
      ) : (
        <MaterialForm
          material={{
            ...material.data,
            inventory: inventory.data?.find((row) => row.id === id)?.inventory ?? material.data.inventory,
          }}
          submitLabel={t('inventory.updateMaterial')}
          submitting={update.isPending}
          onSubmit={(input) => update.mutate(input)}
        />
      )}
    </>
  );
}
