import bcrypt from 'bcryptjs'
import { afterEach, describe, expect, it } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryInviteCodeRepository } from '../../repos/invite-code-repository.js'
import { InMemoryAuthVerificationChallengeRepository } from '../../repos/auth-verification-challenge-repository.js'
import { InMemoryUserRepository } from '../../repos/user-repository.js'
import { AdminUserAccessService } from '../admin-user-access-service.js'
import { AuthService } from '../auth-service.js'

type MutableBootstrapAdmins = {
  emails: string[]
  phones: string[]
}

function setBootstrapAdmins(input: Partial<MutableBootstrapAdmins> = {}): void {
  const bootstrapAdmins = config.auth.bootstrapAdmins as MutableBootstrapAdmins
  bootstrapAdmins.emails = [...(input.emails ?? [])]
  bootstrapAdmins.phones = [...(input.phones ?? [])]
}

describe('AuthService', () => {
  afterEach(() => {
    setBootstrapAdmins()
  })

  it('returns PASSWORD_LOGIN_UNAVAILABLE when an email account has no password hash', async () => {
    const userRepo = new InMemoryUserRepository()
    await userRepo.create({
      email: 'passwordless@example.com',
      display_name: 'Passwordless User',
      email_verified: true,
    })

    const service = new AuthService(
      userRepo,
      new InMemoryInviteCodeRepository(userRepo),
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
    )

    await expect(service.login('passwordless@example.com', 'password123')).rejects.toMatchObject({
      statusCode: 400,
      code: 'PASSWORD_LOGIN_UNAVAILABLE',
    })
  })

  it('allows first-time sms code send without an invite code but still skips invite checks for existing phones', async () => {
    const userRepo = new InMemoryUserRepository()
    const inviteCodeRepo = new InMemoryInviteCodeRepository(userRepo)
    const service = new AuthService(
      userRepo,
      inviteCodeRepo,
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
    )

    await expect(service.startSmsAuth({ phone: '13800138000' })).resolves.toMatchObject({
      challengeId: expect.any(String),
    })

    await userRepo.create({
      phone: '13800138001',
      display_name: 'Existing Phone User',
      phone_verified: true,
    })

    await expect(service.startSmsAuth({ phone: '13800138001' })).resolves.toMatchObject({
      challengeId: expect.any(String),
    })
  })

  it('returns USER_NOT_FOUND for unknown email logins', async () => {
    const service = new AuthService(
      new InMemoryUserRepository(),
      new InMemoryInviteCodeRepository(new InMemoryUserRepository()),
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
    )

    await expect(service.login('missing@example.com', 'password123')).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    })
  })

  it('treats email login and registration checks case-insensitively', async () => {
    const userRepo = new InMemoryUserRepository()
    await userRepo.create({
      email: 'casecheck@example.com',
      password_hash: await bcrypt.hash('secret123', 4),
      display_name: 'Case Check',
      email_verified: true,
    })

    const service = new AuthService(
      userRepo,
      new InMemoryInviteCodeRepository(userRepo),
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
    )

    await expect(service.login('CaseCheck@Example.com', 'secret123')).resolves.toMatchObject({
      user: { email: 'casecheck@example.com' },
    })

    await expect(
      service.startEmailRegistration({
        email: 'CaseCheck@Example.com',
        password: 'secret123',
        displayName: 'Another Case Check',
        inviteCode: '100001',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
    })
  })

  it('promotes a configured bootstrap admin during email login', async () => {
    setBootstrapAdmins({ emails: ['bootstrap@example.com'] })

    const userRepo = new InMemoryUserRepository()
    await userRepo.create({
      email: 'bootstrap@example.com',
      password_hash: await bcrypt.hash('secret123', 4),
      display_name: 'Bootstrap Admin',
      email_verified: true,
    })

    const service = new AuthService(
      userRepo,
      new InMemoryInviteCodeRepository(userRepo),
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
      new AdminUserAccessService(userRepo),
    )

    await expect(service.login('bootstrap@example.com', 'secret123')).resolves.toMatchObject({
      user: {
        email: 'bootstrap@example.com',
        role: 'admin',
        planTier: 'ADMIN',
      },
    })
  })

  it('allows a bootstrap admin email to self-bootstrap through password reset when the account does not exist yet', async () => {
    setBootstrapAdmins({ emails: ['bootstrap-reset@example.com'] })

    const userRepo = new InMemoryUserRepository()
    const service = new AuthService(
      userRepo,
      new InMemoryInviteCodeRepository(userRepo),
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
      new AdminUserAccessService(userRepo),
    )

    const start = await service.startEmailPasswordReset({ email: 'bootstrap-reset@example.com' })
    await expect(
      service.verifyEmailPasswordReset({
        challengeId: start.challengeId,
        code: start.debugCode!,
        password: 'newpassword1',
      }),
    ).resolves.toMatchObject({
      user: {
        email: 'bootstrap-reset@example.com',
        role: 'admin',
        planTier: 'ADMIN',
      },
    })
  })

  it('does not downgrade a bootstrap-configured PRO account during login', async () => {
    setBootstrapAdmins({ emails: ['pro-bootstrap@example.com'] })

    const userRepo = new InMemoryUserRepository()
    const user = await userRepo.create({
      email: 'pro-bootstrap@example.com',
      password_hash: await bcrypt.hash('secret123', 4),
      display_name: 'Bootstrap Pro',
      email_verified: true,
    })
    await userRepo.updatePlanTier(user.id, 'PRO')

    const service = new AuthService(
      userRepo,
      new InMemoryInviteCodeRepository(userRepo),
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
      new AdminUserAccessService(userRepo),
    )

    await expect(service.login('pro-bootstrap@example.com', 'secret123')).resolves.toMatchObject({
      user: {
        email: 'pro-bootstrap@example.com',
        role: 'user',
        planTier: 'PRO',
      },
    })
  })

  it('resets an existing email password through the email verification flow', async () => {
    const userRepo = new InMemoryUserRepository()
    const user = await userRepo.create({
      email: 'reset@example.com',
      password_hash: await bcrypt.hash('oldpassword1', 4),
      display_name: 'Reset User',
      email_verified: true,
    })

    const service = new AuthService(
      userRepo,
      new InMemoryInviteCodeRepository(userRepo),
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
    )

    const start = await service.startEmailPasswordReset({ email: 'reset@example.com' })
    await expect(service.login('reset@example.com', 'oldpassword1')).resolves.toMatchObject({
      user: { id: user.id },
    })

    await service.verifyEmailPasswordReset({
      challengeId: start.challengeId,
      code: start.debugCode!,
      password: 'newpassword1',
    })

    await expect(service.login('reset@example.com', 'oldpassword1')).rejects.toMatchObject({
      statusCode: 401,
    })
    await expect(service.login('reset@example.com', 'newpassword1')).resolves.toMatchObject({
      user: { id: user.id },
    })
  })

  it('allows a bootstrap admin phone to self-bootstrap without an invite code on first sms verification', async () => {
    setBootstrapAdmins({ phones: ['13800138009'] })

    const userRepo = new InMemoryUserRepository()
    const service = new AuthService(
      userRepo,
      new InMemoryInviteCodeRepository(userRepo),
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
      new AdminUserAccessService(userRepo),
    )

    const start = await service.startSmsAuth({ phone: '13800138009' })
    await expect(
      service.verifySmsAuth({
        challengeId: start.challengeId,
        code: start.debugCode!,
        displayName: 'Bootstrap Phone Admin',
      }),
    ).resolves.toMatchObject({
      isNewUser: true,
      user: {
        phone: '13800138009',
        role: 'admin',
        planTier: 'ADMIN',
      },
    })
  })
})
