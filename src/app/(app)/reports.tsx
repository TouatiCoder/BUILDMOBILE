import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { reportsApi } from '@/api/endpoints';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { Screen, StatCard, StatGrid } from '@/components/layout';
import { AppText, StatusBadge, AppCard, ProgressBar, SectionHeader } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, toNumber } from '@/lib/format';
import { projectStatusLabel, projectStatusTone } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

/**
 * Same two reports as the website's /reports page: project summary and
 * budget vs actual (actual = sum of project_expenses per project).
 */
export default function ReportsScreen() {
  const { t, locale } = useI18n();
  const budget = useQuery({ queryKey: ['reports', 'budget-vs-actual'], queryFn: reportsApi.budgetVsActual });
  const summary = useQuery({ queryKey: ['reports', 'project-summary'], queryFn: reportsApi.projectSummary });

  const totals = useMemo(() => {
    const rows = budget.data?.items ?? [];
    const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);
    return { totalBudget, totalActual, variance: totalBudget - totalActual };
  }, [budget.data]);

  const statusByProject = useMemo(() => new Map((summary.data?.items ?? []).map((r) => [r.project_id, r.status])), [summary.data]);

  return (
    <Screen
      refreshing={budget.isRefetching || summary.isRefetching}
      onRefresh={() => {
        void budget.refetch();
        void summary.refetch();
      }}>
      <Stack.Screen options={{ title: t('reports.title') }} />
      {budget.isLoading ? (
        <ListSkeleton rows={3} />
      ) : budget.isError ? (
        <ErrorState error={budget.error} onRetry={() => budget.refetch()} />
      ) : (
        <>
          <StatGrid>
            <StatCard icon="wallet-outline" label={t('reports.totalBudget')} value={formatCurrency(totals.totalBudget, locale)} />
            <StatCard icon="receipt-outline" tone="violet" label={t('reports.actualExpenses')} value={formatCurrency(totals.totalActual, locale)} />
            <StatCard
              icon="trending-up-outline"
              tone={totals.variance < 0 ? 'danger' : 'success'}
              label={t('reports.globalVariance')}
              value={formatCurrency(totals.variance, locale)}
            />
          </StatGrid>

          <View>
            <SectionHeader title={t('reports.budgetVsExpenses')} />
            {(budget.data?.items ?? []).length === 0 ? (
              <EmptyState icon="bar-chart-outline" title={t('common.noDataAvailable')} />
            ) : (
              <View style={{ gap: spacing.md }}>
                {(budget.data?.items ?? []).map((row) => {
                  const pct = row.budget > 0 ? Math.round((row.actual / row.budget) * 100) : 0;
                  const status = statusByProject.get(row.project_id);
                  return (
                    <AppCard key={row.project_id} style={{ gap: spacing.sm }}>
                      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                        <AppText variant="bodyStrong" style={{ flex: 1 }}>
                          {row.project_name}
                        </AppText>
                        {status ? <StatusBadge label={projectStatusLabel(t, status)} tone={projectStatusTone(status)} /> : null}
                      </View>
                      <ProgressBar value={pct} tone={pct > 100 ? 'danger' : pct > 85 ? 'warning' : 'brand'} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
                        <AppText variant="caption">
                          {t('reports.csvBudget')}: {formatCurrency(row.budget, locale)}
                        </AppText>
                        <AppText variant="caption">
                          {t('reports.csvActual')}: {formatCurrency(row.actual, locale)}
                        </AppText>
                        <AppText variant="caption" color={row.variance < 0 ? colors.danger : colors.success}>
                          {t('reports.csvVariance')}: {formatCurrency(toNumber(row.variance), locale)}
                        </AppText>
                      </View>
                    </AppCard>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}
