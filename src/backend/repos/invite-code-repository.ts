import type {
  CreateInvitedUserInput,
  CreateInvitedUserResult,
  HumanUser,
  InviteCode,
} from './types.js'
import type { UserRepository } from './user-repository.js'

export interface InviteCodeRepository {
  findById(id: string): Promise<InviteCode | null>
  findByCode(code: string): Promise<InviteCode | null>
  listAll(): Promise<InviteCode[]>
  createInvitedUser(input: CreateInvitedUserInput): Promise<CreateInvitedUserResult>
}

const FIXED_INVITE_CODES = [
  '100001',
  '100002',
  '100003',
  '100004',
  '100005',
  '100006',
  '100007',
  '100008',
  '100009',
  '100010',
] as const

function cloneInviteCode(inviteCode: InviteCode): InviteCode {
  return { ...inviteCode }
}

function buildSeedInviteCode(code: string, index: number): InviteCode {
  const now = new Date()
  return {
    id: `invite-seed-${code}`,
    code,
    status: 'ACTIVE',
    max_uses: 500,
    used_count: 0,
    note: `灰测种子邀请码 ${String(index + 1).padStart(2, '0')}`,
    last_used_at: null,
    created_at: now,
    updated_at: now,
  }
}

export class InMemoryInviteCodeRepository implements InviteCodeRepository {
  private readonly store = new Map<string, InviteCode>()
  private readonly byCode = new Map<string, string>()

  constructor(private readonly userRepo: UserRepository) {
    FIXED_INVITE_CODES.forEach((code, index) => {
      const inviteCode = buildSeedInviteCode(code, index)
      this.store.set(inviteCode.id, inviteCode)
      this.byCode.set(inviteCode.code, inviteCode.id)
    })
  }

  async findById(id: string): Promise<InviteCode | null> {
    const inviteCode = this.store.get(id)
    return inviteCode ? cloneInviteCode(inviteCode) : null
  }

  async findByCode(code: string): Promise<InviteCode | null> {
    const id = this.byCode.get(code)
    if (!id) return null
    return this.findById(id)
  }

  async listAll(): Promise<InviteCode[]> {
    return Array.from(this.store.values())
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((inviteCode) => cloneInviteCode(inviteCode))
  }

  async createInvitedUser(input: CreateInvitedUserInput): Promise<CreateInvitedUserResult> {
    const inviteCode = this.store.get(input.invite_code_id)
    if (!inviteCode || inviteCode.status !== 'ACTIVE' || inviteCode.used_count >= inviteCode.max_uses) {
      return { kind: 'invite_unavailable' }
    }

    const user = await this.userRepo.create({
      ...input.user,
      invite_code_id: inviteCode.id,
    })

    const updatedInviteCode: InviteCode = {
      ...inviteCode,
      used_count: inviteCode.used_count + 1,
      last_used_at: input.now,
      updated_at: input.now,
    }
    this.store.set(inviteCode.id, updatedInviteCode)
    return { kind: 'created', user: toUserClone(user) }
  }
}

function toUserClone(user: HumanUser): HumanUser {
  return {
    ...user,
    created_at: new Date(user.created_at),
    updated_at: new Date(user.updated_at),
    last_login_at: user.last_login_at ? new Date(user.last_login_at) : null,
  }
}
