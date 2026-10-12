import { router, Stack } from 'expo-router';

import { materialsApi } from '@/api/endpoints';
import { MaterialForm } from '@/features/materials/MaterialForm';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';

export default function NewMaterialScreen() {
  const { t } = useI18n();
  const create = useApiMutation({
    mutationFn: materialsApi.create,
    invalidate: [['inventory']],
    successMessage: t('inventory.materialCreatedSuccess'),
    onSuccess: (m) => router.replace({ pathname: '/materials/[id]', params: { id: m.id } }),
  });
  return (
    <>
      <Stack.Screen options={{ title: t('inventory.newMaterialTitle') }} />
      <MaterialForm submitLabel={t('inventory.createMaterial')} submitting={create.isPending} onSubmit={(input) => create.mutate(input)} />
    </>
  );
}
