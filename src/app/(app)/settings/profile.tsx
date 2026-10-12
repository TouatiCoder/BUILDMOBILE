import { zodResolver } from '@hookform/resolvers/zod';
import { Stack } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { ApiError } from '@/api/client';
import { accountApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { AppInput } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, KeyValue } from '@/components/primitives';
import { useToast } from '@/components/toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useErrorMessage } from '@/components/feedback';
import { useMutation } from '@tanstack/react-query';
import { formatDateTime } from '@/lib/format';
import { roleLabel } from '@/lib/labels';
import { spacing } from '@/theme/tokens';

/** PUT /api/auth/me — same fields as the website's profile settings. */
export default function ProfileScreen() {
  const { t, locale } = useI18n();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const describe = useErrorMessage();

  const schema = z.object({
    firstName: z.string().trim().min(1, t('common.required')),
    lastName: z.string().trim().min(1, t('common.required')),
    email: z.string().trim().email(t('auth.forgotPassword.invalidEmail')),
    phone: z.string().trim(),
  });
  type Values = z.infer<typeof schema>;
  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    values: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', email: user?.email ?? '', phone: user?.phone ?? '' },
  });

  const save = useMutation({
    mutationFn: accountApi.updateProfile,
    onSuccess: (res) => {
      if (user) setUser({ ...user, ...res.user });
      toast.show('success', t('settings.profileUpdateSuccess'));
    },
    onError: (error) => {
      const message = error instanceof ApiError && error.code === 'EMAIL_IN_USE' ? t('settings.profileEmailInUse') : describe(error);
      toast.show('error', message);
    },
  });

  const field = (name: keyof Values, label: string, extra: Partial<React.ComponentProps<typeof AppInput>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => <AppInput label={label} value={f.value} onChangeText={f.onChange} onBlur={f.onBlur} error={formState.errors[name]?.message} {...extra} />}
    />
  );

  return (
    <Screen keyboard footer={<AppButton title={t('common.save')} loading={save.isPending} onPress={handleSubmit((v) => save.mutate(v))} />}>
      <Stack.Screen options={{ title: t('settings.profileTitle') }} />
      <AppCard style={{ gap: spacing.lg }}>
        {field('firstName', t('settings.firstName'), { autoComplete: 'given-name' })}
        {field('lastName', t('settings.lastName'), { autoComplete: 'family-name' })}
        {field('email', t('common.email'), { keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email' })}
        {field('phone', t('common.phone'), { keyboardType: 'phone-pad', placeholder: t('settings.phonePlaceholder') })}
      </AppCard>
      {user ? (
        <AppCard style={{ gap: spacing.xs }}>
          <KeyValue label={t('common.role')} value={roleLabel(t, user.role)} />
          <KeyValue label={t('users.lastLogin')} value={formatDateTime(user.lastLoginAt, locale)} />
        </AppCard>
      ) : null}
    </Screen>
  );
}
