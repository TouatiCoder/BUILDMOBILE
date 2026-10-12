import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActionSheetIOS, Alert, Platform, View } from 'react-native';

import { ApiError } from '@/api/client';
import { projectsApi } from '@/api/endpoints';
import { Banner, ErrorState, ListSkeleton } from '@/components/feedback';
import { ListGroup, ListRow, Screen } from '@/components/layout';
import { AppText, StatusBadge, AppButton, AppCard, Divider, KeyValue, ProgressBar, SectionHeader } from '@/components/primitives';
import { useApiMutation, useConfirm, usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDate, fullName, toNumber } from '@/lib/format';
import { PROJECT_STATUS_FLOW, projectStatusLabel, projectStatusTone, projectTypeLabel } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { can, allows } = usePermissions();
  const confirm = useConfirm();

  const project = useQuery({ queryKey: ['projects', 'detail', id], queryFn: () => projectsApi.get(id) });
  const milestones = useQuery({ queryKey: ['projects', id, 'milestones'], queryFn: () => projectsApi.milestones(id), retry: false });
  const delays = useQuery({ queryKey: ['projects', id, 'delays'], queryFn: () => projectsApi.delays(id), retry: false });

  const setStatus = useApiMutation({
    mutationFn: (status: string) => projectsApi.setStatus(id, status),
    invalidate: [['projects']],
    successMessage: t('project.updatedSuccess'),
  });
  const remove = useApiMutation({
    mutationFn: () => projectsApi.remove(id),
    invalidate: [['projects']],
    successMessage: t('project.deletedSuccess'),
    onSuccess: () => router.back(),
  });

  if (project.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('project.projectLabel') }} />
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (project.isError || !project.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('project.projectLabel') }} />
        <ErrorState error={project.error ?? new Error(t('project.notFound'))} onRetry={() => project.refetch()} />
      </Screen>
    );
  }

  const p = project.data;
  const budget = toNumber(p.totalBudget);
  const cost = toNumber(p.currentCost);
  const usage = budget > 0 ? Math.round((cost / budget) * 100) : 0;
  const currentStatus = p.status === 'in_progress' ? 'active' : p.status;
  const transitions = PROJECT_STATUS_FLOW[currentStatus] ?? [];
  // Same role list as the server route PATCH /api/projects/[id]/status.
  const canChangeStatus = allows('projects.status') && transitions.length > 0;

  const chooseStatus = () => {
    const labels = transitions.map((s) => projectStatusLabel(t, s));
    const apply = (index: number) => {
      const next = transitions[index];
      if (next) setStatus.mutate(next);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: t('projects.changeStatus'), options: [...labels, t('common.cancel')], cancelButtonIndex: labels.length },
        (i) => i < labels.length && apply(i),
      );
    } else {
      Alert.alert(t('projects.changeStatus'), undefined, [
        ...labels.map((label, i) => ({ text: label, onPress: () => apply(i) })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ]);
    }
  };

  const onDelete = async () => {
    if (await confirm({ message: `${p.name}\n${t('common.deleteIrreversible')}` })) remove.mutate();
  };

  return (
    <Screen refreshing={project.isRefetching} onRefresh={() => project.refetch()}>
      <Stack.Screen options={{ title: p.name }} />

      <AppCard style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <StatusBadge label={projectStatusLabel(t, p.status)} tone={projectStatusTone(p.status)} />
          <StatusBadge label={projectTypeLabel(t, p.projectType)} tone="neutral" />
        </View>
        <AppText variant="heading">{p.name}</AppText>
        <AppText variant="small">{p.description || t('project.noDescription')}</AppText>
      </AppCard>

      <AppCard style={{ gap: spacing.sm }}>
        <SectionHeader title={t('project.budgetSchedule')} />
        <KeyValue label={t('project.budgetTotal')} value={formatCurrency(budget, locale)} />
        <KeyValue label={t('project.currentCost')} value={formatCurrency(cost, locale)} />
        <ProgressBar value={usage} tone={usage > 100 ? 'danger' : usage > 85 ? 'warning' : 'brand'} />
        <AppText variant="caption">
          {t('project.usageLabel')} {usage}%
        </AppText>
        {usage > 100 ? <Banner tone="danger" message={`${t('project.overrunWarning')} ${usage - 100}%`} /> : null}
        <Divider />
        <KeyValue icon="calendar-outline" label={t('project.startDate')} value={formatDate(p.startDate, locale)} />
        <KeyValue icon="flag-outline" label={t('project.plannedEndDate')} value={formatDate(p.endDate, locale)} />
      </AppCard>

      <AppCard style={{ gap: spacing.xs }}>
        <SectionHeader title={t('project.projectInformation')} />
        <KeyValue icon="person-outline" label={t('project.clientName')} value={p.clientName || t('project.notDefined')} />
        <KeyValue icon="mail-outline" label={t('project.clientEmail')} value={p.clientEmail || t('project.notDefined')} />
        <KeyValue icon="call-outline" label={t('project.clientPhone')} value={p.clientPhone || t('project.notDefined')} />
        <KeyValue
          icon="location-outline"
          label={t('project.location')}
          value={[p.address, p.postalCode, p.city].filter(Boolean).join(', ') || t('project.notDefined')}
        />
      </AppCard>

      <AppCard style={{ gap: spacing.xs }}>
        <SectionHeader title={t('project.projectTeam')} />
        <KeyValue icon="construct-outline" label={t('project.siteManager')} value={fullName(p.siteManager) || t('project.notDefined')} />
        <KeyValue icon="school-outline" label={t('project.engineer')} value={fullName(p.structuralEngineer) || t('project.notDefined')} />
      </AppCard>

      <BacklogSection
        title={t('projects.milestones')}
        query={milestones}
        emptyLabel={t('projects.noMilestones')}
        render={(items) =>
          items.map((m) => (
            <ListRow key={m.id} icon="flag-outline" title={m.title} subtitle={`${formatDate(m.due_date, locale)} · ${m.status}`} />
          ))
        }
      />
      <BacklogSection
        title={t('projects.delays')}
        query={delays}
        emptyLabel={t('projects.noDelays')}
        render={(items) =>
          items.map((d) => (
            <ListRow
              key={d.id}
              icon="time-outline"
              iconTone="warning"
              title={d.reason}
              subtitle={`${d.days_delayed} ${t('inventory.daysShort')} · ${formatDate(d.created_at, locale)}`}
            />
          ))
        }
      />

      <View style={{ gap: spacing.sm }}>
        {can('edit_project') ? (
          <AppButton title={t('project.editProject')} icon="create-outline" variant="secondary" onPress={() => router.push({ pathname: '/projects/[id]/edit', params: { id } })} />
        ) : null}
        {canChangeStatus ? (
          <AppButton title={t('projects.changeStatus')} icon="swap-horizontal-outline" variant="secondary" loading={setStatus.isPending} onPress={chooseStatus} />
        ) : null}
        {can('delete_project') ? (
          <AppButton title={t('common.delete')} icon="trash-outline" variant="danger" loading={remove.isPending} onPress={onDelete} />
        ) : null}
      </View>
    </Screen>
  );
}

function BacklogSection<T>({
  title,
  query,
  emptyLabel,
  render,
}: {
  title: string;
  query: { isLoading: boolean; isError: boolean; error: unknown; data?: { items: T[] } };
  emptyLabel: string;
  render: (items: T[]) => React.ReactNode;
}) {
  const { t } = useI18n();
  let body: React.ReactNode;
  if (query.isLoading) body = <ListSkeleton rows={1} />;
  else if (query.isError) {
    // These routes use raw-SQL tables that may be absent on a given server (see PROJECT_AUDIT.md).
    const unavailable = query.error instanceof ApiError && query.error.status >= 500;
    body = <Banner tone="neutral" message={unavailable ? t('projects.backlogUnavailable') : String((query.error as Error)?.message)} />;
  } else if (!query.data || query.data.items.length === 0) body = <AppText variant="small" color={colors.textMuted}>{emptyLabel}</AppText>;
  else body = <ListGroup>{render(query.data.items)}</ListGroup>;
  return (
    <View>
      <SectionHeader title={title} />
      {body}
    </View>
  );
}
