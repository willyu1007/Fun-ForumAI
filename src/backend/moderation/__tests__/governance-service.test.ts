import { describe, it, expect } from 'vitest'
import { GovernanceService } from '../governance-service.js'
import type { GovernanceAction, GovernanceResult } from '../types.js'

describe('GovernanceService', () => {
  it('approve → PUBLIC/APPROVED', () => {
    const gov = new GovernanceService()
    const r = gov.execute({
      action: 'approve',
      target_type: 'post',
      target_id: 'post-1',
      admin_user_id: 'admin-1',
    })
    expect(r.success).toBe(true)
    expect(r.new_visibility).toBe('PUBLIC')
    expect(r.new_state).toBe('APPROVED')
  })

  it('fold → GRAY/APPROVED', () => {
    const gov = new GovernanceService()
    const r = gov.execute({
      action: 'fold',
      target_type: 'comment',
      target_id: 'comment-1',
      admin_user_id: 'admin-1',
    })
    expect(r.new_visibility).toBe('GRAY')
    expect(r.new_state).toBe('APPROVED')
  })

  it('quarantine → QUARANTINE/PENDING', () => {
    const gov = new GovernanceService()
    const r = gov.execute({
      action: 'quarantine',
      target_type: 'post',
      target_id: 'post-1',
      admin_user_id: 'admin-1',
    })
    expect(r.new_visibility).toBe('QUARANTINE')
    expect(r.new_state).toBe('PENDING')
  })

  it('reject → QUARANTINE/REJECTED', () => {
    const gov = new GovernanceService()
    const r = gov.execute({
      action: 'reject',
      target_type: 'post',
      target_id: 'post-1',
      admin_user_id: 'admin-1',
    })
    expect(r.new_visibility).toBe('QUARANTINE')
    expect(r.new_state).toBe('REJECTED')
  })

  it('ban_agent succeeds (no visibility change)', () => {
    const gov = new GovernanceService()
    const r = gov.execute({
      action: 'ban_agent',
      target_type: 'agent',
      target_id: 'agent-bad',
      admin_user_id: 'admin-1',
      reason: 'Repeated violations',
    })
    expect(r.success).toBe(true)
    expect(r.new_visibility).toBeUndefined()
    expect(r.new_state).toBeUndefined()
  })

  it('unban_agent succeeds', () => {
    const gov = new GovernanceService()
    const r = gov.execute({
      action: 'unban_agent',
      target_type: 'agent',
      target_id: 'agent-redeemed',
      admin_user_id: 'admin-1',
    })
    expect(r.success).toBe(true)
  })

  it('calls onPersist callback for audit trail', () => {
    const log: { action: GovernanceAction; result: GovernanceResult }[] = []
    const gov = new GovernanceService({
      onPersist: (action, result) => log.push({ action, result }),
    })
    gov.execute({
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
