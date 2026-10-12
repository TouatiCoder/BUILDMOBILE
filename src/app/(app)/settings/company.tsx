import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { companyApi } from '@/api/endpoints';
import type { Company } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { AppInput } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard } from '@/components/primitives';
import { useApiMutation, usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { spacing } from '@/theme/tokens';

type FormState = Record<'name' | 'siret' | 'email' | 'phone' | 'address' | 'city' | 'postal_code' | 'country' | 'ice' | 'if', string>;

function fromCompany(c: Company): FormState {
  return {
    name: c.name ?? '',
    siret: c.siret ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    postal_code: c.postalCode ?? '',
    country: c.country ?? '',
    ice: c.ice ?? '',
    if: c.if_id ?? '',
  };
}

export default function CompanyScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';
  const q = useQuery({ queryKey: ['company', companyId], queryFn: () => companyApi.get(companyId), enabled: !!companyId });

  return (
    <>
      <Stack.Screen options={{ title: t('settings.companyInfoTitle') }} />
      {q.isLoading ? (
        <Screen>
          <ListSkeleton rows={3} />
        </Screen>
      ) : q.isError || !q.data ? (
        <Screen>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Screen>
      ) : (
        <CompanyForm key={q.data.updatedAt} company={q.data} />
      )}
    </>
  );
}

/**
 * PUT /api/company/[companyId] rewrites every column, so — exactly like
 * components/settings/company-settings.tsx — the fields not shown in the form
 * (tax rate, bank info, currency, timezone) are sent back with their loaded values.
 */
function CompanyForm({ company }: { company: Company }) {
  const { t } = useI18n();
  const { allows } = usePermissions();
  // Website: the company settings tab is admin-only (settings-client.tsx).
  const canEdit = allows('company');
  const [form, setForm] = useState<FormState>(() => fromCompany(company));

  const save = useApiMutation({
    mutationFn: (payload: Record<string, string | null>) => companyApi.update(company.id, payload),
    invalidate: [['company']],
    successMessage: t('settings.companySaveSuccess'),
  });

  const submit = () =>
    save.mutate({
      ...form,
      tax_rate: company.taxRate != null ? String(company.taxRate) : '20.00',
      bank_info: company.bankInfo ?? '',
      currency: company.currency ?? 'MAD',
      timezone: company.timezone ?? 'Africa/Casablanca',
    });

  const field = (name: keyof FormState, label: string, extra: Partial<React.ComponentProps<typeof AppInput>> = {}) => (
    <AppInput label={label} value={form[name]} editable={canEdit} onChangeText={(v) => setForm((prev) => ({ ...prev, [name]: v }))} {...extra} />
  );

  return (
    <Screen keyboard footer={canEdit ? <AppButton title={t('common.save')} onPress={submit} loading={save.isPending} disabled={!form.name.trim()} /> : undefined}>
      <AppCard style={{ gap: spacing.lg }}>
        {field('name', t('settings.companyNameLabel'))}
        {field('siret', t('settings.companySiretLabel'))}
        {field('email', t('settings.companyEmailLabel'), { keyboardType: 'email-address', autoCapitalize: 'none' })}
        {field('phone', t('settings.companyPhoneLabel'), { keyboardType: 'phone-pad' })}
        {field('address', t('settings.companyAddressLabel'))}
        {field('city', t('settings.companyCityLabel'))}
        {field('postal_code', t('settings.companyPostalCodeLabel'))}
        {field('country', t('settings.companyCountryLabel'))}
        {field('ice', t('settings.companyIceLabel'))}
        {field('if', t('settings.companyIfLabel'))}
      </AppCard>
    </Screen>
  );
}
