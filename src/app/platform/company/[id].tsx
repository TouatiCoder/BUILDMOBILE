import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { platformApi } from '@/api/endpoints';
import { ReasonDialog } from '@/components/dialogs';
import { Banner, EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, IconTile, KeyValue, SectionHeader, StatusBadge } from '@/components/primitives';
import { useApiMutation, useConfirm } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDate } from '@/lib/format';
import { platformStatusLabel, platformStatusTone } from '@/lib/platform';
import { spacing } from '@/theme/tokens';

/**
 * Company detail for the super-admin. The API has no GET-by-id for platform
 * companies, so the record comes from the list endpoint, which searches by
 * name or ID. Actions: PATCH …/activate and PATCH …/suspend (reason required).
 */
export default function PlatformCompanyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const confirm = useConfirm();
  const [suspendOpen, setSuspendOpen] = useState(false);

  const q = useQuery({
    queryKey: ['platform', 'companies', 'detail', id],
    queryFn: () => platformApi.companies({ page: 1, pageSize: 10, status: 'all', search: id }),
    select: (page) => page.items.find((c) => c.id === id) ?? null,
  });

  const activate = useApiMutation({
    mutationFn: () => platformApi.activateCompany(id),
    invalidate: [['platform']],
    successMessage: t('platform.companyActivated'),
  });
  const suspend = useApiMutation({
    mutationFn: (reason: string) => platformApi.suspendCompany(id, reason),
    invalidate: [['platform']],
    successMessage: t('platform.companySuspended'),
    onSuccess: () => setSuspendOpen(false),
  });

  if (q.isLoading) {
    return (
      <Screen>
        <LoadingState rows={3} />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Screen>
    );
  }
  const c = q.data;
  if (!c) {
    return (
      <Screen>
        <EmptyState icon="business-outline" title={t('platform.companies.empty')} />
      </Screen>
    );
  }

  const isSuspended = c.status === 'suspended';

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: c.name }} />
      <AppCard elevated style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconTile icon="business" tone={platformStatusTone(c.status)} size={52} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heading">{c.name}</AppText>
            <StatusBadge label={platformStatusLabel(t, c.status)} tone={platformStatusTone(c.status)} dot />
          </View>
        </View>
      </AppCard>

      <AppCard style={{ gap: spacing.xs }}>
        <SectionHeader title={t('platform.companyDetails')} />
        <KeyValue icon="card-outline" label={t('platform.subscription')} value={
          <StatusBadge label={platformStatusLabel(t, c.subscription_status)} tone={platformStatusTone(c.subscription_status)} />
        } />
        <KeyValue icon="cash-outline" label={t('platform.lastPayment')} value={
          <StatusBadge label={platformStatusLabel(t, c.last_payment_status)} tone={platformStatusTone(c.last_payment_status)} />
        } />
        <KeyValue icon="hourglass-outline" label={t('platform.colTrial')} value={c.trial_ends_at ? formatDate(c.trial_ends_at, locale) : t('platform.shared.notAvailable')} />
        <KeyValue icon="calendar-outline" label={t('platform.createdAt')} value={formatDate(c.created_at, locale)} />
        <KeyValue icon="finger-print-outline" label={t('platform.companyId')} value={<AppText variant="caption" selectable>{c.id}</AppText>} />
      </AppCard>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t('platform.actions')} />
        {isSuspended ? (
          <AppButton
            title={t('platform.activate')}
            icon="play-circle-outline"
            size="lg"
            loading={activate.isPending}
            onPress={async () => {
              if (await confirm({ title: t('platform.activate'), message: t('platform.activateConfirm', { name: c.name }), confirmLabel: t('platform.activate'), destructive: false })) {
                activate.mutate();
              }
            }}
          />
        ) : (
          <AppButton title={t('platform.suspend')} icon="pause-circle-outline" variant="danger" size="lg" onPress={() => setSuspendOpen(true)} />
        )}
        <Banner tone="neutral" icon="globe-outline" message={t('platform.webOnlyActions')} />
      </View>

      <ReasonDialog
        visible={suspendOpen}
        title={t('platform.suspendTitle')}
        message={`${c.name} — ${t('platform.suspendHint')}`}
        placeholder={t('platform.dashboard.suspendReasonPrompt')}
        confirmLabel={t('platform.suspend')}
        required
        loading={suspend.isPending}
        onCancel={() => setSuspendOpen(false)}
        onConfirm={(reason) => suspend.mutate(reason)}
      />
    </Screen>
  );
}
