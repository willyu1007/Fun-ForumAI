import type {
  RoleAssignmentRepository,
  CommunityRepository,
  PostRepository,
  AgentRepository,
  AgentCommunityMembershipRepository,
  EventRepository,
  RoleAssignment,
  RoleAssignmentScope,
  RoleAssignmentStatus,
} from '../repos/index.js'
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js'
import { resolveStageSpecFromRules } from '../stage/index.js'

export interface RoleAssignmentServiceDeps {
  roleAssignmentRepo: RoleAssignmentRepository
  communityRepo: CommunityRepository
  postRepo: PostRepository
  agentRepo: AgentRepository
  membershipRepo: AgentCommunityMembershipRepository
  eventRepo: EventRepository
}

export class RoleAssignmentService {
  constructor(private readonly deps: RoleAssignmentServiceDeps) {}

  private assertRoleDefinedByStageSpec(input: {
    community_id: string
    role: string
    rules_json: Record<string, unknown> | null
  }): void {
    const role = input.role.trim()
    const stageResolved = resolveStageSpecFromRules(input.rules_json, {
      community_id: input.community_id,
    })
    if (!Object.prototype.hasOwnProperty.call(stageResolved.stage_spec.roles, role)) {
      throw new ValidationError(`role "${role}" is not defined in stage_spec_v1.roles`)
    }
  }

  async assign(input: {
    community_id: string
    scope: RoleAssignmentScope
    scope_id: string
    role: string
    agent_id: string
    actor_user_id: string
    expires_at?: Date | null
  }): Promise<RoleAssignment> {
    const community = this.deps.communityRepo.findById(input.community_id)
    if (!community) throw new NotFoundError('Community', input.community_id)
    const role = input.role.trim()
    this.assertRoleDefinedByStageSpec({
      community_id: input.community_id,
      role,
      rules_json: (community.rules_json ?? null) as Record<string, unknown> | null,
    })

    const agent = this.deps.agentRepo.findById(input.agent_id)
    if (!agent) throw new NotFoundError('Agent', input.agent_id)

    const membership = this.deps.membershipRepo.findCurrent(input.agent_id, input.community_id)
    if (!membership || membership.left_at) {
      throw new AppError(
        409,
        'Agent must have ACTIVE membership before role assignment',
        'CONFLICT',
      )
    }
    if (membership.status !== 'ACTIVE') {
      throw new AppError(
        409,
        `Membership status ${membership.status} cannot be assigned role`,
        'CONFLICT',
      )
    }

    let postId: string | null = null
    if (input.scope === 'COMMUNITY') {
      if (input.scope_id !== input.community_id) {
        throw new ValidationError('scope_id must match community_id when scope is COMMUNITY')
      }
    } else if (input.scope === 'POST') {
      const post = await this.deps.postRepo.findById(input.scope_id)
      if (!post) throw new NotFoundError('Post', input.scope_id)
      if (post.community_id !== input.community_id) {
        throw new ValidationError('post scope_id does not belong to the community')
      }
      postId = post.id

      const stageResolved = resolveStageSpecFromRules(
        (community.rules_json ?? null) as Record<string, unknown> | null,
        { community_id: input.community_id },
      )
      const maxSeats = stageResolved.stage_spec.allocator.thread_max_agents
      const currentSeats = this.deps.roleAssignmentRepo.listActiveByScope('POST', postId)
      if (currentSeats.length >= maxSeats) {
        throw new ValidationError(
          `post aside seat capacity reached (${currentSeats.length}/${maxSeats})`,
        )
      }
    }

    const assignment = await this.deps.roleAssignmentRepo.create({
      community_id: input.community_id,
      post_id: postId,
      agent_id: input.agent_id,
      scope: input.scope,
      scope_id: input.scope_id,
      role,
      status: 'ACTIVE',
      assigned_by: input.actor_user_id,
      expires_at: input.expires_at ?? null,
    })

    this.deps.eventRepo.create({
      event_type: 'ROLE_ASSIGNED',
      plane: 'CONTROL',
      schema_version: 'v1',
      community_id: input.community_id,
      post_id: postId,
      actor_type: 'human',
      actor_id: input.actor_user_id,
      correlation_id: assignment.id,
      payload_json: {
        assignment_id: assignment.id,
        scope: assignment.scope,
        scope_id: assignment.scope_id,
        role: assignment.role,
        agent_id: assignment.agent_id,
        expires_at: assignment.expires_at?.toISOString() ?? null,
      },
    })

    return assignment
  }

