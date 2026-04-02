import type { HumanUser, CreateHumanUserInput, UpsertDevHumanIdentityInput } from './types.js'

export interface UpdateHumanUserProfileInput {
  display_name?: string
  avatar_url?: string | null
}

export interface UserRepository {
  findById(id: string): Promise<HumanUser | null>
  findByEmail(email: string): Promise<HumanUser | null>
  findByPhone(phone: string): Promise<HumanUser | null>
  listAdmins(): Promise<HumanUser[]>
  create(input: CreateHumanUserInput): Promise<HumanUser>
  upsertDevIdentity(input: UpsertDevHumanIdentityInput): Promise<HumanUser>
  updatePlanTier(id: string, planTier: HumanUser['plan_tier']): Promise<HumanUser | null>
  updateProfile(id: string, input: UpdateHumanUserProfileInput): Promise<HumanUser | null>
  updateLastLogin(id: string): Promise<void>
}

let counter = 0

function cuid(): string {
  return `human_${Date.now()}_${++counter}`
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, HumanUser>()
  private readonly byEmail = new Map<string, string>()
  private readonly byPhone = new Map<string, string>()

  async findById(id: string): Promise<HumanUser | null> {
    return this.store.get(id) ?? null
  }

  async findByEmail(email: string): Promise<HumanUser | null> {
    const id = this.byEmail.get(normalizeEmail(email))
    if (!id) return null
    return this.store.get(id) ?? null
  }

  async findByPhone(phone: string): Promise<HumanUser | null> {
    const id = this.byPhone.get(phone)
    if (!id) return null
    return this.store.get(id) ?? null
  }

  async listAdmins(): Promise<HumanUser[]> {
    return Array.from(this.store.values())
      .filter((user) => user.plan_tier === 'ADMIN')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async create(input: CreateHumanUserInput): Promise<HumanUser> {
    const now = new Date()
    const user: HumanUser = {
      id: cuid(),
      email: input.email ? normalizeEmail(input.email) : null,
      password_hash: input.password_hash ?? null,
      display_name: input.display_name,
      avatar_url: input.avatar_url ?? null,
      phone: input.phone ?? null,
      wechat_open_id: null,
      email_verified: input.email_verified ?? false,
      phone_verified: input.phone_verified ?? false,
      last_login_at: null,
      plan_tier: 'FREE',
      status: 'ACTIVE',
      invite_code_id: input.invite_code_id ?? null,
      created_at: now,
      updated_at: now,
    }

    this.store.set(user.id, user)
    if (user.email) {
      this.byEmail.set(normalizeEmail(user.email), user.id)
    }
    if (user.phone) {
      this.byPhone.set(user.phone, user.id)
    }
    return user
  }

  async upsertDevIdentity(input: UpsertDevHumanIdentityInput): Promise<HumanUser> {
    const existingById = this.store.get(input.id)
    if (existingById) {
      const updated: HumanUser = {
        ...existingById,
        plan_tier: input.role === 'admin' ? 'ADMIN' : existingById.plan_tier,
        status: 'ACTIVE',
        email_verified: true,
        updated_at: new Date(),
      }
      this.store.set(updated.id, updated)
      if (updated.email) {
        this.byEmail.set(updated.email, updated.id)
      }
      return updated
    }

    const normalizedEmail = normalizeEmail(input.email)
    const idConflict = this.byEmail.get(normalizedEmail)
    const email = idConflict ? `dev+${input.id}@local.dev` : normalizedEmail
    const now = new Date()
    const user: HumanUser = {
      id: input.id,
      email,
      password_hash: '__dev_token__',
      display_name: input.role === 'admin' ? '开发管理员' : '开发用户',
      avatar_url: null,
      phone: null,
      wechat_open_id: null,
      email_verified: true,
      phone_verified: false,
      last_login_at: null,
      plan_tier: input.role === 'admin' ? 'ADMIN' : 'FREE',
      status: 'ACTIVE',
      invite_code_id: null,
      created_at: now,
      updated_at: now,
    }

    this.store.set(user.id, user)
    this.byEmail.set(normalizeEmail(email), user.id)
    return user
  }

  async updateProfile(id: string, input: UpdateHumanUserProfileInput): Promise<HumanUser | null> {
    const existing = this.store.get(id)
    if (!existing) return null

    const updated: HumanUser = {
      ...existing,
      display_name: input.display_name ?? existing.display_name,
      avatar_url: input.avatar_url !== undefined ? input.avatar_url : existing.avatar_url,
      updated_at: new Date(),
    }
    this.store.set(id, updated)
    return updated
  }

  async updatePlanTier(id: string, planTier: HumanUser['plan_tier']): Promise<HumanUser | null> {
    const existing = this.store.get(id)
    if (!existing) return null

    const updated: HumanUser = {
      ...existing,
      plan_tier: planTier,
      updated_at: new Date(),
    }
    this.store.set(id, updated)
    return updated
  }

  async updateLastLogin(id: string): Promise<void> {
    const existing = this.store.get(id)
    if (!existing) return

    const now = new Date()
    this.store.set(id, {
      ...existing,
      last_login_at: now,
      updated_at: now,
    })
  }
}
