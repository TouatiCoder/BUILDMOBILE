import { router, Stack } from 'expo-router';

import { suppliersApi } from '@/api/endpoints';
import { SupplierForm } from '@/features/suppliers/SupplierForm';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';

export default function NewSupplierScreen() {
  const { t } = useI18n();
  const create = useApiMutation({
    mutationFn: suppliersApi.create,
    invalidate: [['suppliers']],
    successMessage: t('suppliers.created'),
    onSuccess: () => router.replace('/suppliers'),
  });

  return (
    <>
      <Stack.Screen options={{ title: t('suppliers.add') }} />
      <SupplierForm submitting={create.isPending} onSubmit={(input) => create.mutate(input)} />
    </>
  );
}
