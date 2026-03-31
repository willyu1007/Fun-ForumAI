import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'
import { InMemoryInviteCodeRepository } from '../../repos/invite-code-repository.js'
import { InMemoryAuthVerificationChallengeRepository } from '../../repos/auth-verification-challenge-repository.js'
import { InMemoryUserRepository } from '../../repos/user-repository.js'
import { AuthService } from '../auth-service.js'

describe('AuthService', () => {
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

  it('requires an invite code for first-time sms registration but not for existing phone login', async () => {
    const userRepo = new InMemoryUserRepository()
    const inviteCodeRepo = new InMemoryInviteCodeRepository(userRepo)
    const service = new AuthService(
      userRepo,
      inviteCodeRepo,
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
    )

    await expect(service.startSmsAuth({ phone: '13800138000' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVITE_CODE_REQUIRED',
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
})
