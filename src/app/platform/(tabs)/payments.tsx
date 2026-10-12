import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { platformApi } from '@/api/endpoints';
import type { ManualPayment } from '@/api/types';
import { ReasonDialog } from '@/components/dialogs';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Screen } from '@/components/layout';
import { AppButton, AppCard, AppText, Divider, IconTile, KeyValue, SectionHeader, StatusBadge } from '@/components/primitives';
import { useApiMutation, useConfirm } from '@/hooks/common';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDateTime, fullName } from '@/lib/format';
import { cadenceLabel, methodLabel, planLabel, platformStatusLabel, platformStatusTone } from '@/lib/platform';
import { spacing } from '@/theme/tokens';

/**
 * Manual (cash / PayPal) subscription payments — GET /api/platform/billing/manual-payments.
 * Confirm → POST …/confirm (the server activates the plan in a transaction);
 * Reject → POST …/reject with an optional reason. Only pending requests can be processed.
 */
export default function PlatformPaymentsScreen() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [rejecting, setRejecting] = useState<ManualPayment | null>(null);
  const q = useQuery({ queryKey: ['platform', 'manual-payments'], queryFn: platformApi.manualPayments });

  const confirmPayment = useApiMutation({
    mutationFn: platformApi.confirmPayment,
    invalidate: [['platform']],
    successMessage: t('platform.paymentConfirmed'),
  });
  const rejectPayment = useApiMutation({
    mutationFn: (vars: { id: string; reason: string | null }) => platformApi.rejectPayment(vars.id, vars.reason),
    invalidate: [['platform']],
    successMessage: t('platform.paymentRejected'),
    onSuccess: () => setRejecting(null),
  });

  const items = q.data?.items ?? [];
  const pending = items.filter((p) => p.status === 'pending');
  const history = items.filter((p) => p.status !== 'pending');

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <SectionHeader title={t('platform.manualPayments.pendingTitle')} subtitle={t('platform.manualPayments.subtitle')} />
      {q.isLoading ? (
        <LoadingState rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : pending.length === 0 ? (
        <EmptyState icon="checkmark-done-circle-outline" title={t('platform.manualPayments.noPending')} />
      ) : (
        pending.map((p) => (
          <PaymentCard key={p.id} payment={p}>
            <View style={styles.actions}>
              <AppButton
                title={t('platform.manualPayments.rejectButton')}
                variant="danger"
                icon="close-circle-outline"
                style={{ flex: 1 }}
                disabled={confirmPayment.isPending}
                onPress={() => setRejecting(p)}
              />
              <AppButton
                title={t('platform.manualPayments.confirmButton')}
                icon="checkmark-circle-outline"
                style={{ flex: 1 }}
                loading={confirmPayment.isPending && confirmPayment.variables === p.id}
                disabled={confirmPayment.isPending}
                onPress={async () => {
                  const ok = await confirm({
                    title: t('platform.manualPayments.confirmButton'),
                    message: t('platform.confirmPaymentQ', {
                      amount: formatCurrency(p.amountMad),
                      company: p.company?.name ?? '—',
                      plan: planLabel(t, p.planCode),
                    }),
                    confirmLabel: t('platform.manualPayments.confirmButton'),
                    destructive: false,
                  });
                  if (ok) confirmPayment.mutate(p.id);
                }}
              />
            </View>
          </PaymentCard>
        ))
      )}

      <SectionHeader title={t('platform.manualPayments.historyTitle')} />
      {!q.isLoading && history.length === 0 ? <AppText variant="small">{t('platform.manualPayments.noHistory')}</AppText> : null}
      {history.map((p) => (
        <PaymentCard key={p.id} payment={p} />
      ))}

      <ReasonDialog
        visible={!!rejecting}
        title={t('platform.manualPayments.rejectDialogTitle')}
        message={rejecting ? `${rejecting.company?.name ?? ''} · ${formatCurrency(rejecting.amountMad)}` : undefined}
        placeholder={t('platform.manualPayments.rejectReasonPlaceholder')}
        confirmLabel={t('platform.manualPayments.rejectButton')}
        loading={rejectPayment.isPending}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => rejecting && rejectPayment.mutate({ id: rejecting.id, reason: reason || null })}
      />
    </Screen>
  );
}

function PaymentCard({ payment: p, children }: { payment: ManualPayment; children?: React.ReactNode }) {
  const { t, locale } = useI18n();
  return (
    <AppCard elevated={p.status === 'pending'} style={{ gap: spacing.sm }}>
      <View style={styles.head}>
        <IconTile icon={p.method === 'cash' ? 'cash-outline' : 'logo-paypal'} tone={platformStatusTone(p.status)} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" numberOfLines={1}>
            {p.company?.name ?? '—'}
          </AppText>
          <AppText variant="caption">{formatDateTime(p.createdAt, locale)}</AppText>
        </View>
        <AppText variant="heading">{formatCurrency(p.amountMad, locale)}</AppText>
      </View>
      <View style={styles.badges}>
        <StatusBadge label={platformStatusLabel(t, p.status)} tone={platformStatusTone(p.status)} dot />
        <StatusBadge label={planLabel(t, p.planCode)} tone="brand" />
        <StatusBadge label={cadenceLabel(t, p.cadence)} tone="neutral" />
      </View>
      <Divider />
      <KeyValue label={t('platform.method')} value={methodLabel(t, p.method)} />
      <KeyValue label={t('platform.requestedBy')} value={fullName(p.requestedBy) || p.requestedBy?.email || '—'} />
      {p.rejectedReason ? <KeyValue label={t('platform.rejectedReason')} value={p.rejectedReason} /> : null}
      {children}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
