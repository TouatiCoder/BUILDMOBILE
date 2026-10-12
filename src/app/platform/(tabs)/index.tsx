import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { platformApi } from '@/api/endpoints';
import type { PlatformCompany } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorState, LoadingState } from '@/components/feedback';
import { AppHeader, ListGroup, ListRow, Screen, StatCard, StatGrid } from '@/components/layout';
import { AppButton, AppCard, AppText, IconTile, KeyValue, ProgressBar, SectionHeader, StatusBadge } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { platformStatusLabel, platformStatusTone } from '@/lib/platform';
import { colors, spacing, type Tone } from '@/theme/tokens';

/**
 * Super-admin overview: platform KPIs (GET /api/v1/platform/dashboard),
 * subscriptions (GET /api/v1/platform/subscriptions), billing health
 * (GET /api/platform/billing/metrics), pending manual payments and companies
 * needing attention.
 */
export default function PlatformOverviewScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const dashboard = useQuery({ queryKey: ['platform', 'dashboard'], queryFn: platformApi.dashboard });
  const subs = useQuery({ queryKey: ['platform', 'subscriptions'], queryFn: platformApi.subscriptions });
  const billing = useQuery({ queryKey: ['platform', 'billing-metrics'], queryFn: platformApi.billingMetrics });
  const payments = useQuery({ queryKey: ['platform', 'manual-payments'], queryFn: platformApi.manualPayments });
  const suspended = useQuery({
    queryKey: ['platform', 'companies', { status: 'suspended', page: 1, pageSize: 3 }],
    queryFn: () => platformApi.companies({ page: 1, pageSize: 3, status: 'suspended' }),
  });
  const trialing = useQuery({
    queryKey: ['platform', 'companies', { status: 'trialing', page: 1, pageSize: 3 }],
    queryFn: () => platformApi.companies({ page: 1, pageSize: 3, status: 'trialing' }),
  });

  const refetchAll = () => {
    for (const q of [dashboard, subs, billing, payments, suspended, trialing]) void q.refetch();
  };

  const d = dashboard.data;
  const pending = (payments.data?.items ?? []).filter((p) => p.status === 'pending');
  const attention: PlatformCompany[] = [...(suspended.data?.items ?? []), ...(trialing.data?.items ?? [])];
  const activeRate = d && d.total_companies > 0 ? Math.round((d.active_companies / d.total_companies) * 100) : 0;

  return (
    <Screen refreshing={dashboard.isRefetching} onRefresh={refetchAll} contentStyle={{ paddingTop: insets.top + spacing.md }}>
      <AppHeader
        variant="brand"
        eyebrow={t('platform.layout.badge')}
        title={t('platform.layout.title')}
        subtitle={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() + ` · ${formatDate(new Date(), locale)}`}>
        {d ? (
          <View style={styles.heroRow}>
            <HeroFigure label={t('platform.metrics.totalCompanies')} value={String(d.total_companies)} />
            <HeroFigure label={t('platform.metrics.active')} value={String(d.active_companies)} />
            <HeroFigure label={t('platform.metrics.mrrEstimate')} value={formatCurrency(d.monthly_revenue_estimate, locale)} />
          </View>
        ) : null}
      </AppHeader>

      {dashboard.isLoading ? <LoadingState rows={2} /> : null}
      {dashboard.isError ? <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} /> : null}

      {d ? (
        <StatGrid>
          <StatCard
            icon="checkmark-circle-outline"
            tone="success"
            label={t('platform.metrics.activeRate')}
            value={`${activeRate}%`}
            hint={`${d.active_companies}/${d.total_companies}`}
            onPress={() => router.push({ pathname: '/platform/companies', params: { status: 'active' } })}
          />
          <StatCard
            icon="pause-circle-outline"
            tone={d.suspended_companies > 0 ? 'danger' : 'neutral'}
            label={t('platform.metrics.suspended')}
            value={String(d.suspended_companies)}
            onPress={() => router.push({ pathname: '/platform/companies', params: { status: 'suspended' } })}
          />
          <StatCard
            icon="hourglass-outline"
            tone="info"
            label={t('platform.metrics.onTrial')}
            value={String(d.companies_on_trial)}
            onPress={() => router.push({ pathname: '/platform/companies', params: { status: 'trialing' } })}
          />
          <StatCard
            icon="alert-circle-outline"
            tone={d.failed_payments_count > 0 ? 'warning' : 'success'}
            label={t('platform.failedPayments')}
            value={String(d.failed_payments_count)}
          />
        </StatGrid>
      ) : null}

      {pending.length > 0 ? (
        <AppCard elevated style={styles.pendingCard} onPress={() => router.push('/platform/payments')}>
          <IconTile icon="card-outline" tone="warning" size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="title">{t('platform.manualPayments.pendingTitle')}</AppText>
            <AppText variant="small">
              {pending.length} · {formatCurrency(pending.reduce((sum, p) => sum + p.amountMad, 0), locale)}
            </AppText>
          </View>
          <StatusBadge label={String(pending.length)} tone="warning" />
        </AppCard>
      ) : null}

      {subs.data ? (
        <View>
          <SectionHeader title={t('platform.subscriptionsBreakdown')} subtitle={`${t('platform.metrics.monthlyRecurringRevenue')} : ${formatCurrency(subs.data.monthly_recurring_revenue, locale)}`} />
          <AppCard style={{ gap: spacing.md }}>
            {(
              [
                ['active', subs.data.active_subscriptions],
                ['trialing', subs.data.trialing_subscriptions],
                ['past_due', subs.data.past_due_subscriptions],
                ['canceled', subs.data.canceled_subscriptions],
              ] as const
            ).map(([status, count]) => {
              const pct = subs.data.total_subscriptions > 0 ? Math.round((count / subs.data.total_subscriptions) * 100) : 0;
              const tone: Tone = platformStatusTone(status);
              return (
                <View key={status} style={{ gap: 6 }}>
                  <View style={styles.rowBetween}>
                    <StatusBadge label={platformStatusLabel(t, status)} tone={tone} dot />
                    <AppText variant="label" color={colors.text}>
                      {count} · {pct}%
                    </AppText>
                  </View>
                  <ProgressBar value={pct} tone={tone} height={6} />
                </View>
              );
            })}
          </AppCard>
        </View>
      ) : null}

      {billing.data ? (
        <View>
          <SectionHeader title={t('platform.billingHealth')} />
          <AppCard style={{ gap: spacing.xs }}>
            <KeyValue icon="warning-outline" label={t('platform.webhookFailures24h')} value={String(billing.data.webhook_failures_last_24h)} />
            <KeyValue icon="mail-unread-outline" label={t('platform.deadLetters')} value={String(billing.data.dead_letter_webhooks)} />
            <KeyValue icon="time-outline" label={t('platform.status.past_due')} value={String(billing.data.past_due_count)} />
            <KeyValue icon="sync-outline" label={t('platform.lastReconciliation')} value={formatDateTime(billing.data.last_reconciliation_at, locale)} />
          </AppCard>
        </View>
      ) : null}

      <View>
        <SectionHeader
          title={t('platform.needsAttention')}
          actionLabel={t('common.viewAll')}
          onAction={() => router.push('/platform/companies')}
        />
        {suspended.isLoading || trialing.isLoading ? (
          <LoadingState rows={2} />
        ) : attention.length === 0 ? (
          <AppCard>
            <View style={styles.okRow}>
              <IconTile icon="shield-checkmark-outline" tone="success" size={36} />
              <AppText variant="small" style={{ flex: 1 }}>
                {t('platform.allClear')}
              </AppText>
            </View>
          </AppCard>
        ) : (
          <ListGroup>
            {attention.map((c) => (
              <ListRow
                key={c.id}
                icon="business-outline"
                iconTone={platformStatusTone(c.status)}
                title={c.name}
                subtitle={
                  c.status === 'trialing' && c.trial_ends_at
                    ? t('platform.companies.trialUntil', { date: formatDate(c.trial_ends_at, locale) })
                    : `${t('platform.createdAt')} ${formatDate(c.created_at, locale)}`
                }
                right={<StatusBadge label={platformStatusLabel(t, c.status)} tone={platformStatusTone(c.status)} />}
                onPress={() => router.push({ pathname: '/platform/company/[id]', params: { id: c.id } })}
              />
            ))}
          </ListGroup>
        )}
      </View>

      <AppButton title={t('platform.companies.title')} icon="business-outline" variant="secondary" onPress={() => router.push('/platform/companies')} />
    </Screen>
  );
}

function HeroFigure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 88, flexShrink: 1 }}>
      <AppText variant="heading" color={colors.textOnBrand} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.textOnBrandMuted} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pendingCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: colors.warningSoft, borderWidth: 1 },
});
