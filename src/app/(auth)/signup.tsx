import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { ApiError } from '@/api/client';
import { registrationApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { Banner, LoadingState, useErrorMessage } from '@/components/feedback';
import { AppInput } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, IconTile, SectionHeader } from '@/components/primitives';
import { useToast } from '@/components/toast';
import { useI18n } from '@/i18n/I18nProvider';
import { passwordMeetsRules, PASSWORD_RULES } from '@/lib/password';
import { colors, spacing } from '@/theme/tokens';

/**
 * Company + administrator sign-up (backlog "Écran d'inscription": company
 * name, optional SIRET, admin e-mail, password). The server always creates
 * the account with role "admin" for a new company; employees are invited
 * afterwards. Super-admin is never requested here.
 */
export default function SignupScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const describe = useErrorMessage();
  const { signIn } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const refs = {
    siret: useRef<TextInput>(null),
    firstName: useRef<TextInput>(null),
    lastName: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    password: useRef<TextInput>(null),
    confirm: useRef<TextInput>(null),
  };

  const status = useQuery({ queryKey: ['registration', 'status'], queryFn: registrationApi.status, retry: false });

  const schema = z
    .object({
      companyName: z.string().trim().min(2, t('common.required')),
      siret: z.string().trim(),
      firstName: z.string().trim().min(2, t('signup.firstNameMin')),
      lastName: z.string().trim().min(1, t('common.required')),
      email: z.string().trim().email(t('auth.forgotPassword.invalidEmail')),
      password: z.string().refine(passwordMeetsRules, t('common.passwordRequirementMinLength')),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: t('auth.signup.passwordMismatch') });
  type Values = z.infer<typeof schema>;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { companyName: '', siret: '', firstName: '', lastName: '', email: '', password: '', confirm: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    const email = v.email.trim().toLowerCase();
    try {
      const res = await registrationApi.register({
        companyName: v.companyName.trim(),
        siret: v.siret.trim() || null,
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        email,
        password: v.password,
      });
      if (res.isPlatformAdmin) {
        // The server makes the very first platform account a super-admin; the
        // app only creates company admins, so it does not sign this one in.
        Alert.alert(t('auth.signup.title'), t('signup.platformAccount'), [{ text: 'OK', onPress: () => router.back() }]);
        return;
      }
      toast.show('success', t('signup.success'));
      const login = await signIn(email, v.password);
      if (!login.ok) {
        // Account exists; let the user sign in manually.
        Alert.alert(t('auth.signup.title'), t('auth.signup.successMessage'), [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setServerError(t('settings.profileEmailInUse'));
      else if (error instanceof ApiError && error.status === 400) setServerError(error.message);
      else setServerError(error instanceof ApiError && error.kind !== 'http' ? describe(error) : t('auth.signup.registrationError'));
    }
  });

  const text = (
    name: keyof Values,
    label: string,
    next: keyof typeof refs | null,
    extra: Partial<React.ComponentProps<typeof AppInput>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <AppInput
          ref={name in refs ? refs[name as keyof typeof refs] : undefined}
          label={label}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors[name]?.message}
          editable={!isSubmitting}
          returnKeyType={next ? 'next' : 'done'}
          onSubmitEditing={() => (next ? refs[next].current?.focus() : void onSubmit())}
          blurOnSubmit={!next}
          {...extra}
        />
      )}
    />
  );

  if (status.isLoading) {
    return (
      <Screen>
        <LoadingState variant="spinner" />
      </Screen>
    );
  }
  const closed = status.data?.open === false;

  return (
    <Screen
      footer={
        <AppButton
          title={isSubmitting ? t('auth.signup.submitting') : t('auth.signup.submit')}
          icon="person-add-outline"
          size="lg"
          loading={isSubmitting}
          disabled={closed}
          onPress={onSubmit}
        />
      }>
      <View style={styles.hero}>
        <IconTile icon="business-outline" tone="brand" size={56} />
        <AppText variant="heading" style={styles.center}>
          {t('auth.signup.title')}
        </AppText>
        <AppText variant="small" style={styles.center}>
          {t('auth.signup.subtitle')}
        </AppText>
      </View>

      {closed ? <Banner tone="warning" message={t('auth.login.registrationClosed')} /> : <Banner message={t('signup.adminOnlyNote')} />}
      {serverError ? <Banner tone="danger" message={serverError} /> : null}

      <AppCard style={{ gap: spacing.lg }}>
        <SectionHeader title={t('signup.companySection')} />
        {text('companyName', t('auth.signup.companyName'), 'siret', { icon: 'business-outline', placeholder: t('auth.signup.companyPlaceholder'), required: true })}
        {text('siret', t('signup.siretOptional'), 'firstName', { icon: 'document-text-outline', keyboardType: 'number-pad' })}
      </AppCard>

      <AppCard style={{ gap: spacing.lg }}>
        <SectionHeader title={t('signup.adminSection')} />
        {text('firstName', t('auth.signup.firstName'), 'lastName', { placeholder: t('auth.signup.firstNamePlaceholder'), autoComplete: 'given-name', required: true })}
        {text('lastName', t('auth.signup.lastName'), 'email', { placeholder: t('auth.signup.lastNamePlaceholder'), autoComplete: 'family-name', required: true })}
        {text('email', t('auth.signup.email'), 'password', {
          icon: 'mail-outline',
          placeholder: t('auth.signup.emailPlaceholder'),
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          autoCorrect: false,
          autoComplete: 'email',
          required: true,
        })}
        {text('password', t('auth.signup.password'), 'confirm', {
          icon: 'lock-closed-outline',
          secureTextEntry: true,
          autoCapitalize: 'none',
          autoComplete: 'new-password',
          textContentType: 'newPassword',
          required: true,
        })}
        <View style={{ gap: 6 }}>
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(password ?? '');
            return (
              <View key={rule.key} style={styles.rule}>
                <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={ok ? colors.success : colors.textMuted} />
                <AppText variant="small" color={ok ? colors.success : colors.textSecondary}>
                  {t(rule.key)}
                </AppText>
              </View>
            );
          })}
        </View>
        {text('confirm', t('auth.signup.confirmPassword'), null, {
          icon: 'lock-closed-outline',
          secureTextEntry: true,
          autoCapitalize: 'none',
          autoComplete: 'new-password',
          textContentType: 'newPassword',
          required: true,
        })}
      </AppCard>

      <AppButton title={`${t('auth.signup.hasAccount')} ${t('auth.signup.signIn')}`} variant="ghost" onPress={() => router.back()} disabled={isSubmitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  center: { textAlign: 'center' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
