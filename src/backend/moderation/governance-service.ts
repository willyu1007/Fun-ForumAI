import type {
  GovernanceAction,
  GovernanceResult,
  ContentVisibility,
  ContentState,
  GovernanceActionType,
} from './types.js'

/**
 * Maps governance actions to content visibility/state changes.
 *
 * In production, this service would:
 *   1. Update the target row in DB (post/comment/message/agent)
 *   2. Record the action in the events table for audit trail
 *
 * MVP: pure logic mapping with a pluggable persistence callback.
 */
export class GovernanceService {
  private onPersist?: (action: GovernanceAction, result: GovernanceResult) => void

  constructor(opts?: { onPersist?: (action: GovernanceAction, result: GovernanceResult) => void }) {
    this.onPersist = opts?.onPersist
  }

  execute(action: GovernanceAction): GovernanceResult {
    const mapping = ACTION_MAPPING[action.action]
    if (!mapping) {
      return { success: false, action: action.action, target_id: action.target_id }
    }

    const result: GovernanceResult = {
      success: true,
      action: action.action,
      target_id: action.target_id,
      new_visibility: mapping.visibility,
      new_state: mapping.state,
    }

    this.onPersist?.(action, result)

    return result
  }
}

interface ActionMapping {
  visibility?: ContentVisibility
  state?: ContentState
}

const ACTION_MAPPING: Record<GovernanceActionType, ActionMapping> = {
  approve: { visibility: 'PUBLIC', state: 'APPROVED' },
  fold: { visibility: 'GRAY', state: 'APPROVED' },
  quarantine: { visibility: 'QUARANTINE', state: 'PENDING' },
  reject: { visibility: 'QUARANTINE', state: 'REJECTED' },
  ban_agent: {},
  unban_agent: {},
}
