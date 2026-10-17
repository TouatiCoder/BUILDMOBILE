import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { suppliersApi } from '@/api/endpoints';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { Screen } from '@/components/layout';
import { SupplierForm } from '@/features/suppliers/SupplierForm';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';

export default function EditSupplierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const supplier = useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => suppliersApi.get(id),
    enabled: !!id,
  });
  const update = useApiMutation({
    mutationFn: (input: Parameters<typeof suppliersApi.update>[1]) => suppliersApi.update(id, input),
    invalidate: [['suppliers']],
    successMessage: t('suppliers.updated'),
    onSuccess: () => router.replace('/suppliers'),
  });

  return (
    <>
      <Stack.Screen options={{ title: t('suppliers.edit') }} />
      {supplier.isLoading ? (
        <Screen><ListSkeleton rows={4} /></Screen>
      ) : supplier.isError || !supplier.data ? (
        <Screen><ErrorState error={supplier.error} onRetry={() => supplier.refetch()} /></Screen>
      ) : (
        <SupplierForm supplier={supplier.data} submitting={update.isPending} onSubmit={(input) => update.mutate(input)} />
      )}
    </>
  );
}