  async update(input: {
    assignment_id: string
    community_id?: string
    expected_current_status?: RoleAssignmentStatus
    status?: RoleAssignmentStatus
    role?: string
    expires_at?: Date | null
    actor_user_id: string
    reason?: string
  }): Promise<RoleAssignment> {
    const existing = this.deps.roleAssignmentRepo.findById(input.assignment_id)
    if (!existing) throw new NotFoundError('RoleAssignment', input.assignment_id)
    if (input.community_id && existing.community_id !== input.community_id) {
      throw new NotFoundError('RoleAssignment', input.assignment_id)
    }
    const role = input.role?.trim()
    if (role !== undefined) {
      const community = this.deps.communityRepo.findById(existing.community_id)
      if (!community) throw new NotFoundError('Community', existing.community_id)
      this.assertRoleDefinedByStageSpec({
        community_id: existing.community_id,
        role,
        rules_json: (community.rules_json ?? null) as Record<string, unknown> | null,
      })
    }

    const transitionedToRevoked = input.status === 'REVOKED' && existing.status !== 'REVOKED'
    const transitionedToExpired = input.status === 'EXPIRED' && existing.status !== 'EXPIRED'

    const next = await this.deps.roleAssignmentRepo.update(existing.id, {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.expected_current_status !== undefined ? { expected_status: input.expected_current_status } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(input.expires_at !== undefined ? { expires_at: input.expires_at } : {}),
      ...(transitionedToRevoked ? { revoked_at: new Date() } : {}),
      ...(input.reason !== undefined
        ? { last_action_reason: input.reason }
        : {}),
    })
    if (!next) {
      const latest = this.deps.roleAssignmentRepo.findById(existing.id)
      if (latest) return latest
      throw new NotFoundError('RoleAssignment', existing.id)
    }

    if (transitionedToRevoked) {
      this.deps.eventRepo.create({
        event_type: 'ROLE_REVOKED',
        plane: 'CONTROL',
        schema_version: 'v1',
        community_id: next.community_id,
        post_id: next.post_id,
        actor_type: 'human',
        actor_id: input.actor_user_id,
        correlation_id: next.id,
        payload_json: {
          assignment_id: next.id,
          reason: input.reason ?? null,
        },
      })
    } else if (transitionedToExpired) {
      const actorType = input.actor_user_id === 'role-expiry-scheduler' ? 'system' : 'human'
      this.deps.eventRepo.create({
        event_type: 'ROLE_EXPIRED',
        plane: 'CONTROL',
        schema_version: 'v1',
        community_id: next.community_id,
        post_id: next.post_id,
        actor_type: actorType,
        actor_id: input.actor_user_id,
        correlation_id: next.id,
        idempotency_key: `role-expired:${next.id}:${next.updated_at.getTime()}`,
        payload_json: {
          assignment_id: next.id,
          reason: input.reason ?? null,
        },
      })
    }

    return next
  }

  listAsideSeatsByPost(postId: string): RoleAssignment[] {
    return this.deps.roleAssignmentRepo.listActiveByScope('POST', postId)
  }

  async processDueExpirations(input: {
    now?: Date
    limit?: number
  } = {}): Promise<{ processed: number }> {
    const now = input.now ?? new Date()
    const limit = Math.max(1, input.limit ?? 100)
    const due = await this.deps.roleAssignmentRepo.listDueForExpiration(now, limit)
    let processed = 0

    for (const assignment of due) {
      const updated = await this.update({
        assignment_id: assignment.id,
        community_id: assignment.community_id,
        expected_current_status: 'ACTIVE',
        status: 'EXPIRED',
        actor_user_id: 'role-expiry-scheduler',
      })
      if (updated.status === 'EXPIRED') {
        processed += 1
      }
    }

    return { processed }
  }
}
