/**
 * Legacy mobile theme aliases backed by semantic token outputs.
 *
 * This file exists to keep long-lived mobile callers on a stable surface while
 * the app migrates toward direct token consumption from @fun-forum/ui-mobile/theme.
 */

import { MOBILE_THEMES } from './theme.js'

const lightTheme = MOBILE_THEMES.default_light ?? MOBILE_THEMES.base

export const colors = {
  background: lightTheme.color.bg,
  surface: lightTheme.color.surface,
  surfaceBorder: lightTheme.color.border,

  headerBg: lightTheme.color.primary,
  headerText: lightTheme.color.onPrimary ?? '#ffffff',
  headerSubtext: lightTheme.color.textSecondary,
  headerBusy: lightTheme.color.focusRing,
  headerError: lightTheme.color.danger,

  tabBg: lightTheme.color.surface,
  tabDefault: lightTheme.color.textSecondary,
  tabActive: lightTheme.color.primary,
  tabText: lightTheme.color.textPrimary,

  primary: lightTheme.color.primary,
  primaryText: lightTheme.color.onPrimary ?? '#ffffff',
  secondaryBg: lightTheme.color.surfaceElevated,
  selectedBg: lightTheme.color.surfaceElevated,
  selectedBorder: lightTheme.color.primary,

  text: lightTheme.color.textPrimary,
  textSecondary: lightTheme.color.textSecondary,
  textMuted: lightTheme.color.textMuted,
  textOnDark: lightTheme.color.onPrimary ?? '#ffffff',

  inputBorder: lightTheme.color.border,
  divider: lightTheme.color.borderSubtle,
  error: lightTheme.color.danger,

  disabled: 0.5,
} as const

export const spacing = {
  xs: lightTheme.spacing[1] / 2,
  sm: lightTheme.spacing[1],
  md: lightTheme.spacing[2],
  lg: lightTheme.spacing[3],
  xl: lightTheme.spacing[4],
} as const

export const fontSize = {
  xs: lightTheme.typography.size.caption,
  sm: lightTheme.typography.size.body,
  md: lightTheme.typography.size.bodyLg,
  lg: lightTheme.typography.size.h3,
} as const

export const radius = {
  sm: lightTheme.radius.sm,
  md: lightTheme.radius.md,
} as const
