import { randomUUID } from 'node:crypto'
import type { GuidanceResolvedActor } from '../guidance/guidance-types.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { PostRepository } from '../repos/post-repository.js'
import { ValidationError } from '../lib/errors.js'
import type { GuidanceOrchestrator } from '../guidance/guidance-orchestrator.js'
import type { GuidanceStateService } from '../guidance/guidance-state-service.js'

export type DevGuidanceScenarioId =
  | 'RECENT_ACTIVITY_BASELINE'
  | 'NO_AGENT_BOOTSTRAP'
  | 'UNREAD_RECEIPT_READY'
  | 'FIRST_PRIVATE_CHAT_BLOCKER'
  | 'PUBLIC_EFFECT_READY'

export interface DevGuidanceScenarioApplyResult {
  scenario: DevGuidanceScenarioId
  actor_id: string
  actor_type: GuidanceResolvedActor['actor_type']
  latest_owner_agent_id: string | null
  latest_receipt_session_id: string | null
}

function sortAgentsNewestFirst(ownerAgents: ReturnType<AgentRepository['findByOwner']>) {
  return ownerAgents
    .slice()
    .sort(
      (left, right) =>
        right.created_at.getTime() - left.created_at.getTime() || right.id.localeCompare(left.id),
    )
}

async function resolveOwnerPostId(
  postRepo: PostRepository,
  agentId: string,
): Promise<string | null> {
  const posts = await postRepo.findByAuthor(agentId, { limit: 1 })
  return posts.items[0]?.id ?? null
}

async function ensureOwnerAgent(
  agentRepo: AgentRepository,
  actorId: string,
) {
  const ownedAgents = sortAgentsNewestFirst(agentRepo.findByOwner(actorId))
  if (ownedAgents[0]) {
    return ownedAgents[0]
  }

  const displayName = `Guidance Dev Agent ${actorId.slice(0, 6)}`
  if (agentRepo.createPersisted) {
    return agentRepo.createPersisted({
      owner_id: actorId,
      display_name: displayName,
    })
  }

  return agentRepo.create({
    owner_id: actorId,
    display_name: displayName,
  })
}

async function ensureCommunity(
  communityRepo: CommunityRepository,
) {
  const existing = communityRepo.findAll({ limit: 1 }).items[0]
  if (existing) {
    return existing
  }

  const slug = `dev-guidance-${Date.now()}`
  if (communityRepo.createPersisted) {
    return communityRepo.createPersisted({
      name: 'Dev Guidance Lab',
      slug,
      description: 'Auto-created guidance debug community.',
    })
  }

  return communityRepo.create({
    name: 'Dev Guidance Lab',
    slug,
    description: 'Auto-created guidance debug community.',
  })
}

async function ensureOwnerPublicPost(input: {
  postRepo: PostRepository
  communityRepo: CommunityRepository
  agentId: string
}): Promise<string> {
  const existingPostId = await resolveOwnerPostId(input.postRepo, input.agentId)
  if (existingPostId) {
    return existingPostId
  }

  const community = await ensureCommunity(input.communityRepo)
  const post = await input.postRepo.create({
    community_id: community.id,
    author_agent_id: input.agentId,
    title: 'Guidance Dev Public Effect',
    body: 'Auto-created public post for guidance UI debugging.',
    tags: ['guidance-dev'],
    visibility: 'PUBLIC',
    state: 'APPROVED',
  })
  return post.id
}

export async function applyDevGuidanceScenario(input: {
  actor: GuidanceResolvedActor
  scenario: DevGuidanceScenarioId
  agentRepo: AgentRepository
  communityRepo: CommunityRepository
  postRepo: PostRepository
  stateService: GuidanceStateService
  orchestrator: GuidanceOrchestrator
  now?: Date
}): Promise<DevGuidanceScenarioApplyResult> {
  const now = input.now ?? new Date()
  const actor = input.actor

  if (actor.actor_type !== 'USER') {
    throw new ValidationError('Guidance dev scenarios require an authenticated user actor')
  }

  await input.stateService.resetActor(actor)
  await input.orchestrator.prepareActor(actor)

  if (input.scenario === 'RECENT_ACTIVITY_BASELINE' || input.scenario === 'NO_AGENT_BOOTSTRAP') {
    const state = await input.stateService.getOrCreateActorState(actor)
    return {
      scenario: input.scenario,
      actor_id: actor.actor_id,
      actor_type: actor.actor_type,
      latest_owner_agent_id: state.latest_owner_agent_id,
      latest_receipt_session_id: state.latest_receipt_session_id,
    }
  }

  const ownerAgent = await ensureOwnerAgent(input.agentRepo, actor.actor_id)

  if (input.scenario === 'FIRST_PRIVATE_CHAT_BLOCKER') {
    const state = await input.stateService.saveActorState(actor, {
      agent_created_at: now,
      latest_owner_agent_id: ownerAgent.id,
    })
    return {
      scenario: input.scenario,
      actor_id: actor.actor_id,
      actor_type: actor.actor_type,
      latest_owner_agent_id: state.latest_owner_agent_id,
      latest_receipt_session_id: state.latest_receipt_session_id,
    }
  }

  const sessionId = `dev-guidance-${input.scenario.toLowerCase()}-${randomUUID()}`

  if (input.scenario === 'UNREAD_RECEIPT_READY') {
    await input.stateService.saveActorState(actor, {
      agent_created_at: new Date(now.getTime() - 90 * 60_000),
      private_session_created_at: new Date(now.getTime() - 70 * 60_000),
      private_session_ended_at: new Date(now.getTime() - 60 * 60_000),
      latest_owner_agent_id: ownerAgent.id,
      latest_receipt_session_id: sessionId,
    })
    await input.orchestrator.ingestEvent(actor, 'PRIVATE_DIGEST_READY', {
      agent_id: ownerAgent.id,
      session_id: sessionId,
    })
  } else if (input.scenario === 'PUBLIC_EFFECT_READY') {
    const postId = await ensureOwnerPublicPost({
      postRepo: input.postRepo,
      communityRepo: input.communityRepo,
      agentId: ownerAgent.id,
    })
    await input.stateService.saveActorState(actor, {
      agent_created_at: new Date(now.getTime() - 6 * 60 * 60_000),
      private_session_created_at: new Date(now.getTime() - 5 * 60 * 60_000),
      private_session_ended_at: new Date(now.getTime() - 4 * 60 * 60_000),
      nurture_receipt_ready_at: new Date(now.getTime() - 3 * 60 * 60_000),
      latest_owner_agent_id: ownerAgent.id,
      latest_receipt_session_id: sessionId,
    })
    await input.orchestrator.ingestEvent(actor, 'OWNER_AGENT_PUBLIC_EVENT', {
      agent_id: ownerAgent.id,
      post_id: postId,
      target_url: `/posts/${postId}`,
    })
  }

  const state = await input.stateService.getOrCreateActorState(actor)
  return {
    scenario: input.scenario,
    actor_id: actor.actor_id,
    actor_type: actor.actor_type,
    latest_owner_agent_id: state.latest_owner_agent_id,
    latest_receipt_session_id: state.latest_receipt_session_id,
  }
}
