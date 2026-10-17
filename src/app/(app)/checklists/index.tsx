import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { checklistsApi } from '@/api/endpoints';
import { Banner, EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { ChipGroup, type Option } from '@/components/fields';
import { ListRow } from '@/components/layout';
import { AppText, StatusBadge, IconButton, ProgressBar } from '@/components/primitives';
import { usePermissions } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDate } from '@/lib/format';
import { CHECKLIST_TYPES } from '@/lib/labels';
import { colors, spacing } from '@/theme/tokens';

export default function ChecklistsScreen() {
  const { t, locale } = useI18n();
  const { isFieldRole } = usePermissions();
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');

  const q = useQuery({
    queryKey: ['checklists', { status, type }],
    queryFn: () => checklistsApi.list({ status: status === 'all' ? undefined : status, type: type === 'all' ? undefined : type }),
    enabled: isFieldRole,
  });

  const statusOptions: Option[] = [
    { value: 'all', label: t('common.checklistsFilterAllStatuses') },
    { value: 'in_progress', label: t('common.checklistsStatusInProgress') },
    { value: 'completed', label: t('common.checklistsStatusCompleted') },
  ];
  const typeOptions: Option[] = [
    { value: 'all', label: t('common.checklistsFilterAllTypes') },
    ...CHECKLIST_TYPES.map((c) => ({ value: c, label: t(`common.checklistsType_${c}`) })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: t('common.checklistsPageTitle'),
          headerRight: isFieldRole
            ? () => <IconButton icon="add-circle" color={colors.brand} accessibilityLabel={t('common.checklistsNewButton')} onPress={() => router.push('/checklists/new')} />
            : undefined,
        }}
      />
      {!isFieldRole ? (
        <View style={{ padding: spacing.lg }}>
          <Banner tone="warning" message={t('checklists.roleRestricted')} />
        </View>
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(c) => c.id}
          refreshing={false}
          onRefresh={() => q.refetch()}
          ListHeaderComponent={
            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <ChipGroup options={statusOptions} value={status} onChange={setStatus} />
              <ChipGroup options={typeOptions} value={type} onChange={setType} />
            </View>
          }
          renderItem={({ item: c }) => {
            const pct = c.itemsTotal > 0 ? Math.round((c.itemsChecked / c.itemsTotal) * 100) : 0;
            return (
              <ListRow
                icon={c.status === 'completed' ? 'checkmark-done-circle-outline' : 'checkbox-outline'}
                iconTone={c.status === 'completed' ? 'success' : 'brand'}
                title={c.title}
                subtitle={[t(`common.checklistsType_${c.checklistType}`), c.project?.name ?? t('common.checklistsNoProject'), formatDate(c.createdAt, locale)].join(' · ')}
                meta={
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                      <StatusBadge
                        label={c.status === 'completed' ? t('common.checklistsStatusCompleted') : t('common.checklistsStatusInProgress')}
                        tone={c.status === 'completed' ? 'success' : 'brand'}
                      />
                      <AppText variant="caption">{t('checklists.progress', { done: c.itemsChecked, total: c.itemsTotal })}</AppText>
                    </View>
                    <ProgressBar value={pct} tone={c.status === 'completed' ? 'success' : 'brand'} />
                  </View>
                }
                onPress={() => router.push({ pathname: '/checklists/[id]', params: { id: c.id } })}
              />
            );
          }}
          ListEmptyComponent={
            q.isLoading ? (
              <View style={{ paddingHorizontal: spacing.lg }}>
                <ListSkeleton rows={3} />
              </View>
            ) : q.isError ? (
              <ErrorState error={q.error} onRetry={() => q.refetch()} />
            ) : (
              <EmptyState
                icon="checkbox-outline"
                title={t('common.checklistsEmptyState')}
                actionLabel={t('common.checklistsNewButton')}
                onAction={() => router.push('/checklists/new')}
              />
            )
          }
        />
      )}
    </View>
  );
}
