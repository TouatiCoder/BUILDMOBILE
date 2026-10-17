import { useRef, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDirectionStyle } from '@/i18n/I18nProvider';
import { colors, radius, shadows, spacing, type Tone } from '@/theme/tokens';

import { KeyboardAwareScrollView, useKeyboardOverlap } from './keyboard';
import { AppText, DirectionalIcon, IconTile, type IconName } from './primitives';

/** Content width cap so tablets get a readable column instead of stretched cards. */
const MAX_CONTENT_WIDTH = 760;

/**
 * Base screen container: safe areas, tablet column, pull-to-refresh and
 * keyboard handling. Focused inputs are always scrolled into view above the
 * keyboard; with a sticky `footer` (form submit button) the whole screen is
 * lifted so the button stays visible while typing.
 * `keyboard` is kept for call-site compatibility — handling is always on.
 */
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const direction = useDirectionStyle();
  const rootRef = useRef<View>(null);
  const overlap = useKeyboardOverlap(rootRef);
  const keyboardOpen = overlap > 0;

  const inner = scroll ? (
    <KeyboardAwareScrollView
      // With a footer the root is lifted instead (see paddingBottom below).
      avoidKeyboard={!footer}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + (footer ? 0 : insets.bottom) }, contentStyle]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} /> : undefined
      }>
      <View style={styles.column}>{children}</View>
    </KeyboardAwareScrollView>
  ) : (
    <View style={[styles.flex, styles.content, contentStyle]}>
      <View style={[styles.column, styles.flex]}>{children}</View>
    </View>
  );

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={[styles.root, direction, footer && keyboardOpen ? { paddingBottom: overlap } : null]}>
      {inner}
      {footer ? <View style={[styles.footer, { paddingBottom: spacing.md + (keyboardOpen ? 0 : insets.bottom) }]}>{footer}</View> : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  meta,
  icon,
  iconTone,
  right,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  icon?: IconName;
  iconTone?: Tone;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {icon ? <IconTile icon={icon} tone={iconTone} size={40} /> : null}
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
        {meta}
      </View>
      {right}
      {onPress ? <DirectionalIcon name="chevron-forward" size={18} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}>
      {content}
    </Pressable>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: IconName;
  tone?: Tone;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <AppText variant="small" style={{ flex: 1 }} numberOfLines={2}>
          {label}
        </AppText>
        <IconTile icon={icon} tone={tone} size={32} />
      </View>
      <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {hint ? (
        <AppText variant="caption" numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
  return (
    <View style={styles.statWrap}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.statGrid}>{children}</View>;
}

/** Groups ListRows in a single rounded surface with separators. */
export function ListGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function Stack({ children, gap = spacing.lg, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/**
 * In-screen header of the design system: an eyebrow, a title and a subtitle,
 * with optional trailing actions. The `brand` variant is the blue hero used at
 * the top of the dashboard.
 */
export function AppHeader({
  title,
  subtitle,
  eyebrow,
  right,
  variant = 'plain',
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
  variant?: 'plain' | 'brand';
  children?: ReactNode;
}) {
  const brand = variant === 'brand';
  return (
    <View style={[styles.header, brand && styles.headerBrand]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 4 }}>
          {eyebrow ? (
            <AppText variant="overline" color={brand ? colors.textOnBrandMuted : colors.textMuted}>
              {eyebrow.toUpperCase()}
            </AppText>
          ) : null}
          <AppText variant={brand ? 'display' : 'heading'} color={brand ? colors.textOnBrand : colors.text} accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="small" color={brand ? colors.textOnBrandMuted : colors.textSecondary}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: spacing.lg },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 60,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  group: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  statWrap: { width: '50%', padding: spacing.xs },
  stat: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minHeight: 110,
  },
  statTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  header: { gap: spacing.md },
  headerBrand: {
    backgroundColor: colors.brandDeep,
    borderRadius: radius.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
});
