import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { platformApi } from '@/api/endpoints';
import type { PlatformCompany, PlatformCompanyFilter } from '@/api/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { ChipGroup, SearchInput, type Option } from '@/components/fields';
import { AppCard, AppText, DirectionalIcon, IconTile, StatusBadge } from '@/components/primitives';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDate } from '@/lib/format';
import { platformStatusLabel, platformStatusTone } from '@/lib/platform';
import { colors, spacing } from '@/theme/tokens';

const PAGE_SIZE = 20;
const FILTERS: PlatformCompanyFilter[] = ['all', 'active', 'suspended', 'trialing'];

/** GET /api/v1/platform/companies — search (name or ID), status filter, pagination. */
export default function PlatformCompaniesScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ status?: string }>();
  const initial = FILTERS.includes(params.status as PlatformCompanyFilter) ? (params.status as PlatformCompanyFilter) : 'all';
  const [status, setStatus] = useState<PlatformCompanyFilter>(initial);
  // The overview links here with ?status=…; follow it when the tab is already mounted.
  const [lastParam, setLastParam] = useState(params.status);
  if (params.status !== lastParam) {
    setLastParam(params.status);
    setStatus(initial);
  }
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);

  const query = useInfiniteQuery({
    queryKey: ['platform', 'companies', 'list', { status, search: debounced }],
    queryFn: ({ pageParam }) => platformApi.companies({ page: pageParam, pageSize: PAGE_SIZE, status, search: debounced || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.total_pages ? last.page + 1 : undefined),
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total;
  const options: Option<PlatformCompanyFilter>[] = [
    { value: 'all', label: t('platform.allStatuses') },
    { value: 'active', label: t('platform.statusActive') },
    { value: 'suspended', label: t('platform.statusSuspended') },
    { value: 'trialing', label: t('platform.statusTrialing') },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        <SearchInput value={search} onChangeText={setSearch} placeholder={t('platform.searchCompanies')} />
        <ChipGroup options={options} value={status} onChange={setStatus} />
        {typeof total === 'number' ? <AppText variant="caption">{t('platform.metrics.companiesCount', { count: total })}</AppText> : null}
      </View>
      {query.isLoading ? (
        <View style={styles.pad}>
          <LoadingState />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <CompanyCard company={item} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => query.refetch()}
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={<EmptyState icon="business-outline" title={t('platform.companies.empty')} />}
        />
      )}
    </View>
  );
}

function CompanyCard({ company }: { company: PlatformCompany }) {
  const { t, locale } = useI18n();
  return (
    <AppCard
      onPress={() => router.push({ pathname: '/platform/company/[id]', params: { id: company.id } })}
      accessibilityLabel={`${company.name}, ${platformStatusLabel(t, company.status)}`}
      style={{ gap: spacing.md }}>
      <View style={styles.cardTop}>
        <IconTile icon="business" tone={platformStatusTone(company.status)} size={42} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" numberOfLines={1}>
            {company.name}
          </AppText>
          <AppText variant="caption">
            {t('platform.createdAt')} {formatDate(company.created_at, locale)}
          </AppText>
        </View>
        <DirectionalIcon name="chevron-forward" />
      </View>
      <View style={styles.badges}>
        <StatusBadge label={platformStatusLabel(t, company.status)} tone={platformStatusTone(company.status)} dot />
        <StatusBadge
          label={`${t('platform.subscription')} : ${platformStatusLabel(t, company.subscription_status)}`}
          tone={platformStatusTone(company.subscription_status)}
        />
        <StatusBadge
          label={`${t('platform.lastPayment')} : ${platformStatusLabel(t, company.last_payment_status)}`}
          tone={platformStatusTone(company.last_payment_status)}
        />
      </View>
      {company.status === 'trialing' && company.trial_ends_at ? (
        <AppText variant="small" color={colors.info}>
          {t('platform.companies.trialUntil', { date: formatDate(company.trial_ends_at, locale) })}
        </AppText>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  filters: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  pad: { padding: spacing.lg },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
