import { useQuery } from '@tanstack/react-query';
import { router, Stack, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checklistsApi, inventoryApi, notificationsApi, ordersApi, projectsApi, toolsApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { Banner, ErrorState } from '@/components/feedback';
import { AppHeader, ListGroup, ListRow, Screen, StatCard, StatGrid } from '@/components/layout';
import { AppText, IconButton, SectionHeader } from '@/components/primitives';
import {
  CostVsBudgetCard,
  MovementsSection,
  OrdersInProgressSection,
  OverBudgetSection,
  ProjectsSection,
  QuickActions,
  StockAlertsSection,
} from '@/features/dashboard/widgets';
import { usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDate } from '@/lib/format';
import { aggregateStock } from '@/lib/inventory';
import { stockState } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

/**
 * Role-based dashboard (backlog "Étape 2 : Le Tableau de Bord"). The role
 * comes from the authenticated session — the user never chooses it:
 * - admin → global view: cost vs budget, over-budget projects, stock value, critical stock, management links;
 * - site manager → operational view: stock thresholds, orders in progress, movements, field actions;
 * - structural engineer → technical view: projects, calculation tools, checklists.
 * All figures come from the existing API endpoints.
 */
export default function DashboardScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { role, can, isAdmin, isFieldRole } = usePermissions();
  const isManager = role === 'site_manager';
  const isEngineer = role === 'structural_engineer';
  const businessRole = isAdmin || isManager || isEngineer;
  const isFocused = useIsFocused();

  const projects = useQuery({ queryKey: ['projects', 'dashboard'], queryFn: () => projectsApi.list({ limit: 100 }), enabled: businessRole });
  const invStats = useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn: inventoryApi.stats,
    enabled: isAdmin || isManager,
    refetchInterval: isFocused ? 1_000 : false,
    refetchIntervalInBackground: false,
  });
  const dashboardMaterials = useQuery({
    queryKey: ['inventory', 'materials', 'dashboard-alerts'],
    queryFn: () => inventoryApi.materials({}),
    enabled: isAdmin || isManager,
    refetchInterval: isFocused ? 1_000 : false,
    refetchIntervalInBackground: false,
  });
  const orders = useQuery({ queryKey: ['orders', 'summary'], queryFn: () => ordersApi.list({ limit: 1000 }), enabled: isAdmin || isManager });
  const movements = useQuery({
    queryKey: ['inventory', 'movements', 5],
    queryFn: () => inventoryApi.movements(5),
    enabled: isManager,
    refetchInterval: isFocused ? 1_000 : false,
    refetchIntervalInBackground: false,
  });
  const calculations = useQuery({ queryKey: ['tools', 'calculations', 'all'], queryFn: () => toolsApi.calculations(), enabled: isFieldRole });
  const checklists = useQuery({
    queryKey: ['checklists', { status: 'in_progress', type: 'all' }],
    queryFn: () => checklistsApi.list({ status: 'in_progress' }),
    enabled: isFieldRole,
  });
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list, enabled: businessRole });

  useFocusEffect(
    useCallback(() => {
      void projects.refetch();
      if (isAdmin || isManager) {
        void invStats.refetch();
        void dashboardMaterials.refetch();
        void orders.refetch();
      }
      if (isManager) void movements.refetch();
      if (isFieldRole) {
        void calculations.refetch();
        void checklists.refetch();
      }
      if (businessRole) void notifications.refetch();
    }, [isAdmin, isManager, isFieldRole, businessRole, projects, invStats, dashboardMaterials, orders, movements, calculations, checklists, notifications]),
  );

  const stockAlerts = useMemo(() => {
    return (dashboardMaterials.data ?? []).filter((material) => {
      const stock = aggregateStock(material.inventory);
      const state = stockState(stock.quantity, stock.minThreshold, stock.maxThreshold);
      return state === 'critical' || state === 'low';
    });
  }, [dashboardMaterials.data]);
  const unread = (notifications.data ?? []).filter((n) => !n.isRead).length;
  const stats = projects.data?.stats;
  const allProjects = projects.data?.projects ?? [];
  const activeProjects = allProjects.filter((p) => p.status === 'active' || p.status === 'in_progress');

  const refetchAll = () => {
    for (const q of [projects, invStats, dashboardMaterials, orders, movements, calculations, checklists, notifications]) void q.refetch();
  };

  const viewName = isAdmin ? t('dashboard.adminView') : isManager ? t('dashboard.managerView') : isEngineer ? t('dashboard.engineerView') : undefined;

  return (
    <Screen refreshing={projects.isRefetching} onRefresh={refetchAll} contentStyle={{ paddingTop: insets.top + spacing.md }}>
      <Stack.Screen options={{ headerShown: false }} />

      <AppHeader
        variant="brand"
        eyebrow={viewName}
        title={t('dashboard.greeting', { name: user?.firstName ?? '' })}
        subtitle={formatDate(new Date(), locale)}
        right={
          businessRole ? (
            <IconButton
              icon="notifications-outline"
              color={colors.textOnBrand}
              badge={unread}
              accessibilityLabel={t('common.notifications')}
              onPress={() => router.push('/notifications')}
            />
          ) : undefined
        }>
        {stats ? (
          <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
            <HeroFigure label={t('project.totalProjects')} value={String(stats.total)} />
            <HeroFigure label={t('project.activeProjects')} value={String(stats.active)} />
            <HeroFigure label={t('project.overBudget')} value={String(stats.overBudgetCount)} />
          </View>
        ) : null}
      </AppHeader>

      {!businessRole ? <Banner message={t('dashboard.userRoleLimited')} /> : null}
      {projects.isError ? <ErrorState error={projects.error} onRetry={() => projects.refetch()} /> : null}

      {isAdmin ? (
        <>
          {stats ? <CostVsBudgetCard totalCost={stats.totalCost} totalBudget={stats.totalBudget} onPress={() => router.push('/reports')} /> : null}
          <StatGrid>
            <StatCard
              icon="cube-outline"
              tone="info"
              label={t('inventory.statsValue')}
              value={invStats.data ? formatCurrency(invStats.data.totalValue, locale) : '—'}
              onPress={() => router.push('/inventory')}
            />
            <StatCard
              icon="alert-circle-outline"
              tone={stockAlerts.length > 0 ? 'warning' : 'success'}
              label={t('common.criticalAlerts')}
              value={String(stockAlerts.length)}
              hint={invStats.data ? `${invStats.data.totalMaterials} ${t('inventory.materials').toLowerCase()}` : undefined}
              onPress={() => router.push('/inventory')}
            />
          </StatGrid>
          <OverBudgetSection projects={allProjects} loading={projects.isLoading} />
          <StockAlertsSection materials={dashboardMaterials.data ?? []} loading={dashboardMaterials.isLoading} />
          <View>
            <SectionHeader title={t('dashboard.quickAccess')} />
            <ListGroup>
              <ListRow icon="people-outline" title={t('dashboard.manageUsers')} onPress={() => router.push('/settings/users')} />
              <ListRow icon="business-outline" title={t('dashboard.companySettings')} onPress={() => router.push('/settings/company')} />
              <ListRow icon="bar-chart-outline" title={t('dashboard.financialReports')} onPress={() => router.push('/reports')} />
            </ListGroup>
          </View>
        </>
      ) : null}

      {isManager ? (
        <>
          <QuickActions
            items={[
              { icon: 'add-circle-outline', label: t('inventory.stockEntry'), href: { pathname: '/inventory/operation', params: { mode: 'entry' } } },
              { icon: 'swap-horizontal-outline', label: t('inventory.stockTransfer'), href: { pathname: '/inventory/operation', params: { mode: 'transfer' } }, tone: 'info' },
              { icon: 'checkbox-outline', label: t('common.checklistsPageTitle'), href: '/checklists', tone: 'success' },
              { icon: 'calculator-outline', label: t('common.calculationHubTitle'), href: '/tools', tone: 'violet' },
            ]}
          />
          <StockAlertsSection materials={dashboardMaterials.data ?? []} loading={dashboardMaterials.isLoading} limit={5} />
          <OrdersInProgressSection orders={orders.data ?? []} loading={orders.isLoading} />
          <MovementsSection movements={movements.data ?? []} loading={movements.isLoading} />
        </>
      ) : null}

      {isEngineer ? (
        <>
          <SectionHeader title={t('dashboard.fieldTools')} />
          <QuickActions
            items={[
              { icon: 'cube-outline', label: t('common.concreteCalculator'), href: '/tools/concrete' },
              { icon: 'barbell-outline', label: t('common.steelCalculator'), href: '/tools/steel', tone: 'info' },
              { icon: 'albums-outline', label: t('common.formworkCalculator'), href: '/tools/formwork', tone: 'violet' },
              { icon: 'grid-outline', label: t('common.meshCalculator'), href: '/tools/mesh', tone: 'warning' },
            ]}
          />
          <StatGrid>
            <StatCard
              icon="checkbox-outline"
              tone="success"
              label={t('common.checklistsPageTitle')}
              value={String(checklists.data?.items.length ?? '—')}
              hint={t('common.checklistsStatusInProgress')}
              onPress={() => router.push('/checklists')}
            />
            <StatCard
              icon="calculator-outline"
              tone="violet"
              label={t('common.calculationsPerformed')}
              value={String(calculations.data?.items.length ?? '—')}
              onPress={() => router.push('/tools')}
            />
          </StatGrid>
          <ProjectsSection title={t('project.activeProjects')} projects={activeProjects.slice(0, 5)} loading={projects.isLoading} />
          {calculations.data && calculations.data.items.length > 0 ? (
            <View>
              <SectionHeader title={t('common.latestCalculations')} />
              <ListGroup>
                {calculations.data.items.slice(0, 4).map((c) => (
                  <ListRow
                    key={c.id}
                    icon="document-text-outline"
                    title={t(`common.${c.toolType}Label`, undefined, c.toolType)}
                    subtitle={[c.project?.name, formatDate(c.createdAt, locale)].filter(Boolean).join(' · ')}
                  />
                ))}
              </ListGroup>
            </View>
          ) : null}
        </>
      ) : null}

      {isManager && can('view_projects') ? (
        <ProjectsSection title={t('project.activeProjects')} projects={activeProjects.slice(0, 3)} loading={projects.isLoading} />
      ) : null}
    </Screen>
  );
}

function HeroFigure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 80 }}>
      <AppText variant="heading" color={colors.textOnBrand}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.textOnBrandMuted}>
        {label}
      </AppText>
    </View>
  );
}
