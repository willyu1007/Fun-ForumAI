import type { InviteCodeRepository } from '../repos/invite-code-repository.js'

export interface AdminInviteCodeSummary {
  id: string
  code: string
  status: 'ACTIVE' | 'DISABLED'
  usedCount: number
  maxUses: number
  remainingUses: number
  note: string | null
  lastUsedAt: string | null
  sharePath: string
}

export class InviteCodeService {
  constructor(private readonly inviteCodeRepo: InviteCodeRepository) {}

  async listForAdmin(): Promise<AdminInviteCodeSummary[]> {
    const inviteCodes = await this.inviteCodeRepo.listAll()
    return inviteCodes.map((inviteCode) => ({
      id: inviteCode.id,
      code: inviteCode.code,
      status: inviteCode.status,
      usedCount: inviteCode.used_count,
      maxUses: inviteCode.max_uses,
      remainingUses: Math.max(inviteCode.max_uses - inviteCode.used_count, 0),
      note: inviteCode.note,
      lastUsedAt: inviteCode.last_used_at ? inviteCode.last_used_at.toISOString() : null,
      sharePath: `/register?invite=${inviteCode.code}`,
    }))
  }
}
