import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { kindLabelKey, type BiometricKind } from '@/auth/biometrics';
import { BlueprintBackdrop, LogoTile } from '@/components/brand';
import { Banner } from '@/components/feedback';
import { AppInput } from '@/components/fields';
import { KeyboardAwareScrollView } from '@/components/keyboard';
import { AppButton, AppText, type IconName } from '@/components/primitives';
import { useToast } from '@/components/toast';
import { useI18n } from '@/i18n/I18nProvider';
import { localeNames, locales } from '@/i18n/locale';
import { colors, radius, shadows, spacing, TOUCH_TARGET } from '@/theme/tokens';

// UI preference only: the user declined the "enable biometrics" offer after a password login.
const BIOMETRIC_OFFER_DISMISSED_KEY = 'app.biometricOfferDismissed';

function biometricIcon(kind: BiometricKind): IconName {
  return kind === 'faceId' || kind === 'faceUnlock' ? 'scan-outline' : 'finger-print';
}

/**
 * Login with the website's account system (POST /api/auth/login through
 * AuthProvider.signIn). Nothing here fakes or bypasses authentication: the
 * app only continues when the server returns a session.
 *
 * Fingerprint / Face ID button (backlog: biometric option on the login screen):
 * - when a biometric-protected session is saved on this device (state
 *   "locked": app start, re-lock, or sign-out with biometrics enabled), it asks
 *   the OS to release it — automatically, except right after a deliberate sign-out;
 * - after a session expiry with biometrics enabled, it explains that one
 *   password login is needed and biometric sign-in then resumes by itself;
 * - otherwise it explains that a first password login is needed; after that
 *   login the app offers to enable biometric sign-in.
 */
