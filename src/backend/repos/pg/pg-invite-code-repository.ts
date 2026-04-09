import { Prisma } from '@prisma/client'
import type { InviteCode as PrismaInviteCode, PrismaClient } from '@prisma/client'
import type {
  CreateInvitedUserInput,
  CreateInvitedUserResult,
  HumanUser,
  InviteCode,
} from '../types.js'
import type { InviteCodeRepository } from '../invite-code-repository.js'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function toInviteCodeDomain(row: PrismaInviteCode): InviteCode {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    max_uses: row.maxUses,
    used_count: row.usedCount,
    note: row.note,
    last_used_at: row.lastUsedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toHumanUserDomain(row: {
  id: string
  email: string | null
  passwordHash: string | null
  displayName: string
  avatarUrl: string | null
  birthDate: Date | null
  phone: string | null
  wechatOpenId: string | null
  emailVerified: boolean
  phoneVerified: boolean
  lastLoginAt: Date | null
  planTier: 'FREE' | 'PRO' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
  inviteCodeId: string | null
  createdAt: Date
  updatedAt: Date
}): HumanUser {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.passwordHash,
    display_name: row.displayName,
    avatar_url: row.avatarUrl,
    birth_date: row.birthDate,
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

export class PgInviteCodeRepository implements InviteCodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<InviteCode | null> {
    const row = await this.prisma.inviteCode.findUnique({ where: { id } })
    return row ? toInviteCodeDomain(row) : null
  }

  async findByCode(code: string): Promise<InviteCode | null> {
    const row = await this.prisma.inviteCode.findUnique({ where: { code } })
    return row ? toInviteCodeDomain(row) : null
  }

  async listAll(): Promise<InviteCode[]> {
    const rows = await this.prisma.inviteCode.findMany({
      orderBy: { code: 'asc' },
    })
    return rows.map(toInviteCodeDomain)
  }

  async createInvitedUser(input: CreateInvitedUserInput): Promise<CreateInvitedUserResult> {
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE "invite_codes"
          SET "used_count" = "used_count" + 1,
              "last_used_at" = ${input.now},
              "updated_at" = ${input.now}
          WHERE "id" = ${input.invite_code_id}
            AND "status" = 'ACTIVE'::"InviteCodeStatus"
            AND "used_count" < "max_uses"
          RETURNING "id"
        `

        if (updated.length === 0) {
          return null
        }

        return tx.humanUser.create({
          data: {
            email: input.user.email ? normalizeEmail(input.user.email) : null,
            passwordHash: input.user.password_hash ?? null,
            displayName: input.user.display_name,
            avatarUrl: input.user.avatar_url ?? null,
            phone: input.user.phone ?? null,
            emailVerified: input.user.email_verified ?? false,
            phoneVerified: input.user.phone_verified ?? false,
            inviteCodeId: input.invite_code_id,
          },
        })
      })

      if (!user) {
        return { kind: 'invite_unavailable' }
      }

      return { kind: 'created', user: toHumanUserDomain(user) }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw error
      }
      throw error
    }
  }
}
