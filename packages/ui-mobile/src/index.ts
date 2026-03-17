/**
 * @fun-forum/ui-mobile
 * 
 * Mobile UI primitives and theme for React Native.
 * Consumes design-tokens and ui-contract.
 */

// Re-export mobile theme
export {
  MOBILE_THEMES,
  colors,
  spacing,
  radius,
  typography,
} from './theme'

export type { MobileTheme, MobileThemeName } from './theme'

// Re-export contract types
export type {
  UiRole,
  UiAttrsForRole,
  UiSlotsForRole,
} from '@fun-forum/ui-contract'
