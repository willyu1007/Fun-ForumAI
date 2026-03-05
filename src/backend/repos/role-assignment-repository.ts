import type {
  RoleAssignment,
  RoleAssignmentScope,
  CreateRoleAssignmentInput,
  UpdateRoleAssignmentInput,
} from './types.js'

export interface RoleAssignmentRepository {
  create(input: CreateRoleAssignmentInput): Promise<RoleAssignment>
  update(id: string, input: UpdateRoleAssignmentInput): Promise<RoleAssignment | null>
  findById(id: string): RoleAssignment | null
  listActiveByScope(scope: RoleAssignmentScope, scopeId: string): RoleAssignment[]
  listByPost(postId: string): RoleAssignment[]
  findPrimaryForAgent(input: {
    agent_id: string
    community_id: string
    post_id?: string | null
  }): RoleAssignment | null
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

function isActive(row: RoleAssignment, now = new Date()): boolean {
  if (row.status !== 'ACTIVE') return false
  if (row.expires_at && row.expires_at.getTime() <= now.getTime()) return false
  return true
}

export class InMemoryRoleAssignmentRepository implements RoleAssignmentRepository {
  private rows = new Map<string, RoleAssignment>()

  async create(input: CreateRoleAssignmentInput): Promise<RoleAssignment> {
    const now = new Date()
    const row: RoleAssignment = {
      id: cuid('role'),
      community_id: input.community_id,
      post_id: input.post_id ?? null,
      agent_id: input.agent_id,
      scope: input.scope,
      scope_id: input.scope_id,
      role: input.role,
      status: input.status ?? 'ACTIVE',
      assigned_by: input.assigned_by ?? null,
      expires_at: input.expires_at ?? null,
      revoked_at: input.revoked_at ?? null,
      meta: input.meta ?? null,
      created_at: now,
      updated_at: now,
    }
    this.rows.set(row.id, row)
    return row
  }

  async update(id: string, input: UpdateRoleAssignmentInput): Promise<RoleAssignment | null> {
    const row = this.rows.get(id)
    if (!row) return null
    if (input.role !== undefined) row.role = input.role
    if (input.status !== undefined) row.status = input.status
    if (input.expires_at !== undefined) row.expires_at = input.expires_at
    if (input.revoked_at !== undefined) row.revoked_at = input.revoked_at
    if (input.meta !== undefined) row.meta = input.meta
    row.updated_at = new Date()
    this.rows.set(row.id, row)
    return row
  }

  findById(id: string): RoleAssignment | null {
    return this.rows.get(id) ?? null
  }

  listActiveByScope(scope: RoleAssignmentScope, scopeId: string): RoleAssignment[] {
    const now = new Date()
    return Array.from(this.rows.values())
      .filter((row) => row.scope === scope && row.scope_id === scopeId && isActive(row, now))
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  listByPost(postId: string): RoleAssignment[] {
    return Array.from(this.rows.values())
      .filter((row) => row.post_id === postId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  findPrimaryForAgent(input: {
    agent_id: string
    community_id: string
    post_id?: string | null
  }): RoleAssignment | null {
    const now = new Date()
    const postScoped = input.post_id
      ? Array.from(this.rows.values()).find((row) =>
        row.agent_id === input.agent_id
        && row.scope === 'POST'
        && row.scope_id === input.post_id
        && row.community_id === input.community_id
        && isActive(row, now))
      : null
    if (postScoped) return postScoped
    return Array.from(this.rows.values()).find((row) =>
      row.agent_id === input.agent_id
      && row.scope === 'COMMUNITY'
      && row.scope_id === input.community_id
      && row.community_id === input.community_id
      && isActive(row, now)) ?? null
  }
}
