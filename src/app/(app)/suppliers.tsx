import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Linking, View } from 'react-native';

import { suppliersApi } from '@/api/endpoints';
import { Banner, EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { SearchInput } from '@/components/fields';
import { ListRow } from '@/components/layout';
import { IconButton } from '@/components/primitives';
import { useI18n } from '@/i18n/I18nProvider';
import { colors, spacing } from '@/theme/tokens';

/**
 * GET /api/suppliers (active suppliers). Create/update/delete exist only as
 * website server actions (app/actions/supplier-actions.ts) — read-only here.
 */
export default function SuppliersScreen() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const items = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = q.data ?? [];
    return s ? list.filter((x) => [x.name, x.contactPerson, x.email].some((v) => v?.toLowerCase().includes(s))) : list;
  }, [q.data, search]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: t('costs.supplierTitle') }} />
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Banner tone="info" message={t('suppliers.readOnly')} />
            <SearchInput value={search} onChangeText={setSearch} placeholder={t('costs.supplierSearchPlaceholder')} />
          </View>
        }
        renderItem={({ item: s }) => (
          <ListRow
            icon="storefront-outline"
            title={s.name}
            subtitle={[s.contactPerson, s.email, s.phone].filter(Boolean).join(' · ') || undefined}
            right={
              s.phone ? (
                <IconButton icon="call-outline" color={colors.brand} accessibilityLabel={`${t('costs.supplierPhone')} ${s.phone}`} onPress={() => Linking.openURL(`tel:${s.phone}`)} />
              ) : undefined
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
            <EmptyState icon="storefront-outline" title={t('costs.noSuppliersFound')} />
          )
        }
      />
    </View>
  );
}
