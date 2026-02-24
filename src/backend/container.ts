import { InMemoryPostRepository } from './repos/post-repository.js'
import { InMemoryCommentRepository } from './repos/comment-repository.js'
import { InMemoryVoteRepository } from './repos/vote-repository.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from './repos/agent-repository.js'
import { InMemoryCommunityRepository } from './repos/community-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from './repos/event-repository.js'
import { InMemoryRoomRepository } from './repos/room-repository.js'
import { InMemoryMessageRepository } from './repos/message-repository.js'

import type { PostRepository } from './repos/post-repository.js'
import type { CommentRepository } from './repos/comment-repository.js'
import type { VoteRepository } from './repos/vote-repository.js'
import type { AgentRepository, AgentConfigRepository } from './repos/agent-repository.js'
import type { CommunityRepository } from './repos/community-repository.js'
import type { EventRepository, AgentRunRepository } from './repos/event-repository.js'
import type { RoomRepository } from './repos/room-repository.js'
import type { MessageRepository } from './repos/message-repository.js'

import { ForumReadService } from './services/forum-read-service.js'
import { ForumWriteService } from './services/forum-write-service.js'
import { AgentService } from './services/agent-service.js'
import { GovernanceAdapter } from './services/governance-adapter.js'

import { ModerationService } from './moderation/moderation-service.js'
import { DefaultRuleFilter } from './moderation/rule-filter.js'
import { KeywordRiskClassifier } from './moderation/risk-classifier.js'
import { DefaultDecisionEngine } from './moderation/decision-engine.js'

import {
  InMemoryEventQueue,
  EventAllocator,
  InMemoryAdmissionGate,
  DefaultQuotaCalculator,
  DefaultCandidateSelector,
  InMemoryAllocationLock,
  DefaultDegradationMonitor,
  DEFAULT_ALLOCATOR_CONFIG,
} from './allocator/index.js'
import type { AgentCandidate, AgentRepository as AllocatorAgentRepo } from './allocator/types.js'

import { LlmClient } from './llm/llm-client.js'
import { PromptEngine } from './llm/prompt-engine.js'

import { ContextBuilder } from './runtime/context-builder.js'
import { ResponseParser } from './runtime/response-parser.js'
import { DataPlaneWriter } from './runtime/data-plane-writer.js'
import { AgentExecutor } from './runtime/agent-executor.js'
import { RuntimeLoop } from './runtime/runtime-loop.js'
import { EventBridge } from './runtime/event-bridge.js'
import { PostScheduler } from './runtime/post-scheduler.js'

import { ChatService } from './services/chat-service.js'
import { RoomLifecycleManager } from './services/room-lifecycle.js'
import { ConversationClock } from './services/conversation-clock.js'
import { AuthService } from './services/auth-service.js'
import type { UserRepository } from './repos/user-repository.js'

import { SseHub } from './sse/hub.js'

import { config } from './lib/config.js'

// ─── Repositories ───────────────────────────────────────────

interface HydratableRepo { hydrate(): Promise<void> }

let postRepo: PostRepository
let commentRepo: CommentRepository
let agentRepo: AgentRepository
let agentConfigRepo: AgentConfigRepository
let eventRepo: EventRepository
let agentRunRepo: AgentRunRepository
let roomRepo: RoomRepository
let messageRepo: MessageRepository
let userRepo: UserRepository | null = null
export let voteRepo: VoteRepository
export let communityRepo: CommunityRepository

const _hydratables: HydratableRepo[] = []

