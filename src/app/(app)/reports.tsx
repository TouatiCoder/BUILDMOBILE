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
      refreshing={false}
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

          <View style={{ gap: spacing.md }}>
            <View>
              <SectionHeader title={t('reports.budgetVsExpenses')} />
              <AppText variant="caption" color={colors.textMuted}>Budget prévu et dépenses réellement enregistrées pour chaque projet.</AppText>
            </View>
            {(budget.data?.items ?? []).length === 0 ? (
              <EmptyState icon="bar-chart-outline" title={t('common.noDataAvailable')} />
            ) : (
              <View style={{ gap: spacing.md }}>
                {(budget.data?.items ?? []).map((row) => {
                  const maxValue = Math.max(row.budget, row.actual, 1);
                  const budgetPct = Math.max(0, Math.min(100, (row.budget / maxValue) * 100));
                  const actualPct = Math.max(0, Math.min(100, (row.actual / maxValue) * 100));
                  const pct = row.budget > 0 ? Math.round((row.actual / row.budget) * 100) : 0;
                  const status = statusByProject.get(row.project_id);
                  return (
                    <AppCard key={row.project_id} style={{ gap: spacing.sm }}>
                      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                        <AppText variant="bodyStrong" style={{ flex: 1 }}>{row.project_name}</AppText>
                        {status ? <StatusBadge label={projectStatusLabel(t, status)} tone={projectStatusTone(status)} /> : null}
                      </View>
                      <View style={{ gap: spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: colors.brand }} />
                          <AppText variant="caption" style={{ width: 70 }}>{t('reports.csvBudget')}</AppText>
                          <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' }}>
                            <View style={{ width: String(budgetPct) + '%', height: '100%', backgroundColor: colors.brand }} />
                          </View>
                        </View>
                        <AppText variant="caption">{formatCurrency(row.budget, locale)}</AppText>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: colors.danger }} />
                          <AppText variant="caption" style={{ width: 70 }}>{t('reports.csvActual')}</AppText>
                          <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' }}>
                            <View style={{ width: String(actualPct) + '%', height: '100%', backgroundColor: colors.danger }} />
                          </View>
                        </View>
                        <AppText variant="caption">{formatCurrency(row.actual, locale)}</AppText>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
                        <AppText variant="caption" color={row.variance < 0 ? colors.danger : colors.success}>
                          {t('reports.csvVariance')}: {formatCurrency(toNumber(row.variance), locale)}
                        </AppText>
                        <StatusBadge label={row.budget > 0 ? String(pct) + '% du budget utilisé' : 'Budget non défini'} tone={row.budget > 0 && pct > 100 ? 'danger' : row.budget > 0 && pct > 85 ? 'warning' : 'success'} />
                      </View>
                    </AppCard>
                  );
                })}
              </View>
            )}
          </View>
          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Écart budget / réel" />
            <AppText variant="caption" color={colors.textMuted}>Écart positif : budget restant · écart négatif : dépassement du budget.</AppText>
            {(budget.data?.items ?? []).map((row) => {
              const maxAbs = Math.max(1, ...(budget.data?.items ?? []).map((item) => Math.abs(item.variance)));
              const widthPct = Math.min(100, Math.abs(row.variance) / maxAbs * 100);
              const positive = row.variance >= 0;
              return (
                <AppCard key={'variance-' + row.project_id} style={{ gap: spacing.sm }}>
                  <AppText variant="bodyStrong">{row.project_name}</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1, height: 12, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden' }}>
                      <View style={{ width: String(widthPct) + '%', height: '100%', backgroundColor: positive ? colors.success : colors.danger, borderRadius: 6 }} />
                    </View>
                    <AppText variant="caption" color={positive ? colors.success : colors.danger}>{formatCurrency(row.variance, locale)}</AppText>
                  </View>
                </AppCard>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}
