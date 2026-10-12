import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { companyApi } from '@/api/endpoints';
import { Banner } from '@/components/feedback';
import { SelectField, AppInput } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard } from '@/components/primitives';
import { useApiMutation } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { roleLabel } from '@/lib/labels';
import { spacing } from '@/theme/tokens';

/** Roles accepted by POST /api/company/users/invite (ALLOWED_INVITE_ROLES). */
const INVITE_ROLES = ['site_manager', 'structural_engineer'] as const;

export default function InviteScreen() {
  const { t } = useI18n();
  const schema = z.object({
    email: z.string().trim().email(t('auth.forgotPassword.invalidEmail')),
    firstName: z.string().trim().min(1, t('common.required')),
    lastName: z.string().trim().min(1, t('common.required')),
    role: z.enum(INVITE_ROLES),
  });
  type Values = z.infer<typeof schema>;
  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', firstName: '', lastName: '', role: 'site_manager' },
  });

  const invite = useApiMutation({
    mutationFn: companyApi.invite,
    invalidate: [['company']],
    successMessage: t('settings.inviteSent'),
    onSuccess: () => router.back(),
  });

  const text = (name: 'email' | 'firstName' | 'lastName', label: string, extra: Partial<React.ComponentProps<typeof AppInput>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <AppInput label={label} required value={field.value} onChangeText={field.onChange} error={formState.errors[name]?.message} {...extra} />}
    />
  );

  return (
    <Screen
      keyboard
      footer={<AppButton title={t('settings.sendInvite')} loading={invite.isPending} onPress={handleSubmit((v) => invite.mutate({ ...v, email: v.email.toLowerCase() }))} />}>
      <Stack.Screen options={{ title: t('settings.inviteTitle') }} />
      <Banner message={t('settings.inviteDescription')} />
      <AppCard style={{ gap: spacing.lg }}>
        {text('email', t('settings.workEmailLabel'), { keyboardType: 'email-address', autoCapitalize: 'none', placeholder: t('settings.workEmailPlaceholder') })}
        {text('firstName', t('settings.firstName'))}
        {text('lastName', t('settings.lastName'))}
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <SelectField
              label={t('settings.roleLabel')}
              required
              value={field.value}
              options={INVITE_ROLES.map((r) => ({ value: r, label: roleLabel(t, r) }))}
              onChange={(v) => v && field.onChange(v)}
            />
          )}
        />
      </AppCard>
    </Screen>
  );
}
