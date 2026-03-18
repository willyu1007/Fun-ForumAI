/**
 * Contract manifest for runtime validation and tooling.
 */

export { UI_ROLE_MANIFEST } from './generated/contract-types'

import contractJson from '../contract/contract.json'

export const CONTRACT_META = contractJson.meta
export const CONTRACT_ROLES = contractJson.roles
