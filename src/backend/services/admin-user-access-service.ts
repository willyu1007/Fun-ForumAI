import { AppError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import type { HumanUser } from '../repos/types.js'
import type { UserRepository } from '../repos/user-repository.js'

export interface AdminUserSummary {
  id: string
  email: string | null
  phone: string | null
  displayName: string
  planTier: HumanUser['plan_tier']
  status: HumanUser['status']
  isBootstrapAdmin: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.startsWith('86') && digits.length === 13) {
    return digits.slice(2)
  }
  return digits
}

function toSummary(user: HumanUser, isBootstrapAdmin: boolean): AdminUserSummary {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.display_name,
    planTier: user.plan_tier,
    status: user.status,
    isBootstrapAdmin,
    lastLoginAt: user.last_login_at?.toISOString() ?? null,
    createdAt: user.created_at.toISOString(),
    updatedAt: user.updated_at.toISOString(),
  }
}

export class AdminUserAccessService {
  constructor(private readonly userRepo: UserRepository) {}

  async promoteBootstrapAdmin(user: HumanUser): Promise<HumanUser> {
    if (!this.isBootstrapAdmin(user) || user.plan_tier === 'ADMIN') {
      return user
    }
    if (user.plan_tier !== 'FREE') {
      return user
    }

    const promoted = await this.userRepo.updatePlanTier(user.id, 'ADMIN')
    if (!promoted) {
      throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    }
    return promoted
  }

  async listAdmins(): Promise<AdminUserSummary[]> {
    const users = await this.userRepo.listAdmins()
    return users.map((user) => toSummary(user, this.isBootstrapAdmin(user)))
  }

  async grantAdmin(input: {
    userId?: string
    email?: string
    phone?: string
  }): Promise<AdminUserSummary> {
    const user = await this.findTargetUser(input)
    if (!user) {
      throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    }
    if (user.plan_tier === 'ADMIN') {
      return toSummary(user, this.isBootstrapAdmin(user))
    }
    if (user.plan_tier !== 'FREE') {
      throw new AppError(
        409,
        '当前账号已有付费等级，现有权限模型不能直接叠加管理员权限',
        'ADMIN_PLAN_TIER_CONFLICT',
      )
    }

    const updated = await this.userRepo.updatePlanTier(user.id, 'ADMIN')
    if (!updated) {
      throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    }
    return toSummary(updated, this.isBootstrapAdmin(updated))
  }

  async revokeAdmin(input: {
    targetUserId: string
    actorUserId: string
  }): Promise<AdminUserSummary> {
    if (input.targetUserId === input.actorUserId) {
      throw new AppError(400, '不能撤销自己的管理员权限', 'SELF_REVOKE_NOT_ALLOWED')
    }

    const user = await this.userRepo.findById(input.targetUserId)
    if (!user) {
      throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    }
    if (this.isBootstrapAdmin(user)) {
      throw new AppError(409, 'bootstrap 管理员不能在后台撤销', 'BOOTSTRAP_ADMIN_PROTECTED')
    }
    if (user.plan_tier !== 'ADMIN') {
      return toSummary(user, false)
    }

    const updated = await this.userRepo.updatePlanTier(user.id, 'FREE')
    if (!updated) {
      throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
    }
    return toSummary(updated, false)
  }

  private async findTargetUser(input: {
    userId?: string
    email?: string
    phone?: string
  }): Promise<HumanUser | null> {
    if (input.userId) {
      return this.userRepo.findById(input.userId.trim())
    }
    if (input.email) {
      return this.userRepo.findByEmail(normalizeEmail(input.email))
    }
    if (input.phone) {
      return this.userRepo.findByPhone(normalizePhone(input.phone))
    }
    throw new AppError(400, '请提供用户 ID、邮箱或手机号', 'ADMIN_TARGET_REQUIRED')
  }

  private isBootstrapAdmin(user: Pick<HumanUser, 'email' | 'phone'>): boolean {
    return (
      (user.email !== null && config.auth.bootstrapAdmins.emails.includes(normalizeEmail(user.email)))
      || (user.phone !== null && config.auth.bootstrapAdmins.phones.includes(normalizePhone(user.phone)))
    )
  }
}
