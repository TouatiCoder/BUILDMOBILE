import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n/I18nProvider';
import { colors, radius, shadows, spacing } from '@/theme/tokens';

import { AppText } from './primitives';

/**
 * BuildStock Pro logo tile — same mark as the website sidebar (building glyph
 * on the blue-600 tile), with a light ring so it also reads on dark heroes.
 */
export function LogoTile({ size = 56 }: { size?: number }) {
  return (
    <View
      style={[styles.ring, { width: size + 10, height: size + 10, borderRadius: (size + 10) * 0.3 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.28 }, shadows.md]}>
        <Ionicons name="business" size={size * 0.52} color={colors.textOnBrand} />
      </View>
    </View>
  );
}

export function BrandMark({ size = 56, showName = true }: { size?: number; showName?: boolean }) {
  const { t } = useI18n();
  return (
    <View style={styles.wrap} accessibilityRole="header" accessibilityLabel={t('common.appName')}>
      <LogoTile size={size} />
      {showName ? (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <AppText variant="heading">{t('auth.login.title')}</AppText>
          <AppText variant="small">{t('auth.login.subtitle')}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const GRID_STEP = 28;
const GRID_LINES = 40;

/**
 * Subtle "blueprint" background for the brand screens: a faint technical grid,
 * a safety-yellow hazard stripe and large low-contrast construction glyphs.
 * Purely decorative — hidden from screen readers.
 */
export function BlueprintBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: GRID_LINES }).map((_, i) => (
        <View key={`v${i}`} style={[styles.gridV, { left: i * GRID_STEP }, i % 4 === 0 && styles.gridStrong]} />
      ))}
      {Array.from({ length: GRID_LINES }).map((_, i) => (
        <View key={`h${i}`} style={[styles.gridH, { top: i * GRID_STEP }, i % 4 === 0 && styles.gridStrong]} />
      ))}
      <Ionicons name="construct-outline" size={180} color="rgba(255,255,255,0.05)" style={styles.glyphA} />
      <Ionicons name="business-outline" size={220} color="rgba(255,255,255,0.04)" style={styles.glyphB} />
      <View style={styles.hazard}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View key={i} style={styles.hazardStripe} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md },
  ring: { backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  tile: { backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(191,219,254,0.10)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(191,219,254,0.10)' },
  gridStrong: { backgroundColor: 'rgba(191,219,254,0.18)' },
  glyphA: { position: 'absolute', top: 40, right: -40, transform: [{ rotate: '-12deg' }] },
  glyphB: { position: 'absolute', top: 180, left: -70 },
  hazard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.safety,
    opacity: 0.9,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  hazardStripe: { width: 14, height: 12, marginRight: 14, backgroundColor: colors.brandDeep, transform: [{ skewX: '-35deg' }] },
});
