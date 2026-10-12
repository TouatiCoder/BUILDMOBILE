import { useInfiniteQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { projectsApi } from '@/api/endpoints';
import type { Project } from '@/api/types';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { ChipGroup, SearchInput, type Option } from '@/components/fields';
import { AppText, StatusBadge, IconButton, ProgressBar } from '@/components/primitives';
import { usePermissions } from '@/hooks/common';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDate, toNumber } from '@/lib/format';
import { projectStatusLabel, projectStatusTone, PROJECT_STATUSES } from '@/lib/labels';
import { colors, radius, spacing } from '@/theme/tokens';

const PAGE_SIZE = 20;

export default function ProjectsScreen() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const debounced = useDebouncedValue(search);

  const query = useInfiniteQuery({
    queryKey: ['projects', 'list', { search: debounced, status }],
    queryFn: ({ pageParam }) => projectsApi.list({ search: debounced || undefined, status, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length + 1 : undefined),
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.projects) ?? [], [query.data]);
  const statusOptions: Option[] = [
    { value: 'all', label: t('common.allStatus') },
    ...PROJECT_STATUSES.map((s) => ({ value: s, label: projectStatusLabel(t, s) })),
  ];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerRight: can('create_project')
            ? () => (
                <IconButton icon="add-circle" color={colors.brand} accessibilityLabel={t('project.newProject')} onPress={() => router.push('/projects/new')} />
              )
            : undefined,
        }}
      />
      <View style={styles.filters}>
        <SearchInput value={search} onChangeText={setSearch} />
        <ChipGroup options={statusOptions} value={status} onChange={setStatus} />
      </View>
      {query.isLoading ? (
        <View style={styles.pad}>
          <ListSkeleton />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProjectCard project={item} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => query.refetch()}
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="briefcase-outline"
              title={t('project.noProjectFound')}
              actionLabel={can('create_project') ? t('project.newProject') : undefined}
              onAction={() => router.push('/projects/new')}
            />
          }
        />
      )}
    </View>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const { t, locale } = useI18n();
  const budget = toNumber(project.totalBudget);
  const cost = toNumber(project.currentCost);
  const usage = budget > 0 ? Math.round((cost / budget) * 100) : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${projectStatusLabel(t, project.status)}`}
      onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project.id } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.cardTop}>
        <AppText variant="title" style={{ flex: 1 }} numberOfLines={2}>
          {project.name}
        </AppText>
        <StatusBadge label={projectStatusLabel(t, project.status)} tone={projectStatusTone(project.status)} />
      </View>
      {project.clientName || project.city ? (
        <AppText variant="small">{[project.clientName, project.city].filter(Boolean).join(' · ')}</AppText>
      ) : null}
      <View style={styles.row}>
        <AppText variant="caption">{t('project.budget')}</AppText>
        <AppText variant="caption">
          {formatCurrency(cost, locale)} / {formatCurrency(budget, locale)}
        </AppText>
      </View>
      <ProgressBar value={usage} tone={usage > 100 ? 'danger' : usage > 85 ? 'warning' : 'brand'} />
      <AppText variant="caption">
        {t('project.startDateShort')}: {formatDate(project.startDate, locale)} · {t('project.plannedEndShort')}: {formatDate(project.endDate, locale)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  filters: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  pad: { padding: spacing.lg },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
});
