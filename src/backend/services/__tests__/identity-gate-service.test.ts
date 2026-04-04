import { describe, expect, it } from 'vitest'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { InMemoryUserRepository } from '../../repos/user-repository.js'
import { IdentityGateService } from '../identity-gate-service.js'

describe('IdentityGateService', () => {
  it('blocks unverified users from creating private sessions', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    const service = new IdentityGateService({ riskRepo })

    await expect(service.assertVerified('user-1', 'private_session_create')).rejects.toThrow('实名审核')
  })

  it('allows verified users', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    await riskRepo.upsertIdentityVerification({
      user_id: 'user-2',
      status: 'VERIFIED',
      reviewed_by_user_id: 'admin-1',
    })
    const service = new IdentityGateService({ riskRepo })

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
    const service = new IdentityGateService({ riskRepo })

    await expect(service.assertVerified('user-3', 'proactive_receive')).rejects.toThrow('实名审核')
  })

  it('allows staging admin bypass for active admin users only', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    const userRepo = new InMemoryUserRepository()
    const adminUser = await userRepo.create({
      email: 'admin@example.com',
      display_name: 'Admin',
      email_verified: true,
    })
    await userRepo.updatePlanTier(adminUser.id, 'ADMIN')
    const freeUser = await userRepo.create({
      email: 'user@example.com',
      display_name: 'User',
      email_verified: true,
    })
    const service = new IdentityGateService({
      riskRepo,
      userRepo,
      appEnv: 'staging',
      stagingMode: 'admin_bypass',
    })

    await expect(service.assertVerified(adminUser.id, 'private_session_create')).resolves.toBeUndefined()
    await expect(service.assertVerified(freeUser.id, 'private_session_create')).rejects.toThrow('实名审核')
    expect(service.getRuntimeState()).toEqual({
      app_env: 'staging',
      configured_staging_mode: 'admin_bypass',
      effective_mode: 'staging_admin_bypass',
      bypass_scope: 'admin_users',
      bypass_active: true,
      gated_operations: [
        'private_session_create',
        'private_message_send',
        'proactive_receive',
      ],
    })
  })

  it('ignores admin bypass configuration outside staging', async () => {
    const riskRepo = new InMemoryRiskGovernanceRepository()
    const userRepo = new InMemoryUserRepository()
    const adminUser = await userRepo.create({
      email: 'admin@example.com',
      display_name: 'Admin',
      email_verified: true,
    })
    await userRepo.updatePlanTier(adminUser.id, 'ADMIN')
    const service = new IdentityGateService({
      riskRepo,
      userRepo,
      appEnv: 'prod',
      stagingMode: 'admin_bypass',
    })

    await expect(service.assertVerified(adminUser.id, 'proactive_receive')).rejects.toThrow('实名审核')
    expect(service.getRuntimeState()).toEqual({
      app_env: 'prod',
      configured_staging_mode: 'admin_bypass',
      effective_mode: 'enforced',
      bypass_scope: 'none',
      bypass_active: false,
      gated_operations: [
        'private_session_create',
        'private_message_send',
        'proactive_receive',
      ],
    })
  })
})
