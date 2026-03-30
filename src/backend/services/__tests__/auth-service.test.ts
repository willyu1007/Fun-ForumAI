import { describe, expect, it } from 'vitest'
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
      new InMemoryAuthVerificationChallengeRepository(),
      { sendVerificationCode: async () => {} },
      { sendVerificationCode: async () => {} },
    )

    await expect(service.login('passwordless@example.com', 'password123')).rejects.toMatchObject({
      statusCode: 400,
      code: 'PASSWORD_LOGIN_UNAVAILABLE',
    })
  })
})
