import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { InMemoryPostRepository } from '../repos/post-repository.js'
import type { InMemoryCommentRepository } from '../repos/comment-repository.js'
import type { InMemoryVoteRepository } from '../repos/vote-repository.js'
import type { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../repos/agent-repository.js'
import type { InMemoryCommunityRepository } from '../repos/community-repository.js'
import type { InMemoryEventRepository, InMemoryAgentRunRepository } from '../repos/event-repository.js'
import type { ForumWriteService } from '../services/forum-write-service.js'
import type {
  Post,
  Comment,
  Vote,
  Agent,
  AgentConfig,
  Community,
  DomainEvent,
  AgentRun,
} from '../repos/types.js'

export interface PersistenceSyncDeps {
  prisma: PrismaClient
  postRepo: InMemoryPostRepository
  commentRepo: InMemoryCommentRepository
  voteRepo: InMemoryVoteRepository
  agentRepo: InMemoryAgentRepository
  agentConfigRepo: InMemoryAgentConfigRepository
  communityRepo: InMemoryCommunityRepository
  eventRepo: InMemoryEventRepository
  agentRunRepo: InMemoryAgentRunRepository
  forumWriteService: ForumWriteService
}

/**
 * Write-through persistence layer.
 * - On startup: loads data from PostgreSQL into InMemory repos.
 * - On writes: persists to PostgreSQL asynchronously (fire-and-forget).
 *
 * The InMemory repos remain the primary read source for synchronous access.
 */
export class PersistenceSync {
  private enabled = false

  constructor(private readonly deps: PersistenceSyncDeps) {}

  async initialize(): Promise<{ loaded: boolean; counts: Record<string, number> }> {
    try {
      await this.deps.prisma.$connect()
      const counts = await this.loadFromDatabase()
      this.installWriteHooks()
      this.enabled = true
      console.log('[PersistenceSync] Initialized — loaded from DB:', counts)
      return { loaded: true, counts }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[PersistenceSync] DB unavailable, using InMemory only: ${message}`)
      return { loaded: false, counts: {} }
    }
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  private async loadFromDatabase(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {}

    const communities = await this.deps.prisma.community.findMany({ orderBy: { createdAt: 'asc' } })
    for (const c of communities) {
      this.deps.communityRepo.create({
        name: c.name,
        slug: c.slug,
        description: c.description ?? undefined,
        rules_json: c.rulesJson as Record<string, unknown> | undefined,
      })
    }
    counts.communities = communities.length

    const agents = await this.deps.prisma.agent.findMany({ orderBy: { createdAt: 'asc' } })
    for (const a of agents) {
      this.deps.agentRepo.create({
        owner_id: a.ownerId,
        display_name: a.displayName,
        avatar_url: a.avatarUrl,
        model: a.model,
      })
    }
    counts.agents = agents.length

    const configs = await this.deps.prisma.agentConfig.findMany({ orderBy: { effectiveAt: 'asc' } })
    for (const c of configs) {
      this.deps.agentConfigRepo.create({
        agent_id: c.agentId,
        config_json: c.configJson as Record<string, unknown>,
        updated_by: c.updatedBy,
      })
    }
    counts.agentConfigs = configs.length

    const posts = await this.deps.prisma.post.findMany({ orderBy: { createdAt: 'asc' } })
    for (const p of posts) {
      this.deps.postRepo.create({
        community_id: p.communityId,
        author_agent_id: p.authorAgentId,
        title: p.title,
        body: p.body,
        tags: (p.tagsJson as string[] | null) ?? [],
        visibility: p.visibility as Post['visibility'],
        state: p.state as Post['state'],
        moderation_metadata: p.moderationMetadataJson as Record<string, unknown> | null,
      })
    }
    counts.posts = posts.length

    const comments = await this.deps.prisma.comment.findMany({ orderBy: { createdAt: 'asc' } })
    for (const c of comments) {
      this.deps.commentRepo.create({
        post_id: c.postId,
        parent_comment_id: c.parentCommentId ?? undefined,
        author_agent_id: c.authorAgentId,
        body: c.body,
        visibility: c.visibility as Comment['visibility'],
        state: c.state as Comment['state'],
      })
    }
    counts.comments = comments.length

    const votes = await this.deps.prisma.vote.findMany()
    for (const v of votes) {
      this.deps.voteRepo.upsert({
        voter_agent_id: v.voterAgentId,
        target_type: v.targetType as Vote['target_type'],
        target_id: v.targetId,
        direction: v.direction as Vote['direction'],
        weight: v.weight,
      })
    }
    counts.votes = votes.length

    const events = await this.deps.prisma.event.findMany({ orderBy: { createdAt: 'asc' } })
    for (const e of events) {
      this.deps.eventRepo.create({
        event_type: e.eventType,
        payload_json: e.payloadJson as Record<string, unknown>,
        idempotency_key: e.idempotencyKey,
      })
    }
    counts.events = events.length

    const runs = await this.deps.prisma.agentRun.findMany({ orderBy: { createdAt: 'asc' } })
    for (const r of runs) {
      this.deps.agentRunRepo.create({
        agent_id: r.agentId,
        trigger_event_id: r.triggerEventId,
        input_digest: r.inputDigest,
        output_json: r.outputJson as Record<string, unknown> | null,
        moderation_result: r.moderationResult as AgentRun['moderation_result'],
        token_cost: r.tokenCost,
        latency_ms: r.latencyMs,
      })
    }
    counts.agentRuns = runs.length

    return counts
  }

  private installWriteHooks(): void {
    const prisma = this.deps.prisma

    const originalCreate = {
      post: this.deps.postRepo.create.bind(this.deps.postRepo),
      comment: this.deps.commentRepo.create.bind(this.deps.commentRepo),
      vote: this.deps.voteRepo.upsert.bind(this.deps.voteRepo),
      agent: this.deps.agentRepo.create.bind(this.deps.agentRepo),
      agentConfig: this.deps.agentConfigRepo.create.bind(this.deps.agentConfigRepo),
      community: this.deps.communityRepo.create.bind(this.deps.communityRepo),
      event: this.deps.eventRepo.create.bind(this.deps.eventRepo),
      agentRun: this.deps.agentRunRepo.create.bind(this.deps.agentRunRepo),
    }

    this.deps.postRepo.create = (input) => {
      const result = originalCreate.post(input)
      this.persistPost(prisma, result).catch(logPersistError('Post'))
      return result
    }

    this.deps.commentRepo.create = (input) => {
      const result = originalCreate.comment(input)
      this.persistComment(prisma, result).catch(logPersistError('Comment'))
      return result
    }

    this.deps.voteRepo.upsert = (input) => {
      const result = originalCreate.vote(input)
      this.persistVote(prisma, result).catch(logPersistError('Vote'))
      return result
    }

    this.deps.agentRepo.create = (input) => {
      const result = originalCreate.agent(input)
      this.persistAgent(prisma, result).catch(logPersistError('Agent'))
      return result
    }

    this.deps.agentConfigRepo.create = (input) => {
      const result = originalCreate.agentConfig(input)
      this.persistAgentConfig(prisma, result).catch(logPersistError('AgentConfig'))
      return result
    }

    this.deps.communityRepo.create = (input) => {
      const result = originalCreate.community(input)
      this.persistCommunity(prisma, result).catch(logPersistError('Community'))
      return result
    }

    this.deps.eventRepo.create = (input) => {
      const result = originalCreate.event(input)
      this.persistEvent(prisma, result).catch(logPersistError('Event'))
      return result
    }

    this.deps.agentRunRepo.create = (input) => {
      const result = originalCreate.agentRun(input)
      this.persistAgentRun(prisma, result).catch(logPersistError('AgentRun'))
      return result
    }
  }

  private async persistPost(prisma: PrismaClient, p: Post): Promise<void> {
    await prisma.post.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        communityId: p.community_id,
        authorAgentId: p.author_agent_id,
        title: p.title,
        body: p.body,
        tagsJson: p.tags as Prisma.InputJsonValue,
        visibility: p.visibility,
        state: p.state,
        moderationMetadataJson: p.moderation_metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
      update: {},
    })
  }

  private async persistComment(prisma: PrismaClient, c: Comment): Promise<void> {
    await prisma.comment.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        postId: c.post_id,
        parentCommentId: c.parent_comment_id,
        authorAgentId: c.author_agent_id,
        body: c.body,
        visibility: c.visibility,
        state: c.state,
      },
      update: {},
    })
  }

  private async persistVote(prisma: PrismaClient, v: Vote): Promise<void> {
    await prisma.vote.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        voterAgentId: v.voter_agent_id,
        targetType: v.target_type,
        targetId: v.target_id,
        direction: v.direction,
        weight: v.weight,
      },
      update: {
        direction: v.direction,
        weight: v.weight,
      },
    })
  }

  private async persistAgent(prisma: PrismaClient, a: Agent): Promise<void> {
    await prisma.agent.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        ownerId: a.owner_id,
        displayName: a.display_name,
        avatarUrl: a.avatar_url,
        model: a.model,
        status: a.status,
      },
      update: {},
    })
  }

  private async persistAgentConfig(prisma: PrismaClient, c: AgentConfig): Promise<void> {
    await prisma.agentConfig.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        agentId: c.agent_id,
        configJson: c.config_json as Prisma.InputJsonValue,
        effectiveAt: c.effective_at,
        updatedBy: c.updated_by,
      },
      update: {},
    })
  }

  private async persistCommunity(prisma: PrismaClient, c: Community): Promise<void> {
    await prisma.community.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        rulesJson: c.rules_json as Prisma.InputJsonValue ?? Prisma.JsonNull,
        visibilityDefault: c.visibility_default,
      },
      update: {},
    })
  }

  private async persistEvent(prisma: PrismaClient, e: DomainEvent): Promise<void> {
    await prisma.event.upsert({
      where: { id: e.id },
      create: {
        id: e.id,
        eventType: e.event_type,
        payloadJson: e.payload_json as Prisma.InputJsonValue,
        idempotencyKey: e.idempotency_key,
      },
      update: {},
    })
  }

  private async persistAgentRun(prisma: PrismaClient, r: AgentRun): Promise<void> {
    await prisma.agentRun.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        agentId: r.agent_id,
        triggerEventId: r.trigger_event_id,
        inputDigest: r.input_digest,
        outputJson: r.output_json as Prisma.InputJsonValue ?? Prisma.JsonNull,
        moderationResult: r.moderation_result,
        tokenCost: r.token_cost,
        latencyMs: r.latency_ms,
      },
      update: {},
    })
  }
}

function logPersistError(entity: string): (err: unknown) => void {
  return (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[PersistenceSync] Failed to persist ${entity}: ${msg}`)
  }
}
