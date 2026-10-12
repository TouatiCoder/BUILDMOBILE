import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { accountApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { enableLabelKey, kindLabelKey } from '@/auth/biometrics';
import { Banner } from '@/components/feedback';
import { SwitchRow, AppInput } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, KeyValue, SectionHeader } from '@/components/primitives';
import { useToast } from '@/components/toast';
import { useApiMutation, useConfirm } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { spacing } from '@/theme/tokens';

export default function SecurityScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { biometricEnabled, enableBiometric, disableBiometric, getBiometricStatus, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  // Re-checked every time the screen is shown: enrollment can change in the OS settings.
  const status = useQuery({ queryKey: ['device', 'biometrics'], queryFn: getBiometricStatus, staleTime: 0, gcTime: 0 });
  const s = status.data;
  const kind = s && s.state !== 'no-hardware' ? s.kind : 'generic';
  const available = s?.state === 'available';

  const onToggle = async (next: boolean) => {
    setBioError(null);
    setBusy(true);
    try {
      if (next) {
        const res = await enableBiometric();
        if (res.ok) toast.show('success', t('biometric.enabled'));
        else setBioError(res.message);
      } else {
        await disableBiometric();
        toast.show('success', t('biometric.disabled'));
      }
    } finally {
      setBusy(false);
      void status.refetch();
    }
  };

  const schema = z
    .object({
      currentPassword: z.string().min(1, t('common.required')),
      newPassword: z.string().min(8, t('common.passwordRequirementMinLength')),
      confirm: z.string(),
    })
    .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: t('settings.passwordsMismatchError') });
  type Values = z.infer<typeof schema>;
  const { control, handleSubmit, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const change = useApiMutation({
    mutationFn: accountApi.changePassword,
    successMessage: t('settings.passwordUpdatedSuccess'),
    onSuccess: () => reset(),
  });

  const pw = (name: keyof Values, label: string, autoComplete: 'current-password' | 'new-password') => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <AppInput label={label} value={field.value} onChangeText={field.onChange} secureTextEntry autoComplete={autoComplete} error={formState.errors[name]?.message} />
      )}
    />
  );

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: t('settings.securityTitle') }} />
      <AppCard style={{ gap: spacing.md }}>
        <SectionHeader title={t('biometric.sectionTitle')} />
        <SwitchRow
          label={t(enableLabelKey(kind))}
          description={t('biometric.sectionHint')}
          value={biometricEnabled}
          onValueChange={onToggle}
          disabled={busy || (!available && !biometricEnabled)}
        />
        <KeyValue
          label={t('biometric.availability')}
          value={
            !s
              ? t('common.loading')
              : s.state === 'available'
                ? `${t(kindLabelKey(s.kind))} · ${t('biometric.available')}`
                : s.state === 'not-enrolled'
                  ? t('biometric.notEnrolled')
                  : s.state === 'weak-only'
                    ? t('biometric.weakOnly')
                    : t('biometric.noHardware')
          }
        />
        {bioError ? <Banner tone="danger" message={bioError} /> : null}
      </AppCard>

      <AppCard style={{ gap: spacing.lg }}>
        <SectionHeader title={t('settings.changePassword')} />
        {pw('currentPassword', t('settings.currentPassword'), 'current-password')}
        {pw('newPassword', t('settings.newPassword'), 'new-password')}
        {pw('confirm', t('settings.confirmNewPassword'), 'new-password')}
        <AppButton
          title={t('settings.updatePasswordButton')}
          loading={change.isPending}
          onPress={handleSubmit((v) => change.mutate({ currentPassword: v.currentPassword, newPassword: v.newPassword }))}
        />
      </AppCard>

      <AppButton
        title={t('common.logout')}
        icon="log-out-outline"
        variant="danger"
        onPress={async () => {
          if (await confirm({ title: t('common.logout'), message: t('session.logoutConfirm'), confirmLabel: t('common.logout') })) await signOut();
        }}
      />
    </Screen>
  );
}
