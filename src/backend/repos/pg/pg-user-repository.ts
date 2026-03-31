import { Prisma } from '@prisma/client'
import type { PrismaClient, HumanUser as PrismaHumanUser } from '@prisma/client'
import type { HumanUser, CreateHumanUserInput, UpsertDevHumanIdentityInput } from '../types.js'
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
    invite_code_id: row.inviteCodeId,
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

  async findByPhone(phone: string): Promise<HumanUser | null> {
    const row = await this.prisma.humanUser.findUnique({ where: { phone } })
    return row ? toDomain(row) : null
  }

  async create(input: CreateHumanUserInput): Promise<HumanUser> {
    const row = await this.prisma.humanUser.create({
      data: {
        email: input.email ?? null,
        passwordHash: input.password_hash ?? null,
        displayName: input.display_name,
        avatarUrl: input.avatar_url ?? null,
        phone: input.phone ?? null,
        emailVerified: input.email_verified ?? false,
        phoneVerified: input.phone_verified ?? false,
        inviteCodeId: input.invite_code_id ?? null,
      },
    })
    return toDomain(row)
  }

  async upsertDevIdentity(input: UpsertDevHumanIdentityInput): Promise<HumanUser> {
    const existingById = await this.prisma.humanUser.findUnique({ where: { id: input.id } })
    if (existingById) {
      const row = await this.prisma.humanUser.update({
        where: { id: input.id },
        data: {
          displayName: input.role === 'admin' ? '开发管理员' : '开发用户',
          planTier: input.role === 'admin' ? 'ADMIN' : existingById.planTier,
          status: 'ACTIVE',
          emailVerified: true,
        },
      })
      return toDomain(row)
    }

    const baseCreateData = {
      id: input.id,
      email: input.email,
      passwordHash: '__dev_token__',
      displayName: input.role === 'admin' ? '开发管理员' : '开发用户',
      avatarUrl: null,
      planTier: input.role === 'admin' ? 'ADMIN' as const : 'FREE' as const,
      status: 'ACTIVE' as const,
      emailVerified: true,
      phoneVerified: false,
    }

    try {
      const row = await this.prisma.humanUser.create({ data: baseCreateData })
      return toDomain(row)
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
        throw err
      }
    }

    const afterPrimaryConflict = await this.prisma.humanUser.findUnique({ where: { id: input.id } })
    if (afterPrimaryConflict) {
      const row = await this.prisma.humanUser.update({
        where: { id: input.id },
        data: {
          displayName: input.role === 'admin' ? '开发管理员' : '开发用户',
          planTier: input.role === 'admin' ? 'ADMIN' : afterPrimaryConflict.planTier,
          status: 'ACTIVE',
          emailVerified: true,
        },
      })
      return toDomain(row)
    }

    const existingByEmail = await this.prisma.humanUser.findUnique({ where: { email: input.email } })
    if (existingByEmail) {
      if (existingByEmail.id === input.id) {
        return toDomain(existingByEmail)
      }

      try {
        const row = await this.prisma.humanUser.create({
          data: {
            ...baseCreateData,
            email: `dev+${input.id}@local.dev`,
          },
        })
        return toDomain(row)
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
          throw err
        }
      }
    }

    // Unique conflict from a concurrent writer: retry one more time with primary key lookup.
    const afterConflict = await this.prisma.humanUser.findUnique({ where: { id: input.id } })
    if (afterConflict) return toDomain(afterConflict)

    const row = await this.prisma.humanUser.create({
      data: {
        ...baseCreateData,
        email: `dev+${input.id}@local.dev`,
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
