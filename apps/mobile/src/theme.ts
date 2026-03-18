import {
  MOBILE_THEMES,
  colors as tokenColors,
  radius as tokenRadius,
  spacing as tokenSpacing,
  typography,
  type MobileTheme,
  type MobileThemeName,
} from '@fun-forum/ui-mobile/theme'

export { MOBILE_THEMES }
export type { MobileTheme, MobileThemeName }

export const colors = {
  background: tokenColors.bg,
  surface: tokenColors.surface,
  surfaceBorder: tokenColors.border,

  headerBg: tokenColors.primary,
  headerText: tokenColors.onPrimary ?? '#ffffff',
  headerSubtext: tokenColors.textSecondary,
  headerBusy: tokenColors.focusRing,
  headerError: tokenColors.danger,

  tabBg: tokenColors.surface,
  tabDefault: tokenColors.textSecondary,
  tabActive: tokenColors.primary,
  tabText: tokenColors.textPrimary,

  primary: tokenColors.primary,
  primaryText: tokenColors.onPrimary ?? '#ffffff',
  secondaryBg: tokenColors.surfaceElevated,
  selectedBg: tokenColors.surfaceElevated,
  selectedBorder: tokenColors.primary,

  text: tokenColors.textPrimary,
  textSecondary: tokenColors.textSecondary,
  textMuted: tokenColors.textMuted,
  textOnDark: tokenColors.onPrimary ?? '#ffffff',

  inputBorder: tokenColors.border,
  divider: tokenColors.borderSubtle,
  error: tokenColors.danger,

  disabled: 0.5,
} as const

export const spacing = {
  xs: tokenSpacing[1] / 2,
  sm: tokenSpacing[1],
  md: tokenSpacing[2],
  lg: tokenSpacing[3],
  xl: tokenSpacing[4],
} as const

export const fontSize = {
  xs: typography.size.caption,
  sm: typography.size.body,
  md: typography.size.bodyLg,
  lg: typography.size.h3,
} as const

export const radius = {
  sm: tokenRadius.sm,
  md: tokenRadius.md,
} as const