if (config.db.usePrisma) {
  const { getPrismaClient } = await import('./persistence/prisma-client.js')
  const prisma = getPrismaClient()

  const { PgPostRepository } = await import('./repos/pg/pg-post-repository.js')
  const { PgCommentRepository } = await import('./repos/pg/pg-comment-repository.js')
  const { PgVoteRepository } = await import('./repos/pg/pg-vote-repository.js')
  const { PgAgentRepository, PgAgentConfigRepository } = await import('./repos/pg/pg-agent-repository.js')
  const { PgCommunityRepository } = await import('./repos/pg/pg-community-repository.js')
  const { PgEventRepository, PgAgentRunRepository } = await import('./repos/pg/pg-event-repository.js')
  const { PgRoomRepository } = await import('./repos/pg/pg-room-repository.js')
  const { PgMessageRepository } = await import('./repos/pg/pg-message-repository.js')
  const { PgUserRepository } = await import('./repos/pg/pg-user-repository.js')

  const pr = new PgPostRepository(prisma)
  const cr = new PgCommentRepository(prisma)
  const vr = new PgVoteRepository(prisma)
  const ar = new PgAgentRepository(prisma)
  const acr = new PgAgentConfigRepository(prisma)
  const cmr = new PgCommunityRepository(prisma)
  const er = new PgEventRepository(prisma)
  const arr = new PgAgentRunRepository(prisma)
  const rr = new PgRoomRepository(prisma)
  const mr = new PgMessageRepository(prisma)

  postRepo = pr
  commentRepo = cr
  voteRepo = vr
  agentRepo = ar
  agentConfigRepo = acr
  communityRepo = cmr
  eventRepo = er
  agentRunRepo = arr
  roomRepo = rr
  messageRepo = mr
  userRepo = new PgUserRepository(prisma)
  _hydratables.push(pr, cr, vr, ar, acr, cmr, er, arr, rr, mr)
} else {
  postRepo = new InMemoryPostRepository()
  commentRepo = new InMemoryCommentRepository()
  voteRepo = new InMemoryVoteRepository()
  agentRepo = new InMemoryAgentRepository()
  agentConfigRepo = new InMemoryAgentConfigRepository()
  communityRepo = new InMemoryCommunityRepository()
  eventRepo = new InMemoryEventRepository()
  agentRunRepo = new InMemoryAgentRunRepository()
  roomRepo = new InMemoryRoomRepository()
  messageRepo = new InMemoryMessageRepository()
}

// ─── SSE Hub ─────────────────────────────────────────────────

export const sseHub = new SseHub()

// ─── Moderation ─────────────────────────────────────────────

const moderator = new ModerationService({
  ruleFilter: new DefaultRuleFilter(),
  classifier: new KeywordRiskClassifier(),
  decisionEngine: new DefaultDecisionEngine(),
})

// ─── Core Services ──────────────────────────────────────────

export const forumReadService = new ForumReadService({
  postRepo,
  commentRepo,
  voteRepo,
  communityRepo,
  agentRepo,
})

export const forumWriteService = new ForumWriteService({
  postRepo,
  commentRepo,
  voteRepo,
  eventRepo,
  agentRunRepo,
  moderator,
})

export const agentService = new AgentService({
  agentRepo,
  agentConfigRepo,
  agentRunRepo,
})

export const chatService = new ChatService({
  roomRepo,
  messageRepo,
  agentRepo,
  agentService,
  sseHub,
})

export const roomLifecycle = new RoomLifecycleManager(roomRepo, sseHub)

export const authService = userRepo ? new AuthService(userRepo) : null

export const governanceAdapter = new GovernanceAdapter({
  postRepo,
  commentRepo,
  agentRepo,
})

// ─── Allocator Pipeline ─────────────────────────────────────

export const eventQueue = new InMemoryEventQueue()

const allocatorAgentRepo: AllocatorAgentRepo = {
  getCandidates(communityId: string): AgentCandidate[] {
    const agents = agentRepo.findActive({ limit: 100 })
    return agents.items.map((a) => ({
      agent_id: a.id,
      status: a.status.toLowerCase() as AgentCandidate['status'],
      tags: [],
      community_ids: [communityId],
      actions_last_hour: 0,
      tokens_last_day: 0,
      last_action_at: null,
      recent_thread_post_ids: [],
    }))
  },
}

const degradationMonitor = new DefaultDegradationMonitor(DEFAULT_ALLOCATOR_CONFIG)
const quotaCalc = new DefaultQuotaCalculator(DEFAULT_ALLOCATOR_CONFIG)

export const allocator = new EventAllocator({
  admission: new InMemoryAdmissionGate(DEFAULT_ALLOCATOR_CONFIG),
  quota: quotaCalc,
  candidates: new DefaultCandidateSelector(DEFAULT_ALLOCATOR_CONFIG),
  lock: new InMemoryAllocationLock(DEFAULT_ALLOCATOR_CONFIG.lockTtlMs),
  degradation: degradationMonitor,
  agentRepo: allocatorAgentRepo,
})

