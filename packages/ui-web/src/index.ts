/**
 * @fun-forum/ui-web
 * 
 * Web UI primitives and utilities.
 * Consumes design-tokens and ui-contract.
 */

// Re-export theme utilities
export { applyTheme, getTheme, THEMES, BASE_TOKENS } from '@fun-forum/design-tokens'
export type { ThemeName } from '@fun-forum/design-tokens'

// Re-export contract types
export type {
  UiRole,
  UiAttrsForRole,
  UiSlotsForRole,
} from '@fun-forum/ui-contract'

// Data-ui attribute helpers
export { dataUi, dataSlot } from './data-ui.js'

// Pattern components
export * from './patterns/index.js'

// App shell components
export * from './shell/index.js'
