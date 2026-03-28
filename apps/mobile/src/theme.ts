import {
  MOBILE_THEMES,
  type MobileTheme,
  type MobileThemeName,
} from '@fun-forum/ui-mobile/theme'
import {
  colors as compatColors,
  fontSize as compatFontSize,
  radius as compatRadius,
  spacing as compatSpacing,
} from '@fun-forum/ui-mobile/compat'

export { MOBILE_THEMES }
export type { MobileTheme, MobileThemeName }

// New mobile code should consume semantic tokens from @fun-forum/ui-mobile/theme.
// This adapter remains only for legacy callers, and its key surface is intentionally frozen.
export const LEGACY_COLOR_ALIAS_KEYS = [
  'background',
  'surface',
  'surfaceBorder',
  'headerBg',
  'headerText',
  'headerSubtext',
  'headerBusy',
  'headerError',
  'tabBg',
  'tabDefault',
  'tabActive',
  'tabText',
  'primary',
  'primaryText',
  'secondaryBg',
  'selectedBg',
  'selectedBorder',
  'text',
  'textSecondary',
  'textMuted',
  'textOnDark',
  'inputBorder',
  'divider',
  'error',
  'disabled',
] as const

export const LEGACY_SPACING_ALIAS_KEYS = ['xs', 'sm', 'md', 'lg', 'xl'] as const
export const LEGACY_FONT_SIZE_ALIAS_KEYS = ['xs', 'sm', 'md', 'lg'] as const
export const LEGACY_RADIUS_ALIAS_KEYS = ['sm', 'md'] as const

export const colors = compatColors
export const spacing = compatSpacing
export const fontSize = compatFontSize
export const radius = compatRadius
