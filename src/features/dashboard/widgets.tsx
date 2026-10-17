import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { InventoryMaterial, Project, PurchaseOrder, StockMovementRow } from '@/api/types';
import { EmptyState, LoadingState } from '@/components/feedback';
import { ListGroup, ListRow } from '@/components/layout';
import { AppCard, AppText, IconTile, ProgressBar, SectionHeader, StatusBadge, type IconName } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDate, formatDateTime, formatNumber, toNumber } from '@/lib/format';
import { aggregateStock } from '@/lib/inventory';
import {
  movementLabel,
  movementTone,
  orderStatusLabel,
  orderStatusTone,
  projectStatusLabel,
  projectStatusTone,
  stockState,
  stockStateLabel,
  stockStateTone,
} from '@/lib/labels';
import { colors, radius, spacing, type Tone } from '@/theme/tokens';

/** Projects with any budget overrun are shown as dashboard alerts. */
export function overBudgetProjects(projects: Project[]): (Project & { overrunPct: number })[] {
  return projects
    .map((p) => {
      const budget = toNumber(p.totalBudget);
      const cost = toNumber(p.currentCost);
      return { ...p, overrunPct: budget > 0 ? (cost - budget) / budget : 0 };
    })
    .filter((p) => p.overrunPct > 0)
    .sort((a, b) => b.overrunPct - a.overrunPct);
}

/** Order statuses the backlog calls "open / in delivery". */
export const OPEN_ORDER_STATUSES = new Set(['pending', 'approved', 'ordered', 'partially_delivered']);

export function CostVsBudgetCard({ totalCost, totalBudget, onPress }: { totalCost: number; totalBudget: number; onPress?: () => void }) {
  const { t, locale } = useI18n();
  const pct = totalBudget > 0 ? Math.round((totalCost / totalBudget) * 100) : 0;
  const tone: Tone = pct > 100 ? 'danger' : pct > 85 ? 'warning' : 'success';
  return (
    <AppCard elevated onPress={onPress} accessibilityLabel={`${t('dashboard.costVsBudget')}: ${pct}%`} style={{ gap: spacing.md }}>
      <View style={styles.rowBetween}>
        <AppText variant="overline">{t('dashboard.costVsBudget').toUpperCase()}</AppText>
        <StatusBadge label={`${pct}%`} tone={tone} dot />
      </View>
      <AppText variant="display">{formatCurrency(totalCost, locale)}</AppText>
      <ProgressBar value={pct} tone={tone} height={10} />
      <View style={styles.rowBetween}>
        <AppText variant="caption">{t('project.budgetTotal')}</AppText>
        <AppText variant="label">{formatCurrency(totalBudget, locale)}</AppText>
      </View>
    </AppCard>
  );
}

export function QuickActions({ items }: { items: { icon: IconName; label: string; href: Href; tone?: Tone }[] }) {
  return (
    <View style={styles.actions}>
      {items.map((a) => (
        <View key={a.label} style={styles.actionCell}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={() => router.push(a.href)}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
            <IconTile icon={a.icon} tone={a.tone ?? 'brand'} size={40} />
            <AppText variant="label" color={colors.text} numberOfLines={2}>
              {a.label}
            </AppText>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  loading,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <View>
      <SectionHeader title={title} actionLabel={actionLabel} onAction={onAction} />
      {loading ? <LoadingState rows={2} /> : children}
    </View>
  );
}

export function OverBudgetSection({ projects, loading }: { projects: Project[]; loading: boolean }) {
  const { t, locale } = useI18n();
  const alerts = overBudgetProjects(projects).slice(0, 3);
  const rows = alerts.length > 0
    ? alerts.map((project) => ({ project, overrunPct: project.overrunPct }))
    : [...projects]
        .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')))
        .slice(0, 3)
        .map((project) => ({ project, overrunPct: null as number | null }));
  return (
    <Section
      title={t(alerts.length > 0 ? 'dashboard.overBudgetProjects' : 'dashboard.recentProjects')}
      loading={loading}
      actionLabel={t('common.viewAll')}
      onAction={() => router.push('/projects')}>
      {rows.length === 0 ? (
        <AppCard style={styles.emptyNotice}>
          <View style={styles.okRow}>
            <IconTile icon="briefcase-outline" tone="info" size={36} />
            <AppText variant="small" style={{ flex: 1 }}>
              {t('project.noProjectFound')}
            </AppText>
          </View>
        </AppCard>
      ) : (
        <ListGroup>
          {rows.map(({ project, overrunPct }) => (
            <ListRow
              key={project.id}
              icon={overrunPct !== null ? 'trending-up-outline' : 'briefcase-outline'}
              iconTone={overrunPct !== null ? 'danger' : 'info'}
              title={project.name}
              subtitle={`${formatCurrency(toNumber(project.currentCost), locale)} / ${formatCurrency(toNumber(project.totalBudget), locale)}`}
              right={overrunPct !== null
                ? <StatusBadge label={`+${Math.round(overrunPct * 100)}%`} tone="danger" />
                : <StatusBadge label={projectStatusLabel(t, project.status)} tone={projectStatusTone(project.status)} />}
              onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project.id } })}
            />
          ))}
        </ListGroup>
      )}
    </Section>
  );
}

