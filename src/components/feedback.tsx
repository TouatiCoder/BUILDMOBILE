import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { ApiError } from '@/api/client';
import { useI18n } from '@/i18n/I18nProvider';
import { colors, radius, spacing, toneColors, type Tone } from '@/theme/tokens';

import { AppText, AppButton, type IconName } from './primitives';

export function useErrorMessage() {
  const { t } = useI18n();
  return (error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.kind === 'network') return t('network.offline');
      if (error.kind === 'timeout') return t('network.timeout');
      if (error.status === 403 && (!error.message || /forbidden|unauthori[sz]ed|permission/i.test(error.message))) {
        return t('network.forbidden');
      }
      if (error.status >= 500 && (!error.message || error.message.startsWith('HTTP '))) {
        return t('network.server', { status: error.status });
      }
      return error.message;
    }
    return error instanceof Error ? error.message : String(error);
  };
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: DimensionValue; style?: object }) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[{ height, width, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, opacity }, style]}
    />
  );
}

/** Card-shaped placeholders shown while a list loads for the first time. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel="loading">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
          <Skeleton width="80%" height={12} style={{ marginTop: spacing.sm }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Loading state of the design system: skeleton cards for lists (default) or a
 * centered spinner with an optional label for full-screen waits.
 */
export function LoadingState({ variant = 'list', rows = 4, label }: { variant?: 'list' | 'spinner'; rows?: number; label?: string }) {
  if (variant === 'list') return <ListSkeleton rows={rows} />;
  return (
    <View style={styles.empty} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.brand} />
      {label ? <AppText variant="small">{label}</AppText> : null}
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.textMuted} />
      </View>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="small" style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <AppButton title={actionLabel} onPress={onAction} size="sm" style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const describe = useErrorMessage();
  return (
    <View style={styles.empty} accessibilityRole="alert">
      <View style={[styles.emptyIcon, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
      </View>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {t('common.loadingErrorTitle')}
      </AppText>
      <AppText variant="small" style={{ textAlign: 'center' }}>
        {describe(error)}
      </AppText>
      {onRetry ? <AppButton title={t('common.retry')} icon="refresh" onPress={onRetry} size="sm" variant="secondary" /> : null}
    </View>
  );
}

export function Banner({ message, tone = 'info', icon }: { message: string; tone?: Tone; icon?: IconName }) {
  const c = toneColors[tone];
  const fallbackIcon: IconName = tone === 'danger' ? 'alert-circle-outline' : tone === 'warning' ? 'warning-outline' : 'information-circle-outline';
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      <Ionicons name={icon ?? fallbackIcon} size={18} color={c.fg} style={{ marginTop: 1 }} />
      <AppText variant="small" color={c.fg} style={{ flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  banner: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
});
