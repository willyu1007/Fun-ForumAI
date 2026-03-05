import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../lib/config.js'
import { UnauthorizedError, ValidationError } from '../lib/errors.js'
import type { UserRepository } from '../repos/user-repository.js'
import type { HumanUser } from '../repos/types.js'

const BCRYPT_ROUNDS = 12

export interface AuthResult {
  user: UserProfile
  token: string
}

export interface UserProfile {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  planTier: string
  role: 'user' | 'admin'
}

function toProfile(u: HumanUser): UserProfile {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    planTier: u.plan_tier,
    role: u.plan_tier === 'ADMIN' ? 'admin' : 'user',
  }
}

export class AuthService {
  constructor(private readonly userRepo: UserRepository) {}

  async register(email: string, password: string, displayName: string): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(email)
    if (existing) {
      throw new ValidationError('该邮箱已被注册')
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await this.userRepo.create({
      email,
      password_hash: passwordHash,
      display_name: displayName,
    })

    const profile = toProfile(user)
    const token = this.generateToken(profile)
    return { user: profile, token }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(email)
    if (!user) {
      throw new UnauthorizedError('邮箱或密码错误')
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedError('账号已被停用')
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      throw new UnauthorizedError('邮箱或密码错误')
    }

    await this.userRepo.updateLastLogin(user.id)

    const profile = toProfile(user)
    const token = this.generateToken(profile)
    return { user: profile, token }
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.userRepo.findById(userId)
    return user ? toProfile(user) : null
  }

  async ensureDevIdentity(input: {
    userId: string
    email: string
    role: 'user' | 'admin'
  }): Promise<void> {
    await this.userRepo.upsertDevIdentity({
      id: input.userId,
      email: input.email,
      role: input.role,
    })
  }

  private generateToken(profile: UserProfile): string {
    const payload = { userId: profile.id, email: profile.email, role: profile.role }
    const secret: jwt.Secret = config.auth.jwtSecret
    const options: jwt.SignOptions = {
      expiresIn: config.auth.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    }
    return jwt.sign(payload, secret, options)
  }
}
