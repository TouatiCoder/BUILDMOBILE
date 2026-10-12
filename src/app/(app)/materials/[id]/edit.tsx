import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { materialsApi } from '@/api/endpoints';
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
  const update = useApiMutation({
    mutationFn: (input: MaterialInput) => materialsApi.update(id, input),
    invalidate: [['inventory']],
    successMessage: t('inventory.materialUpdatedSuccess'),
    onSuccess: () => router.back(),
  });
  return (
    <>
      <Stack.Screen options={{ title: t('inventory.editMaterialTitle') }} />
      {material.isLoading ? (
        <Screen>
          <ListSkeleton rows={3} />
        </Screen>
      ) : material.isError || !material.data ? (
        <Screen>
          <ErrorState error={material.error} onRetry={() => material.refetch()} />
        </Screen>
      ) : (
        <MaterialForm material={material.data} submitLabel={t('inventory.updateMaterial')} submitting={update.isPending} onSubmit={(input) => update.mutate(input)} />
      )}
    </>
  );
}