export function StockAlertsSection({ materials, loading, limit = 3 }: { materials: InventoryMaterial[]; loading: boolean; limit?: number }) {
  const { t, locale } = useI18n();
  const alerts = materials.filter((material) => {
    const stock = aggregateStock(material.inventory);
    const state = stockState(stock.quantity, stock.minThreshold, stock.maxThreshold);
    return state === 'critical' || state === 'low';
  });
  const showingAlerts = alerts.length > 0;
  const rows = (showingAlerts ? alerts : [...materials]
    .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? ''))))
    .slice(0, limit);
  return (
    <Section
      title={t(showingAlerts ? 'dashboard.lowStockMaterials' : 'dashboard.inventoryPreview')}
      loading={loading}
      actionLabel={t('common.viewAll')}
      onAction={() => router.push('/inventory')}>
      {rows.length === 0 ? (
        <AppCard>
          <View style={styles.okRow}>
            <IconTile icon="shield-checkmark-outline" tone="success" size={36} />
            <AppText variant="small" style={{ flex: 1 }}>
              {t('dashboard.stockHealthy')}
            </AppText>
          </View>
        </AppCard>
      ) : (
        <ListGroup>
          {rows.map((m) => {
            const s = aggregateStock(m.inventory);
            const state = stockState(s.quantity, s.minThreshold, s.maxThreshold);
            return (
              <ListRow
                key={m.id}
                icon="cube-outline"
                iconTone={showingAlerts ? stockStateTone(state) : 'info'}
                title={m.name}
                subtitle={`${t('common.stockLabel')}: ${formatNumber(s.quantity, locale)} ${m.unit} · ${t('common.minLabel')}: ${formatNumber(s.minThreshold, locale)}`}
                right={showingAlerts
                  ? <StatusBadge label={stockStateLabel(t, state)} tone={stockStateTone(state)} />
                  : undefined}
                onPress={() => router.push({ pathname: '/materials/[id]', params: { id: m.id } })}
              />
            );
          })}
        </ListGroup>
      )}
    </Section>
  );
}

export function OrdersInProgressSection({ orders, loading }: { orders: PurchaseOrder[]; loading: boolean }) {
  const { t, locale } = useI18n();
  const rows = orders.filter((o) => OPEN_ORDER_STATUSES.has(o.status)).slice(0, 4);
  return (
    <Section title={t('dashboard.ordersInProgress')} loading={loading} actionLabel={t('common.viewAll')} onAction={() => router.push('/costs')}>
      {rows.length === 0 ? (
        <EmptyState icon="receipt-outline" title={t('dashboard.noOrdersInProgress')} />
      ) : (
        <ListGroup>
          {rows.map((o) => (
            <ListRow
              key={o.id}
              icon="receipt-outline"
              title={`${o.orderNumber} · ${o.supplier?.name ?? '—'}`}
              subtitle={`${t('costs.expectedDelivery')}: ${formatDate(o.expectedDelivery, locale)}`}
              meta={<StatusBadge label={orderStatusLabel(t, o.status)} tone={orderStatusTone(o.status)} />}
              right={<AppText variant="label">{formatCurrency(toNumber(o.totalAmount), locale)}</AppText>}
              onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.id } })}
            />
          ))}
        </ListGroup>
      )}
    </Section>
  );
}

export function MovementsSection({ movements, loading }: { movements: StockMovementRow[]; loading: boolean }) {
  const { t, locale } = useI18n();
  return (
    <Section title={t('inventory.stockMovements')} loading={loading} actionLabel={t('common.viewAll')} onAction={() => router.push('/inventory/movements')}>
      {movements.length === 0 ? (
        <EmptyState icon="swap-horizontal-outline" title={t('inventory.noRecentMovements')} />
      ) : (
        <ListGroup>
          {movements.map((m) => (
            <ListRow
              key={m.id}
              icon={m.movement_type === 'in' ? 'arrow-down-circle-outline' : m.movement_type === 'transfer' ? 'swap-horizontal-outline' : 'arrow-up-circle-outline'}
              iconTone={movementTone(m.movement_type)}
              title={m.material?.name ?? t('inventory.unknownMaterial')}
              subtitle={formatDateTime(m.movement_date, locale)}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <AppText variant="label" color={colors.text}>{`${formatNumber(Number(m.quantity), locale)} ${m.material?.unit ?? ''}`}</AppText>
                  <StatusBadge label={movementLabel(t, m.movement_type)} tone={movementTone(m.movement_type)} />
                </View>
              }
            />
          ))}
        </ListGroup>
      )}
    </Section>
  );
}

export function ProjectsSection({ projects, loading, title }: { projects: Project[]; loading: boolean; title: string }) {
  const { t, locale } = useI18n();
  return (
    <Section title={title} loading={loading} actionLabel={t('common.viewAll')} onAction={() => router.push('/projects')}>
      {projects.length === 0 ? (
        <EmptyState icon="briefcase-outline" title={t('project.noProjectsYet')} />
      ) : (
        <ListGroup>
          {projects.map((p) => {
            const budget = toNumber(p.totalBudget);
            const usage = budget > 0 ? Math.round((toNumber(p.currentCost) / budget) * 100) : 0;
            return (
              <ListRow
                key={p.id}
                title={p.name}
                subtitle={[p.clientName, p.city].filter(Boolean).join(' · ') || undefined}
                meta={
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusBadge label={projectStatusLabel(t, p.status)} tone={projectStatusTone(p.status)} />
                      <AppText variant="caption">{formatCurrency(budget, locale)}</AppText>
                    </View>
                    <ProgressBar value={usage} tone={usage > 100 ? 'danger' : usage > 85 ? 'warning' : 'brand'} height={6} />
                  </View>
                }
                onPress={() => router.push({ pathname: '/projects/[id]', params: { id: p.id } })}
              />
            );
          })}
        </ListGroup>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 0 },
  emptyNotice: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  actionCell: { width: '50%', padding: spacing.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
