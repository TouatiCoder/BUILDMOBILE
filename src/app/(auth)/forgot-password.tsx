import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { rawRequest } from '@/api/client';
import { Banner, useErrorMessage } from '@/components/feedback';
import { AppInput } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, IconTile } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { colors, spacing } from '@/theme/tokens';

/**
 * Mobile password-reset request.
 *
 * The app calls the same backend endpoint as the website. The backend sends
 * the email through Resend and returns a generic 2xx response whether or not
 * the account exists. The reset link opens the website's reset-password page;
 * the Resend API key must never be bundled in the mobile app.
 */
export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const describe = useErrorMessage();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const schema = z.object({ email: z.string().trim().email(t('auth.forgotPassword.invalidEmail')) });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    const normalized = email.trim().toLowerCase();
    try {
      const res = await rawRequest('/api/auth/forgot-password', { method: 'POST', body: { email: normalized }, anonymous: true });
      if (res.status >= 200 && res.status < 300) {
        setSentTo(normalized);
      } else {
        setError(t('auth.forgotPassword.unexpectedError'));
      }
    } catch (e) {
      setError(describe(e));
    }
  });

  if (sentTo) {
    return (
      <Screen>
        <AppCard style={styles.card}>
          <View style={styles.centerCol}>
            <IconTile icon="mail-open-outline" tone="success" size={64} />
            <AppText variant="heading" style={styles.center}>
              {t('auth.forgotPassword.checkEmailTitle').replace(/\s*:\s*$/, '')}
            </AppText>
            <AppText variant="body" color={colors.textSecondary} style={styles.center}>
              {t('auth.forgotPassword.successMessageBody', { email: sentTo })}
            </AppText>
          </View>
          <Banner tone="info" icon="globe-outline" message={t('auth.forgotWebNotice')} />
          <AppButton title={t('auth.forgotPassword.backToLogin')} icon="log-in-outline" size="lg" onPress={() => router.back()} />
          <AppButton title={t('auth.forgotPassword.retry')} variant="ghost" onPress={() => setSentTo(null)} />
        </AppCard>
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <AppCard style={styles.card}>
        <View style={styles.centerCol}>
          <IconTile icon="key-outline" tone="brand" size={64} />
          <AppText variant="heading" style={styles.center}>
            {t('auth.forgotPassword.title')}
          </AppText>
          <AppText variant="small" style={styles.center}>
            {t('auth.forgotPassword.subtitle')}
          </AppText>
        </View>
        {error ? <Banner tone="danger" message={error} /> : null}
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <AppInput
              label={t('auth.forgotPassword.email')}
              icon="mail-outline"
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.email?.message}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="send"
              editable={!isSubmitting}
              onSubmitEditing={onSubmit}
            />
          )}
        />
        <AppButton title={t('auth.forgotPassword.submit')} icon="paper-plane-outline" size="lg" onPress={onSubmit} loading={isSubmitting} />
        <AppButton title={t('auth.forgotPassword.backToLogin')} variant="ghost" onPress={() => router.back()} disabled={isSubmitting} />
        <View style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
          <AppText variant="caption" style={{ flex: 1 }}>
            {t('auth.forgotPassword.infoText')}
          </AppText>
        </View>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg, padding: spacing.xl },
  centerCol: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
