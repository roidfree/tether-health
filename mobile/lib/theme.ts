// Design tokens lifted from the "Wellnest" reference theme (see
// /Users/dameer/Downloads/App theme and style reference/wellnest-export-src.dc.html) -
// deep blue + ice palette, generous rounding, pill buttons/chips, Plus
// Jakarta Sans with an Instrument Serif italic accent for headline moments.
// Shared by every screen so the look stays consistent across account types
// (independent, managed cared-for, carer).

export const colors = {
  // Core brand blue - primary buttons, active states, banners.
  primary: '#1D5FCC',
  primaryDark: '#123E82',
  primaryDeep: '#0E2740',
  // Ice surfaces - the app's main background.
  background: '#EFF4FA',
  surface: '#FFFFFF',
  surfaceMuted: '#ECF1F7',
  // Frosted "glass" card look, approximated without a native blur module.
  glass: 'rgba(255,255,255,0.7)',
  glassBorder: 'rgba(255,255,255,0.9)',
  tint: 'rgba(143,195,255,0.25)',
  // Light blue accents.
  accent: '#8FC3FF',
  accentPale: '#BBD7F5',
  accentIce: '#E1EDFD',
  // Text.
  textPrimary: '#122A20',
  textOnPrimary: '#F2F7FD',
  textOnPrimaryMuted: '#BBD7F5',
  textMuted: '#6E85A0',
  textFaint: '#8298AD',
  border: '#D6E0EC',
  // Status.
  success: '#1D5FCC',
  warning: '#D9B23E',
  warningBg: '#F6EDD2',
  warningText: '#8A6D1D',
  danger: '#dc2626',
  missedBg: '#DEE6F0',
  missedText: '#8298AD',
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
} as const;

export const radii = {
  sm: 12,
  md: 18,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

// Shared text-input look, reused across every form screen (login, signup,
// onboarding, medication form) instead of each redefining it slightly
// differently.
export const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surface,
  borderRadius: radii.md,
  padding: 14,
  fontSize: 16,
  fontFamily: fonts.regular,
  color: colors.textPrimary,
} as const;

// Pill-shaped selectable chip, used for account type / language / day-of-week
// pickers across onboarding, settings, and the medication form.
export const chipStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surface,
  borderRadius: radii.pill,
  paddingVertical: 8,
  paddingHorizontal: 14,
  color: colors.textMuted,
  fontSize: 14,
  fontFamily: fonts.semiBold,
} as const;

export const chipSelectedStyle = {
  backgroundColor: colors.primary,
  borderColor: colors.primary,
  color: colors.textOnPrimary,
} as const;
