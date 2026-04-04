import { afterEach, describe, expect, it } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryUserRepository } from '../../repos/user-repository.js'
import { AdminUserAccessService } from '../admin-user-access-service.js'

type MutableBootstrapAdmins = {
  emails: string[]
  phones: string[]
}

function setBootstrapAdmins(input: Partial<MutableBootstrapAdmins> = {}): void {
  const bootstrapAdmins = config.auth.bootstrapAdmins as MutableBootstrapAdmins
  bootstrapAdmins.emails = [...(input.emails ?? [])]
  bootstrapAdmins.phones = [...(input.phones ?? [])]
}

describe('AdminUserAccessService', () => {
  afterEach(() => {
    setBootstrapAdmins()
  })

  it('lists admins and marks bootstrap admins', async () => {
    setBootstrapAdmins({ emails: ['root@example.com'] })

    const userRepo = new InMemoryUserRepository()
    const root = await userRepo.create({
      email: 'root@example.com',
      display_name: 'Root Admin',
      email_verified: true,
    })
    const operator = await userRepo.create({
      email: 'operator@example.com',
      display_name: 'Operator',
      email_verified: true,
    })
    await userRepo.updatePlanTier(root.id, 'ADMIN')
    await userRepo.updatePlanTier(operator.id, 'ADMIN')

    const service = new AdminUserAccessService(userRepo)

    await expect(service.listAdmins()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'root@example.com',
          planTier: 'ADMIN',
          isBootstrapAdmin: true,
        }),
        expect.objectContaining({
          email: 'operator@example.com',
          planTier: 'ADMIN',
          isBootstrapAdmin: false,
        }),
      ]),
    )
  })

  it('prevents revoking bootstrap admins and self revoke', async () => {
    setBootstrapAdmins({ emails: ['root@example.com'] })

    const userRepo = new InMemoryUserRepository()
    const root = await userRepo.create({
      email: 'root@example.com',
      display_name: 'Root Admin',
      email_verified: true,
    })
    const operator = await userRepo.create({
      email: 'operator@example.com',
      display_name: 'Operator',
      email_verified: true,
    })
    await userRepo.updatePlanTier(root.id, 'ADMIN')
    await userRepo.updatePlanTier(operator.id, 'ADMIN')

    const service = new AdminUserAccessService(userRepo)

    await expect(
      service.revokeAdmin({ targetUserId: root.id, actorUserId: operator.id }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'BOOTSTRAP_ADMIN_PROTECTED',
    })

    await expect(
      service.revokeAdmin({ targetUserId: operator.id, actorUserId: operator.id }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'SELF_REVOKE_NOT_ALLOWED',
    })
  })

  it('rejects granting admin to non-free plan tiers', async () => {
    const userRepo = new InMemoryUserRepository()
    const proUser = await userRepo.create({
      email: 'pro@example.com',
      display_name: 'Pro User',
      email_verified: true,
    })
    await userRepo.updatePlanTier(proUser.id, 'PRO')

    const service = new AdminUserAccessService(userRepo)

    await expect(service.grantAdmin({ email: 'pro@example.com' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'ADMIN_PLAN_TIER_CONFLICT',
    })
  })
})
