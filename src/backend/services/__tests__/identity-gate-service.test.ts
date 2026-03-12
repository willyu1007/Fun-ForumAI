import { describe, expect, it } from 'vitest'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { IdentityGateService } from '../identity-gate-service.js'

describe('IdentityGateService', () => {
  it('blocks unverified users from creating private sessions', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    const service = new IdentityGateService(riskRepo)

    await expect(service.assertVerified('user-1', 'private_session_create')).rejects.toThrow('实名审核')
  })

  it('allows verified users', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    await riskRepo.upsertIdentityVerification({
      user_id: 'user-2',
      status: 'VERIFIED',
      reviewed_by_user_id: 'admin-1',
    })
    const service = new IdentityGateService(riskRepo)

    await expect(service.assertVerified('user-2', 'private_message_send')).resolves.toBeUndefined()
  })

  it('treats expired verification as blocked', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    await riskRepo.upsertIdentityVerification({
      user_id: 'user-3',
      status: 'VERIFIED',
      reviewed_by_user_id: 'admin-1',
      expires_at: new Date(Date.now() - 60_000),
    })
    const service = new IdentityGateService(riskRepo)

    await expect(service.assertVerified('user-3', 'proactive_receive')).rejects.toThrow('实名审核')
  })
})
