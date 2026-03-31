import type { CreateHumanUserInput, HumanUser } from './agent.js'

export type InviteCodeStatus = 'ACTIVE' | 'DISABLED'

export interface InviteCode {
  id: string
  code: string
  status: InviteCodeStatus
  max_uses: number
  used_count: number
  note: string | null
  last_used_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreateInvitedUserInput {
  invite_code_id: string
  user: CreateHumanUserInput
  now: Date
}

export type CreateInvitedUserResult =
  | { kind: 'created'; user: HumanUser }
  | { kind: 'invite_unavailable' }

