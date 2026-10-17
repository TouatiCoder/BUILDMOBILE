import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Linking, View } from 'react-native';

import { suppliersApi } from '@/api/endpoints';
import { Banner, EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { SearchInput } from '@/components/fields';
import { ListRow } from '@/components/layout';
import { AppButton, IconButton } from '@/components/primitives';
import { useApiMutation, useConfirm } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { colors, spacing } from '@/theme/tokens';

export default function SuppliersScreen() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const remove = useApiMutation({
    mutationFn: suppliersApi.remove,
    invalidate: [['suppliers']],
    successMessage: t('suppliers.deleted'),
  });
  const items = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = q.data ?? [];
    return s ? list.filter((x) => [x.name, x.contactPerson, x.email, x.phone].some((v) => v?.toLowerCase().includes(s))) : list;
  }, [q.data, search]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: t('costs.supplierTitle'),
          headerRight: () => (
            <IconButton
              icon="add-circle-outline"
              color={colors.brand}
              accessibilityLabel={t('suppliers.add')}
              onPress={() => router.push('/suppliers/new')}
            />
          ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Banner tone="info" message={t('suppliers.readOnly')} />
            <AppButton title={t('suppliers.add')} icon="add" onPress={() => router.push('/suppliers/new')} />
            <SearchInput value={search} onChangeText={setSearch} placeholder={t('costs.supplierSearchPlaceholder')} />
          </View>
        }
        renderItem={({ item: s }) => (
          <ListRow
            icon="storefront-outline"
            title={s.name}
            subtitle={[s.contactPerson, s.email, s.phone].filter(Boolean).join(' · ') || undefined}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                {s.phone ? (
                  <IconButton icon="call-outline" color={colors.brand} accessibilityLabel={`${t('costs.supplierPhone')} ${s.phone}`} onPress={() => Linking.openURL(`tel:${s.phone}`)} />
                ) : null}
                <IconButton icon="create-outline" color={colors.brand} accessibilityLabel={t('suppliers.edit')} onPress={() => router.push({ pathname: '/suppliers/[id]/edit', params: { id: s.id } })} />
                <IconButton
                  icon="trash-outline"
                  color={colors.danger}
                  disabled={remove.isPending}
                  accessibilityLabel={t('suppliers.delete')}
                  onPress={async () => {
                    if (await confirm({ message: t('suppliers.deleteConfirm'), confirmLabel: t('suppliers.delete') })) remove.mutate(s.id);
                  }}
                />
              </View>
            }
          />
        )}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListSkeleton rows={3} />
            </View>
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : (
            <EmptyState
              icon="storefront-outline"
              title={t('costs.noSuppliersFound')}
              actionLabel={t('suppliers.add')}
              onAction={() => router.push('/suppliers/new')}
            />
          )
        }
      />
    </View>
  );
}
