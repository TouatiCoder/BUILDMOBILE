import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { billingApi, companyApi } from '@/api/endpoints';
import type { SubscriptionPlan } from '@/api/types';
import { Banner, ErrorState, LoadingState } from '@/components/feedback';
import { ChipGroup } from '@/components/fields';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, DirectionalIcon, IconButton, IconTile, SectionHeader, StatusBadge, type IconName } from '@/components/primitives';
import { useToast } from '@/components/toast';
import { useApiMutation, useConfirm, usePermissions } from '@/hooks/common';
import { useDirectionStyle, useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDate } from '@/lib/format';
import { computeCadencePrice, isPaidPlanCode, PLAN_MONTHLY_MAD, type BillingCadence } from '@/lib/pricing';
import { cadenceLabel, methodLabel, planLabel } from '@/lib/platform';
import { colors, radius, shadows, spacing, TOUCH_TARGET, type Tone } from '@/theme/tokens';

const PLAN_ORDER = ['free', 'pro', 'enterprise'];
type Method = 'stripe' | 'paypal' | 'cash';

function newIdempotencyKey() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Subscription purchase inside the app — the website's billing tab flow:
 * GET /api/subscription · GET /api/billing/payment-methods ·
 * POST /api/billing/checkout (Stripe, opened in the in-app browser) ·
 * POST /api/billing/manual-request (cash / PayPal) · POST /api/subscription (free plan).
 * Activation always comes from the server (Stripe webhook or platform-admin
 * confirmation); the app only shows what the server reports.
 */
