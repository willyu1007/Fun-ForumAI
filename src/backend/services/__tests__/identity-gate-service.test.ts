import { describe, expect, it } from 'vitest'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { IdentityGateService } from '../identity-gate-service.js'

describe('IdentityGateService', () => {
  it('allows unverified users outside prod', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    const service = new IdentityGateService({ riskRepo })

    await expect(service.assertVerified('user-1', 'private_session_create')).resolves.toBeUndefined()
  })

  it('allows verified users in prod', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    await riskRepo.upsertIdentityVerification({
      user_id: 'user-2',
      status: 'VERIFIED',
      reviewed_by_user_id: 'admin-1',
    })
    const service = new IdentityGateService({ riskRepo, appEnv: 'prod' })

    await expect(service.assertVerified('user-2', 'private_message_send')).resolves.toBeUndefined()
  })

  it('blocks expired verification in prod', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    await riskRepo.upsertIdentityVerification({
      user_id: 'user-3',
      status: 'VERIFIED',
      reviewed_by_user_id: 'admin-1',
      expires_at: new Date(Date.now() - 60_000),
    })
    const service = new IdentityGateService({ riskRepo, appEnv: 'prod' })

    await expect(service.assertVerified('user-3', 'proactive_receive')).rejects.toThrow('实名审核')
  })

  it('disables the gate entirely in staging', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    const service = new IdentityGateService({
      riskRepo,
      appEnv: 'staging',
    })

    await expect(service.assertVerified('user-4', 'private_session_create')).resolves.toBeUndefined()
    expect(service.getRuntimeState()).toEqual({
      app_env: 'staging',
      effective_mode: 'disabled_non_prod',
      enforced: false,
      gated_operations: [
        'private_session_create',
        'private_message_send',
        'proactive_receive',
      ],
    })
  })

  it('enforces identity verification in prod', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    const service = new IdentityGateService({
      riskRepo,
      appEnv: 'prod',
    })

    await expect(service.assertVerified('user-5', 'proactive_receive')).rejects.toThrow('实名审核')
    expect(service.getRuntimeState()).toEqual({
      app_env: 'prod',
      effective_mode: 'enforced_prod',
      enforced: true,
      gated_operations: [
        'private_session_create',
        'private_message_send',
        'proactive_receive',
      ],
    })
  })
})