// ─── LLM ────────────────────────────────────────────────────

export const llmClient = new LlmClient({
  provider: {
    provider_id: config.llm.provider,
    base_url: config.llm.baseUrl,
    api_key: config.llm.apiKey,
    timeout_ms: config.llm.timeoutMs,
    max_retries: config.llm.maxRetries,
  },
  defaults: {
    model: config.llm.model,
    max_tokens: config.llm.maxTokens,
    temperature: config.llm.temperature,
  },
})

export const promptEngine = new PromptEngine()

// ─── Conversation Clock ──────────────────────────────────────

export const conversationClock = new ConversationClock({
  roomRepo,
  messageRepo,
  agentRepo,
  chatService,
  llmClient,
  promptEngine,
  sseHub,
})

chatService.setJoinHook((roomId, agentId, tick) => {
  conversationClock.onAgentJoined(roomId, agentId, tick)
})
chatService.setLeaveHook((roomId, agentId) => {
  conversationClock.onAgentLeft(roomId, agentId)
})

// ─── Nurture Engines (optional, Prisma-only) ────────────────

let traitEngine: import('./services/trait-engine.js').TraitEngine | null = null
let instructionEngine: import('./services/instruction-engine.js').InstructionEngine | null = null
let growthEngine: import('./services/growth-engine.js').GrowthEngine | null = null
let _prismaForRoutes: import('@prisma/client').PrismaClient | null = null

if (config.db.usePrisma) {
  const { getPrismaClient } = await import('./persistence/prisma-client.js')
  const prisma = getPrismaClient()
  _prismaForRoutes = prisma
  ;(globalThis as Record<string, unknown>).__forumPrisma = prisma
  const { TraitEngine } = await import('./services/trait-engine.js')
  const { InstructionEngine } = await import('./services/instruction-engine.js')
  const { GrowthEngine } = await import('./services/growth-engine.js')
  traitEngine = new TraitEngine(prisma)
  instructionEngine = new InstructionEngine(prisma)
  growthEngine = new GrowthEngine(prisma)

  chatService.setGrowthEngine(growthEngine)
}


// ─── Agent Runtime ──────────────────────────────────────────

const contextBuilder = new ContextBuilder({
  forumReadService,
  agentService,
  traitEngine,
  instructionEngine,
})

const responseParser = new ResponseParser()

const dataplaneWriter = new DataPlaneWriter({
  forumWriteService,
  agentRunRepo,
  chatService,
  growthEngine,
})

export const agentExecutor = new AgentExecutor({
  llmClient,
  promptEngine,
  contextBuilder,
  responseParser,
  dataplaneWriter,
})

export const postScheduler = new PostScheduler(
  {
    llmClient,
    promptEngine,
    forumReadService,
    agentService,
    responseParser,
    dataplaneWriter,
  },
  {
    postIntervalMs: config.runtime.postIntervalMs,
    postMaxPerDay: config.runtime.postMaxPerDay,
  },
)

export const runtimeLoop = new RuntimeLoop(
  {
    queue: eventQueue,
    allocator,
    degradation: degradationMonitor,
    quotaCalc,
    executor: agentExecutor,
    postScheduler,
  },
  {
    intervalMs: config.runtime.intervalMs,
    batchSize: config.runtime.batchSize,
  },
)

// (sseHub moved earlier in file — see above)

// ─── Event Bridge ───────────────────────────────────────────

export const eventBridge = new EventBridge(eventQueue)

forumWriteService.setEventHook((event) => {
  eventBridge.bridge(event)

  sseHub.broadcast({
    type: event.event_type,
    payload: event.payload_json,
  })
})

// ─── Repository Hydration (Pg mode) ─────────────────────────

export async function hydrateRepositories(): Promise<void> {
  if (_hydratables.length === 0) return
  console.log('[Container] Hydrating Pg repositories from database...')
  await Promise.all(_hydratables.map(r => r.hydrate()))
  console.log(`[Container] ${_hydratables.length} repositories hydrated`)
}
