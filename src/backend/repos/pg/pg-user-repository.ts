import type { PrismaClient, HumanUser as PrismaHumanUser } from '@prisma/client'
import type { HumanUser, CreateHumanUserInput } from '../types.js'
import type { UserRepository } from '../user-repository.js'

function toDomain(row: PrismaHumanUser): HumanUser {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.passwordHash,
    display_name: row.displayName,
    avatar_url: row.avatarUrl,
    phone: row.phone,
    wechat_open_id: row.wechatOpenId,
    email_verified: row.emailVerified,
    phone_verified: row.phoneVerified,
    last_login_at: row.lastLoginAt,
    plan_tier: row.planTier,
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<HumanUser | null> {
    const row = await this.prisma.humanUser.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findByEmail(email: string): Promise<HumanUser | null> {
    const row = await this.prisma.humanUser.findUnique({ where: { email } })
    return row ? toDomain(row) : null
  }

  async create(input: CreateHumanUserInput): Promise<HumanUser> {
    const row = await this.prisma.humanUser.create({
      data: {
        email: input.email,
        passwordHash: input.password_hash,
        displayName: input.display_name,
        avatarUrl: input.avatar_url ?? null,
      },
    })
    return toDomain(row)
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.humanUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    })
  }
}
