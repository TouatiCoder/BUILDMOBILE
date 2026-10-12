import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useI18n } from '@/i18n/I18nProvider';
import { colors, controlHeight, iconSize, radius, shadows, spacing, toneColors, TOUCH_TARGET, typography, type Tone } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type TextVariant = keyof typeof typography;

const variantColor: Record<TextVariant, string> = {
  hero: colors.text,
  display: colors.text,
  heading: colors.text,
  title: colors.text,
  body: colors.text,
  bodyStrong: colors.text,
  small: colors.textSecondary,
  caption: colors.textMuted,
  label: colors.textSecondary,
  overline: colors.textMuted,
};

export function AppText({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; color?: string }) {
  return <Text {...rest} style={[typography[variant] as TextStyle, { color: color ?? variantColor[variant] }, style]} />;
}

/** Chevrons/arrows that must point the other way in Arabic (RTL). */
export function DirectionalIcon({ name, size = iconSize.md, color = colors.textMuted }: { name: IconName; size?: number; color?: string }) {
  const { rtl } = useI18n();
  return <Ionicons name={name} size={size} color={color} style={rtl ? { transform: [{ scaleX: -1 }] } : undefined} />;
}

export function AppCard({
  children,
  style,
  padded = true,
  elevated = false,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const base = [styles.card, elevated ? shadows.md : shadows.sm, padded && styles.cardPadded, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onBrand';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonPalette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand, fg: colors.textOnBrand, border: colors.brand },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.brand, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.dangerSoft },
  onBrand: { bg: colors.surface, fg: colors.brandDark, border: colors.surface },
};

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Trailing icon; directional icons are mirrored in RTL. */
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const p = buttonPalette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { minHeight: controlHeight[size], paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg },
        { backgroundColor: p.bg, borderColor: p.border },
        variant === 'primary' && !isDisabled && shadows.sm,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={iconSize.md} color={p.fg} /> : null}
          <Text style={[typography.bodyStrong, size === 'lg' && { fontSize: 16 }, { color: p.fg }]} numberOfLines={1}>
            {title}
          </Text>
          {iconRight ? <DirectionalIcon name={iconRight} size={iconSize.md} color={p.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = colors.text,
  disabled,
  badge,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  disabled?: boolean;
  /** Optional unread count shown as a dot. */
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }, disabled && styles.disabled]}>
      <Ionicons name={icon} size={iconSize.lg - 2} color={color} />
      {badge ? <View style={styles.iconBadge} /> : null}
    </Pressable>
  );
}

/** Colored status chip (project, order, stock state…). */
export function StatusBadge({ label, tone = 'neutral', dot = false }: { label: string; tone?: Tone; dot?: boolean }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: c.fg }]} /> : null}
      <Text style={[typography.caption, styles.badgeText, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, tone = 'brand', height = 8 }: { value: number; tone?: Tone; height?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      style={[styles.progressTrack, { height }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: toneColors[tone].fg }]} />
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  /** Custom trailing node. */
  action?: ReactNode;
  /** Or a standard "see all" link. */
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? <AppText variant="small">{subtitle}</AppText> : null}
      </View>
      {action}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.sectionAction}>
          <AppText variant="label" color={colors.brand}>
            {actionLabel}
          </AppText>
          <DirectionalIcon name="chevron-forward" size={iconSize.sm} color={colors.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function KeyValue({ label, value, icon }: { label: string; value: ReactNode; icon?: IconName }) {
  return (
    <View style={styles.kv}>
      {icon ? <Ionicons name={icon} size={iconSize.md - 2} color={colors.textMuted} style={{ marginTop: 1 }} /> : null}
      <AppText variant="small" style={styles.kvLabel}>
        {label}
      </AppText>
      <View style={styles.kvValue}>
        {typeof value === 'string' || typeof value === 'number' ? <AppText variant="bodyStrong">{value}</AppText> : value}
      </View>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function IconTile({ icon, tone = 'brand', size = 40 }: { icon: IconName; tone?: Tone; size?: number }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.iconTile, { backgroundColor: c.bg, width: size, height: size, borderRadius: size / 3.2 }]}>
      <Ionicons name={icon} size={size * 0.5} color={c.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardPadded: { padding: spacing.lg },
  pressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.5 },
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  iconBadge: {
    position: 'absolute',
    top: 10,
    end: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontWeight: '600' },
  progressTrack: { borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: TOUCH_TARGET - 12 },
  kv: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm, gap: spacing.sm },
  kvLabel: { flexShrink: 0, maxWidth: '45%' },
  kvValue: { flex: 1, alignItems: 'flex-end' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  iconTile: { alignItems: 'center', justifyContent: 'center' },
});