export default function SubscriptionScreen() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();
  const [cadence, setCadence] = useState<BillingCadence>('monthly');
  const [picking, setPicking] = useState<string | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);

  const sub = useQuery({ queryKey: ['subscription'], queryFn: companyApi.subscription, enabled: isAdmin });
  const methods = useQuery({ queryKey: ['billing', 'payment-methods'], queryFn: billingApi.paymentMethods, enabled: isAdmin });

  // Coming back from the Stripe page (Android Custom Tab / iOS Safari view): refresh.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && awaitingPayment) void queryClient.invalidateQueries({ queryKey: ['subscription'] });
    });
    return () => subscription.remove();
  }, [awaitingPayment, queryClient]);

  const describeBillingError = (error: unknown) =>
    error instanceof ApiError && error.status === 409 ? t('billing.pendingBlocks') : undefined;

  const checkout = useApiMutation({
    mutationFn: billingApi.checkout,
    onSuccess: async (res) => {
      setPicking(null);
      if (!res.checkout_url) {
        toast.show('info', t('billing.paymentStillPending'));
        return;
      }
      setAwaitingPayment(true);
      await WebBrowser.openBrowserAsync(res.checkout_url, {
        showTitle: true,
        enableBarCollapsing: true,
        dismissButtonStyle: 'close',
        toolbarColor: colors.surface,
        controlsColor: colors.brand,
      });
      // iOS resolves when the page is closed; Android resolves immediately and
      // the AppState listener refreshes when the user comes back.
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
  const manual = useApiMutation({
    mutationFn: billingApi.manualRequest,
    invalidate: [['subscription']],
    successMessage: t('billing.manualPaymentRequested'),
    onSuccess: () => setPicking(null),
  });
  const downgrade = useApiMutation({
    mutationFn: billingApi.changePlan,
    invalidate: [['subscription']],
    successMessage: t('billing.planUpdated', { name: t('billing.free') }),
  });

  const pay = (planCode: string, method: Method) => {
    if (method === 'stripe') checkout.mutate({ planCode, cadence, idempotencyKey: newIdempotencyKey() });
    else manual.mutate({ planCode, cadence, method });
  };

  if (!isAdmin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('subscription.title') }} />
        <Banner tone="warning" message={t('billing.adminOnly')} />
      </Screen>
    );
  }
  if (sub.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('subscription.title') }} />
        <LoadingState rows={3} />
      </Screen>
    );
  }
  if (sub.isError || !sub.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('subscription.title') }} />
        <ErrorState error={sub.error} onRetry={() => sub.refetch()} />
      </Screen>
    );
  }

  const s = sub.data.subscription;
  const pending = sub.data.pendingPayment ?? null;
  const plans = [...sub.data.plans].sort((a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code));
  const statusTone: Tone = s.status === 'active' ? 'success' : s.status === 'trialing' ? 'info' : s.status === 'past_due' ? 'warning' : s.status === 'free' ? 'neutral' : 'danger';
  const statusKey: Record<string, string> = {
    active: 'billing.statusActive',
    trialing: 'billing.statusTrialing',
    free: 'billing.statusFree',
    canceled: 'billing.statusCancelled',
    cancelled: 'billing.statusCancelled',
    past_due: 'billing.statusPastDue',
  };
  const errorMessage = describeBillingError(checkout.error) ?? describeBillingError(manual.error);

  return (
    <Screen refreshing={sub.isRefetching} onRefresh={() => sub.refetch()}>
      <Stack.Screen options={{ title: t('subscription.title') }} />

      <AppCard elevated style={{ gap: spacing.sm }}>
        <AppText variant="overline">{t('billing.currentSubscription').toUpperCase()}</AppText>
        <View style={styles.rowBetween}>
          <AppText variant="display">{s.planName}</AppText>
          <StatusBadge label={t(statusKey[s.status] ?? '', undefined, s.status)} tone={statusTone} dot />
        </View>
        {s.isTrialing && !s.trialExpired && s.trialDaysLeft !== null ? (
          <AppText variant="small" color={colors.info}>
            {s.trialDaysLeft === 0 ? t('billing.trialExpiresToday') : t('billing.trialDaysRemaining', { days: s.trialDaysLeft })}
          </AppText>
        ) : null}
        {s.trialExpired ? <Banner tone="danger" message={t('billing.trialExpired')} /> : null}
        {s.currentPeriodEnd && s.planCode !== 'free' ? (
          <AppText variant="small">{t('billing.expiresOn', { date: formatDate(s.currentPeriodEnd, locale) })}</AppText>
        ) : null}
      </AppCard>

      {pending ? (
        <Banner
          tone="warning"
          icon="hourglass-outline"
          message={`${t('billing.pendingPaymentBanner', {
            plan: planLabel(t, pending.planCode),
            cadence: cadenceLabel(t, pending.cadence),
            method: methodLabel(t, pending.method),
          })}\n${t('billing.paymentStillPending')}`}
        />
      ) : null}
      {awaitingPayment && !pending ? <Banner tone="info" message={t('billing.checkingPayment')} /> : null}
      {errorMessage ? <Banner tone="danger" message={errorMessage} /> : null}

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t('billing.changePlan')} subtitle={t('billing.changePlanDesc')} />
        <ChipGroup<BillingCadence>
          value={cadence}
          onChange={setCadence}
          options={[
            { value: 'monthly', label: t('billing.billingMonthly') },
            { value: 'quarterly', label: t('billing.billingQuarterly') },
            { value: 'annual', label: t('billing.billingAnnual') },
          ]}
        />
      </View>

      {plans.map((plan) => (
        <PlanCard
          key={plan.code}
          plan={plan}
          cadence={cadence}
          isCurrent={plan.code === s.planCode}
          disabled={!!pending || checkout.isPending || manual.isPending || downgrade.isPending}
          loading={(checkout.isPending || manual.isPending) && picking === plan.code}
          onChoose={() => setPicking(plan.code)}
          onDowngrade={async () => {
            if (await confirm({ title: t('billing.downgrade'), message: t('billing.downgradeConfirm'), confirmLabel: t('billing.downgrade'), destructive: false })) {
              downgrade.mutate('free');
            }
          }}
        />
      ))}

      <View style={styles.secure}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
        <AppText variant="caption" style={{ flex: 1 }}>
          {t('billing.securePayment')}
        </AppText>
      </View>

      <MethodSheet
        visible={picking !== null}
        planCode={picking}
        cadence={cadence}
        methods={methods.data}
        loading={checkout.isPending || manual.isPending}
        onClose={() => setPicking(null)}
        onPick={(method) => picking && pay(picking, method)}
      />
    </Screen>
  );
}

