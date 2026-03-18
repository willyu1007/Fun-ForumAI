/**
 * @fun-forum/ui-contract
 * 
 * UI contract for data-ui based rendering.
 * Source of truth: ui/contract/contract.json
 * 
 * Exports TypeScript types for roles, attributes, and slots.
 */

export type {
  UiRole,
  UiRoleAttributesMap,
  UiAttrsForRole,
  UiRoleSlotsMap,
  UiSlotsForRole,
} from './generated/contract-types'

export { UI_ROLE_MANIFEST } from './generated/contract-types'
