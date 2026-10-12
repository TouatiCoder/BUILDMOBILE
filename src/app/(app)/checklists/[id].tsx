import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { checklistsApi } from '@/api/endpoints';
import type { ChecklistDetail } from '@/api/types';
import { ErrorState, ListSkeleton } from '@/components/feedback';
import { ListGroup, Screen } from '@/components/layout';
import { AppText, StatusBadge, AppButton, AppCard, ProgressBar } from '@/components/primitives';
import { useAuth } from '@/auth/AuthProvider';
import { useApiMutation, useConfirm } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDateTime } from '@/lib/format';
import { colors, spacing, TOUCH_TARGET } from '@/theme/tokens';

export default function ChecklistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const key = ['checklists', 'detail', id];
  const q = useQuery({ queryKey: key, queryFn: () => checklistsApi.get(id) });

  // The server recomputes the checklist status after each toggle and returns
  // the updated checklist; the UI shows the server's answer, not a guess.
  const applyServer = (res: { item: ChecklistDetail }) => {
    queryClient.setQueryData(key, (prev: { item: ChecklistDetail } | undefined) => (prev ? { item: { ...prev.item, ...res.item } } : res));
  };
  const toggle = useApiMutation({
    mutationFn: (vars: { itemId: string; isChecked: boolean }) => checklistsApi.toggleItem(id, vars.itemId, vars.isChecked),
    invalidate: [['checklists']],
    onSuccess: applyServer,
  });
  const setStatus = useApiMutation({
    mutationFn: (status: 'completed' | 'in_progress') => checklistsApi.update(id, { status }),
    invalidate: [['checklists']],
    successMessage: t('common.success'),
    onSuccess: applyServer,
  });
  const remove = useApiMutation({
    mutationFn: () => checklistsApi.remove(id),
    invalidate: [['checklists']],
    successMessage: t('common.success'),
    onSuccess: () => router.back(),
  });

  if (q.isLoading) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (q.isError || !q.data) {
    return (
      <Screen>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Screen>
    );
  }

  const c = q.data.item;
  const done = c.items.filter((i) => i.isChecked).length;
  const pct = c.items.length ? Math.round((done / c.items.length) * 100) : 0;
  // DELETE /api/checklists/[id] only succeeds for the creator.
  const isCreator = c.createdBy?.id === user?.id || c.createdById === user?.id;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: c.title }} />
      <AppCard style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <StatusBadge label={t(`common.checklistsType_${c.checklistType}`)} tone="neutral" />
          <StatusBadge
            label={c.status === 'completed' ? t('common.checklistsStatusCompleted') : t('common.checklistsStatusInProgress')}
            tone={c.status === 'completed' ? 'success' : 'brand'}
          />
        </View>
        <AppText variant="heading">{c.title}</AppText>
        <AppText variant="small">{c.project?.name ?? t('common.checklistsNoProject')}</AppText>
        <ProgressBar value={pct} tone={c.status === 'completed' ? 'success' : 'brand'} />
        <AppText variant="caption">
          {t('checklists.progress', { done, total: c.items.length })}
          {c.completedAt ? ` · ${t('common.checklistsCompletedOn')} ${formatDateTime(c.completedAt, locale)}` : ''}
        </AppText>
      </AppCard>

      <ListGroup>
        {c.items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.isChecked, disabled: toggle.isPending }}
            accessibilityLabel={item.label}
            disabled={toggle.isPending}
            onPress={() => toggle.mutate({ itemId: item.id, isChecked: !item.isChecked })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              minHeight: TOUCH_TARGET + 12,
              paddingHorizontal: spacing.lg,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.border,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            })}>
            <Ionicons name={item.isChecked ? 'checkbox' : 'square-outline'} size={24} color={item.isChecked ? colors.success : colors.textMuted} />
            <AppText style={{ flex: 1, textDecorationLine: item.isChecked ? 'line-through' : 'none' }} color={item.isChecked ? colors.textMuted : colors.text}>
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </ListGroup>

      <View style={{ gap: spacing.sm }}>
        {c.status === 'completed' ? (
          <AppButton title={t('checklists.reopen')} variant="secondary" icon="refresh-outline" loading={setStatus.isPending} onPress={() => setStatus.mutate('in_progress')} />
        ) : (
          <AppButton title={t('checklists.markCompleted')} icon="checkmark-done-outline" loading={setStatus.isPending} onPress={() => setStatus.mutate('completed')} />
        )}
        {isCreator ? (
          <AppButton
            title={t('common.checklistsDeleteButton')}
            icon="trash-outline"
            variant="danger"
            loading={remove.isPending}
            onPress={async () => {
              if (await confirm({ message: `${c.title}\n${t('common.deleteIrreversible')}` })) remove.mutate();
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