function PlanCard({
  plan,
  cadence,
  isCurrent,
  disabled,
  loading,
  onChoose,
  onDowngrade,
}: {
  plan: SubscriptionPlan;
  cadence: BillingCadence;
  isCurrent: boolean;
  disabled: boolean;
  loading: boolean;
  onChoose: () => void;
  onDowngrade: () => void;
}) {
  const { t, locale } = useI18n();
  const paid = isPaidPlanCode(plan.code);
  const price = paid ? computeCadencePrice(PLAN_MONTHLY_MAD[plan.code as 'pro' | 'enterprise'], cadence) : null;
  const featured = plan.code === 'pro';
  const descKey: Record<string, string> = { free: 'billing.planDescFree', pro: 'billing.planDescPro', enterprise: 'billing.planDescEnterprise' };

  const feature = (code: string) => plan.features?.find((f) => f.featureCode === code);
  const projects = feature('max_projects');
  const users = feature('max_users');
  const analytics = feature('advanced_analytics');
  const lines: { icon: IconName; label: string }[] = [
    { icon: 'briefcase-outline', label: projects?.limitValue ? t('billing.maxProjects', { count: projects.limitValue }) : t('billing.unlimitedProjects') },
    { icon: 'people-outline', label: users?.limitValue ? t('billing.maxUsers', { count: users.limitValue }) : t('billing.unlimitedUsers') },
    { icon: 'analytics-outline', label: analytics?.enabled ? t('billing.advancedAnalytics') : t('billing.basicAnalytics') },
  ];

  return (
    <AppCard elevated={featured} style={[{ gap: spacing.md }, featured && styles.featured, isCurrent && styles.current]}>
      <View style={styles.rowBetween}>
        <AppText variant="title">{plan.name}</AppText>
        {isCurrent ? <StatusBadge label={t('billing.currentBadge')} tone="success" dot /> : null}
      </View>
      <AppText variant="small">{t(descKey[plan.code] ?? '', undefined, '')}</AppText>
      <View style={styles.priceRow}>
        <AppText variant="display">{price ? formatCurrency(price.perMonthMad, locale) : t('billing.free')}</AppText>
        {price ? <AppText variant="small">{t('billing.perMonthSuffix')}</AppText> : null}
      </View>
      {price && cadence !== 'monthly' ? (
        <AppText variant="caption">{t('billing.totalFor', { total: formatCurrency(price.totalMad, locale), months: price.months })}</AppText>
      ) : null}
      <View style={{ gap: 6 }}>
        {lines.map((l) => (
          <View key={l.label} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <AppText variant="small" color={colors.text}>
              {l.label}
            </AppText>
          </View>
        ))}
      </View>
      {isCurrent ? (
        <AppButton title={t('billing.currentPlan')} variant="secondary" disabled />
      ) : paid ? (
        <AppButton title={t('billing.choosePlan')} icon="card-outline" size="lg" loading={loading} disabled={disabled} onPress={onChoose} />
      ) : (
        <AppButton title={t('billing.downgrade')} variant="ghost" disabled={disabled} onPress={onDowngrade} />
      )}
    </AppCard>
  );
}

function MethodSheet({
  visible,
  planCode,
  cadence,
  methods,
  loading,
  onClose,
  onPick,
}: {
  visible: boolean;
  planCode: string | null;
  cadence: BillingCadence;
  methods?: { stripe: boolean; paypal: boolean; cash: boolean };
  loading: boolean;
  onClose: () => void;
  onPick: (method: Method) => void;
}) {
  const { t, locale } = useI18n();
  const direction = useDirectionStyle();
  const options: { method: Method; icon: IconName; label: string; hint: string; tone: Tone }[] = [
    { method: 'stripe' as const, icon: 'card-outline' as IconName, label: t('billing.stripe'), hint: t('billing.methodCardHint'), tone: 'brand' as Tone },
    { method: 'paypal' as const, icon: 'logo-paypal' as IconName, label: t('billing.paypal'), hint: t('billing.methodPaypalHint'), tone: 'info' as Tone },
    { method: 'cash' as const, icon: 'cash-outline' as IconName, label: t('billing.cash'), hint: t('billing.methodCashHint'), tone: 'success' as Tone },
  ].filter((o) => methods?.[o.method]);
  const price = planCode && isPaidPlanCode(planCode) ? computeCadencePrice(PLAN_MONTHLY_MAD[planCode], cadence) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, direction]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.cancel')} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="title">{t('billing.methodPickerTitle')}</AppText>
              <AppText variant="small">
                {planCode ? planLabel(t, planCode) : ''} · {t('billing.methodPickerDesc', { cadence: cadenceLabel(t, cadence) })}
                {price ? ` · ${formatCurrency(price.totalMad, locale)}` : ''}
              </AppText>
            </View>
            <IconButton icon="close" accessibilityLabel={t('common.close')} onPress={onClose} />
          </View>
          {options.length === 0 ? (
            <Banner tone="warning" message={t('billing.noMethodsAvailable')} />
          ) : (
            options.map((o) => (
              <Pressable
                key={o.method}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                disabled={loading}
                onPress={() => onPick(o.method)}
                style={({ pressed }) => [styles.method, pressed && { opacity: 0.85 }, loading && { opacity: 0.5 }]}>
                <IconTile icon={o.icon} tone={o.tone} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">{o.label}</AppText>
                  <AppText variant="caption">{o.hint}</AppText>
                </View>
                <DirectionalIcon name="chevron-forward" size={18} />
              </Pressable>
            ))
          )}
          {loading ? <AppText variant="caption" style={{ textAlign: 'center' }}>{t('billing.openingCheckout')}</AppText> : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featured: { borderColor: colors.brand, borderWidth: 1.5 },
  current: { borderColor: colors.success, borderWidth: 1.5 },
  secure: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.lg,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET + 20,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
