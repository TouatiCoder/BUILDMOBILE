import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { ordersApi, suppliersApi } from '@/api/endpoints';
import { ErrorState } from '@/components/feedback';
import { DateField, SelectField } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard } from '@/components/primitives';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { toIsoDate } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/**
 * POST /api/purchase-orders (admin only on the server). The website adds order
 * lines through a server action that has no HTTP endpoint, so lines cannot be
 * created from the app yet (see docs/BACKEND_CHANGES_REQUIRED.md).
 */
export default function NewOrderScreen() {
  const { t } = useI18n();
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState<string | null>(toIsoDate(new Date()));
  const [expectedDelivery, setExpectedDelivery] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const create = useApiMutation({
    mutationFn: ordersApi.create,
    invalidate: [['orders']],
    successMessage: t('costs.success'),
    onSuccess: (order) => router.replace({ pathname: '/orders/[id]', params: { id: order.id } }),
  });

  const submit = () => {
    if (!supplierId) {
      setError(t('costs.supplierRequired'));
      return;
    }
    setError(undefined);
    create.mutate({ supplierId, orderDate, expectedDelivery });
  };

  return (
    <Screen footer={<AppButton title={t('costs.createOrderButton')} onPress={submit} loading={create.isPending} />}>
      <Stack.Screen options={{ title: t('costs.newOrderTitle') }} />
      {suppliers.isError ? <ErrorState error={suppliers.error} onRetry={() => suppliers.refetch()} /> : null}
      <AppCard style={{ gap: spacing.lg }}>
        <SelectField
          label={t('costs.supplierLabel')}
          required
          value={supplierId}
          options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSupplierId}
          placeholder={t('costs.selectSupplier')}
          error={error}
          searchable
        />
        <DateField label={t('costs.orderDate')} value={orderDate} onChange={setOrderDate} />
        <DateField label={t('costs.expectedDeliveryDate')} value={expectedDelivery} onChange={setExpectedDelivery} />
      </AppCard>
    </Screen>
  );
}