export default function LoginScreen() {
  const { t, locale, setLocale } = useI18n();
  const toast = useToast();
  const { signIn, state, unlock, getBiometricStatus, enableBiometric } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const prompted = useRef(false);
  const locked = state.status === 'locked';
  const autoPrompt = state.status === 'locked' && state.autoPrompt !== false;
  const biometricResume = state.status === 'signed-out' && state.biometricResume === true;
  const notice = state.status === 'signed-out' || state.status === 'locked' ? state.notice : undefined;

  const device = useQuery({ queryKey: ['device', 'biometrics'], queryFn: getBiometricStatus, staleTime: 0, gcTime: 0 });
  const kind: BiometricKind = device.data && device.data.state !== 'no-hardware' ? device.data.kind : 'generic';
  // Face ID / Touch ID are product names; other methods read lowercase inside a sentence.
  const methodName = t(kindLabelKey(kind));
  const method = kind === 'faceId' || kind === 'touchId' ? methodName : methodName.charAt(0).toLowerCase() + methodName.slice(1);
  const showBiometricButton = locked || (device.data !== undefined && device.data.state !== 'no-hardware');

  const runUnlock = async () => {
    setUnlocking(true);
    try {
      await unlock();
    } finally {
      setUnlocking(false);
    }
  };

  useEffect(() => {
    // Open the OS prompt once automatically when a biometric session is saved.
    if (autoPrompt && !prompted.current) {
      prompted.current = true;
      void runUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrompt]);

  const onBiometricPress = () => {
    if (locked) {
      void runUnlock();
      return;
    }
    if (device.data?.state === 'not-enrolled') {
      Alert.alert(methodName, t('biometric.notEnrolled'));
      return;
    }
    if (device.data?.state === 'weak-only') {
      Alert.alert(methodName, t('biometric.weakOnly'));
      return;
    }
    Alert.alert(t('biometric.offerTitle'), t(biometricResume ? 'biometric.resumeAfterPassword' : 'biometric.needsFirstLogin', { method }));
  };

  /** After a successful password login, offer biometric sign-in once (unless declined before). */
  const offerBiometric = async () => {
    let dismissed = false;
    try {
      dismissed = (await AsyncStorage.getItem(BIOMETRIC_OFFER_DISMISSED_KEY)) === '1';
    } catch {
      // Preference unreadable: ask anyway.
    }
    if (dismissed) return;
    const status = await getBiometricStatus();
    if (status.state !== 'available') return;
    const name = t(kindLabelKey(status.kind));
    const label = status.kind === 'faceId' || status.kind === 'touchId' ? name : name.charAt(0).toLowerCase() + name.slice(1);
    Alert.alert(t('biometric.offerTitle'), t('biometric.offerMessage', { method: label }), [
      {
        text: t('biometric.later'),
        style: 'cancel',
        onPress: () => void AsyncStorage.setItem(BIOMETRIC_OFFER_DISMISSED_KEY, '1').catch(() => undefined),
      },
      {
        text: t('biometric.enableAction'),
        onPress: async () => {
          const res = await enableBiometric();
          if (res.ok) toast.show('success', t('biometric.enabled'));
          else toast.show('error', res.message);
        },
      },
    ]);
  };

  const schema = z.object({
    email: z.string().trim().min(1, t('common.required')).email(t('auth.forgotPassword.invalidEmail')),
    password: z.string().min(1, t('common.required')),
  });
  type Values = z.infer<typeof schema>;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: state.status === 'locked' ? state.email : '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await signIn(values.email, values.password);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    if (!result.biometricEnabled) void offerBiometric();
  });

  const chooseLanguage = () => {
    Alert.alert(t('common.language'), undefined, [
      ...locales.map((l) => ({ text: localeNames[l], onPress: () => void setLocale(l) })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  return (
    <View style={styles.root}>
      <BlueprintBackdrop />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAwareScrollView contentContainerStyle={styles.scroll} innerStyle={styles.scroll} bounces={false}>
            <View style={styles.topBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('common.language')}: ${localeNames[locale]}`}
                onPress={chooseLanguage}
                style={({ pressed }) => [styles.langPill, pressed && { opacity: 0.8 }]}>
                <Ionicons name="globe-outline" size={18} color={colors.textOnBrand} />
                <AppText variant="label" color={colors.textOnBrand}>
                  {localeNames[locale]}
                </AppText>
              </Pressable>
            </View>

            <View style={styles.hero}>
              <LogoTile size={64} />
              <AppText variant="display" color={colors.textOnBrand} style={styles.center}>
                {t('auth.login.title')}
              </AppText>
              <AppText variant="body" color={colors.textOnBrandMuted} style={styles.center}>
                {t('auth.login.subtitle')}
              </AppText>
            </View>

            <View style={styles.sheet}>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="heading" accessibilityRole="header">
                  {t('auth.welcomeBack')}
                </AppText>
                <AppText variant="small">{t('auth.loginIntro')}</AppText>
              </View>

              {notice ? <Banner tone="warning" message={notice} /> : null}
              {serverError ? <Banner tone="danger" message={serverError} /> : null}

              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <AppInput
                    label={t('auth.login.email')}
                    icon="mail-outline"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.email?.message}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="username"
                    returnKeyType="next"
                    editable={!isSubmitting}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <AppInput
                    ref={passwordRef}
                    label={t('auth.login.password')}
                    icon="lock-closed-outline"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.password?.message}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    editable={!isSubmitting}
                    onSubmitEditing={onSubmit}
                  />
                )}
              />

              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/forgot-password')}
                hitSlop={8}
                style={styles.forgot}
                disabled={isSubmitting}>
                <AppText variant="label" color={colors.brand}>
                  {t('auth.login.forgotLink')}
                  {locale === 'fr' ? ' ?' : locale === 'ar' ? '؟' : '?'}
                </AppText>
              </Pressable>

              <AppButton
                title={t('auth.login.submit')}
                size="lg"
                icon="log-in-outline"
                variant={locked ? 'secondary' : 'primary'}
                onPress={onSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
              />

              {showBiometricButton ? (
                <>
                  <View style={styles.separator}>
                    <View style={styles.separatorLine} />
                    <AppText variant="caption">{t('auth.or')}</AppText>
                    <View style={styles.separatorLine} />
                  </View>
                  <AppButton
                    title={t('auth.biometricSignIn', { method })}
                    icon={biometricIcon(kind)}
                    size="lg"
                    variant={locked ? 'primary' : 'secondary'}
                    loading={unlocking}
                    disabled={isSubmitting}
                    onPress={onBiometricPress}
                  />
                </>
              ) : null}

              <View style={styles.signupRow}>
                <AppText variant="small">{t('auth.login.noAccount')}</AppText>
                <Pressable accessibilityRole="link" onPress={() => router.push('/signup')} hitSlop={8} disabled={isSubmitting}>
                  <AppText variant="label" color={colors.brand}>
                    {t('auth.login.createAdmin')}
                  </AppText>
                </Pressable>
              </View>
            </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandDeep },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scroll: { flexGrow: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TOUCH_TARGET - 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  hero: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl + 8,
    borderTopRightRadius: radius.xl + 8,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    ...shadows.lg,
  },
  forgot: { alignSelf: 'flex-end', minHeight: TOUCH_TARGET - 12, justifyContent: 'center', marginTop: -spacing.sm },
  separator: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  signupRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, minHeight: TOUCH_TARGET },
  separatorLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
});
