/**
 * BuildStock Pro design tokens.
 *
 * Derived from the website (brand accent = Tailwind blue-600 used for the
 * sidebar logo tile and active navigation; neutral Tailwind gray/slate
 * surfaces). The website renders in light mode only, so the app ships a single
 * light theme. Every screen and component reads from these tokens — no ad-hoc
 * colors, sizes or shadows.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  brand: '#2563EB', // blue-600
  brandDark: '#1D4ED8', // blue-700
  brandDeep: '#1E3A8A', // blue-900 — hero backgrounds
  brandSoft: '#DBEAFE', // blue-100
  brandTint: '#EFF6FF', // blue-50

  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textOnBrand: '#FFFFFF',
  textOnBrandMuted: '#BFDBFE',

  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#0284C7',
  infoSoft: '#E0F2FE',
  violet: '#7C3AED',
  violetSoft: '#EDE9FE',

  /** Construction accent (safety yellow) used sparingly in brand illustrations. */
  safety: '#F59E0B',
  overlay: 'rgba(15,23,42,0.45)',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const font = {
  caption: 12,
  small: 13,
  body: 15,
  bodyLarge: 16,
  title: 18,
  heading: 22,
  display: 28,
  hero: 32,
} as const;

/** Named text styles; `AppText` variants map 1:1 to these. */
export const typography = {
  hero: { fontSize: font.hero, fontWeight: '800', letterSpacing: -0.6, lineHeight: 38 },
  display: { fontSize: font.display, fontWeight: '700', letterSpacing: -0.4, lineHeight: 34 },
  heading: { fontSize: font.heading, fontWeight: '700', letterSpacing: -0.2, lineHeight: 28 },
  title: { fontSize: font.title, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: font.body, lineHeight: 21 },
  bodyStrong: { fontSize: font.body, fontWeight: '600', lineHeight: 21 },
  small: { fontSize: font.small, lineHeight: 18 },
  caption: { fontSize: font.caption, lineHeight: 16 },
  label: { fontSize: font.small, fontWeight: '600', lineHeight: 18 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, lineHeight: 14 },
} satisfies Record<string, TextStyle>;

export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

/** Minimum touch target recommended by both Apple HIG and Material. */
export const TOUCH_TARGET = 44;

export const controlHeight = { sm: 36, md: 48, lg: 54 } as const;

function shadow(elevation: number, opacity: number, radiusPx: number, y: number): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation },
    default: { shadowColor: '#0F172A', shadowOpacity: opacity, shadowRadius: radiusPx, shadowOffset: { width: 0, height: y } },
  })!;
}

export const shadows = {
  none: {} as ViewStyle,
  sm: shadow(1, 0.05, 6, 2),
  md: shadow(3, 0.08, 12, 4),
  lg: shadow(8, 0.14, 24, 10),
};

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textSecondary, bg: colors.surfaceMuted },
  brand: { fg: colors.brandDark, bg: colors.brandSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  violet: { fg: colors.violet, bg: colors.violetSoft },
};
