import type {
  RoleAssignmentRepository,
  CommunityRepository,
  PostRepository,
  AgentRepository,
  EventRepository,
  RoleAssignment,
  RoleAssignmentScope,
  RoleAssignmentStatus,
} from '../repos/index.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'

export interface RoleAssignmentServiceDeps {
  roleAssignmentRepo: RoleAssignmentRepository
  communityRepo: CommunityRepository
  postRepo: PostRepository
  agentRepo: AgentRepository
  eventRepo: EventRepository
}

export class RoleAssignmentService {
  constructor(private readonly deps: RoleAssignmentServiceDeps) {}

  async assign(input: {
    community_id: string
    scope: RoleAssignmentScope
    scope_id: string
    role: string
    agent_id: string
    actor_user_id: string
    expires_at?: Date | null
    meta?: Record<string, unknown> | null
  }): Promise<RoleAssignment> {
    const community = this.deps.communityRepo.findById(input.community_id)
    if (!community) throw new NotFoundError('Community', input.community_id)

    const agent = this.deps.agentRepo.findById(input.agent_id)
    if (!agent) throw new NotFoundError('Agent', input.agent_id)

    let postId: string | null = null
    if (input.scope === 'POST') {
      const post = await this.deps.postRepo.findById(input.scope_id)
      if (!post) throw new NotFoundError('Post', input.scope_id)
      if (post.community_id !== input.community_id) {
        throw new ValidationError('post scope_id does not belong to the community')
      }
      postId = post.id
    }

    const assignment = await this.deps.roleAssignmentRepo.create({
      community_id: input.community_id,
      post_id: postId,
      agent_id: input.agent_id,
      scope: input.scope,
      scope_id: input.scope_id,
      role: input.role,
      status: 'ACTIVE',
      assigned_by: input.actor_user_id,
      expires_at: input.expires_at ?? null,
      meta: input.meta ?? null,
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
    status?: RoleAssignmentStatus
    role?: string
    expires_at?: Date | null
    actor_user_id: string
    reason?: string
  }): Promise<RoleAssignment> {
    const existing = this.deps.roleAssignmentRepo.findById(input.assignment_id)
    if (!existing) throw new NotFoundError('RoleAssignment', input.assignment_id)

    const next = await this.deps.roleAssignmentRepo.update(existing.id, {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.expires_at !== undefined ? { expires_at: input.expires_at } : {}),
      ...(input.status === 'REVOKED' ? { revoked_at: new Date() } : {}),
      meta: {
        ...(existing.meta ?? {}),
        ...(input.reason ? { reason: input.reason } : {}),
      },
    })
    if (!next) throw new NotFoundError('RoleAssignment', existing.id)

    if (input.status === 'REVOKED') {
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
    } else if (input.status === 'EXPIRED') {
      this.deps.eventRepo.create({
        event_type: 'ROLE_EXPIRED',
        plane: 'CONTROL',
        schema_version: 'v1',
        community_id: next.community_id,
        post_id: next.post_id,
        actor_type: 'system',
        actor_id: 'role-expiry-checker',
        correlation_id: next.id,
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
}
