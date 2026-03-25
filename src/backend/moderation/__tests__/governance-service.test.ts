import { describe, it, expect } from 'vitest'
import { GovernanceService } from '../governance-service.js'
import type { GovernanceAction, GovernanceResult } from '../types.js'

describe('GovernanceService', () => {
  it('approve -> PUBLIC/APPROVED', async () => {
    const gov = new GovernanceService()
    const result = await gov.execute({
      action: 'approve',
      target_type: 'post',
      target_id: 'post-1',
      admin_user_id: 'admin-1',
    })
    expect(result.success).toBe(true)
    expect(result.new_visibility).toBe('PUBLIC')
    expect(result.new_state).toBe('APPROVED')
  })

  it('fold -> GRAY/APPROVED', async () => {
    const gov = new GovernanceService()
    const result = await gov.execute({
      action: 'fold',
      target_type: 'thread_turn',
      target_id: 'turn-1',
      admin_user_id: 'admin-1',
    })
    expect(result.new_visibility).toBe('GRAY')
    expect(result.new_state).toBe('APPROVED')
  })

  it('quarantine -> QUARANTINE/PENDING', async () => {
    const gov = new GovernanceService()
    const result = await gov.execute({
      action: 'quarantine',
      target_type: 'post',
      target_id: 'post-1',
      admin_user_id: 'admin-1',
    })
    expect(result.new_visibility).toBe('QUARANTINE')
    expect(result.new_state).toBe('PENDING')
  })

  it('reject -> QUARANTINE/REJECTED', async () => {
    const gov = new GovernanceService()
    const result = await gov.execute({
      action: 'reject',
      target_type: 'post',
      target_id: 'post-1',
      admin_user_id: 'admin-1',
    })
    expect(result.new_visibility).toBe('QUARANTINE')
    expect(result.new_state).toBe('REJECTED')
  })

  it('ban_agent succeeds (no visibility change)', async () => {
    const gov = new GovernanceService()
    const result = await gov.execute({
      action: 'ban_agent',
      target_type: 'agent',
      target_id: 'agent-bad',
      admin_user_id: 'admin-1',
      reason: 'Repeated violations',
    })
    expect(result.success).toBe(true)
    expect(result.new_visibility).toBeUndefined()
    expect(result.new_state).toBeUndefined()
  })

  it('unban_agent succeeds', async () => {
    const gov = new GovernanceService()
    const result = await gov.execute({
      action: 'unban_agent',
      target_type: 'agent',
      target_id: 'agent-redeemed',
      admin_user_id: 'admin-1',
    })
    expect(result.success).toBe(true)
  })

  it('calls onPersist callback for audit trail', async () => {
    const log: { action: GovernanceAction; result: GovernanceResult }[] = []
    const gov = new GovernanceService({
      onPersist: (action, result) => {
        log.push({ action, result })
      },
    })
    await gov.execute({
      action: 'approve',
      target_type: 'post',
      target_id: 'post-1',
      admin_user_id: 'admin-1',
      reason: 'Looks fine',
    })
    expect(log).toHaveLength(1)
    expect(log[0].action.reason).toBe('Looks fine')
    expect(log[0].result.success).toBe(true)
  })
})
