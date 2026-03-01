import { InMemoryPostRepository } from './repos/post-repository.js'
import { InMemoryCommentRepository } from './repos/comment-repository.js'
import { InMemoryVoteRepository } from './repos/vote-repository.js'
import { InMemoryHumanVoteRepository } from './repos/human-vote-repository.js'
import { InMemoryHumanFollowRepository } from './repos/human-follow-repository.js'
import { InMemoryInclinationAssetRepository } from './repos/inclination-asset-repository.js'
import { InMemoryPostMediaRepository } from './repos/post-media-repository.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from './repos/agent-repository.js'
import { InMemoryCommunityRepository } from './repos/community-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from './repos/event-repository.js'
import { InMemoryRoomRepository } from './repos/room-repository.js'
import { InMemoryMessageRepository } from './repos/message-repository.js'
import { InMemoryStatsRepository } from './repos/stats-repository.js'

import type { PostRepository } from './repos/post-repository.js'
import type { CommentRepository } from './repos/comment-repository.js'
import type { VoteRepository } from './repos/vote-repository.js'
import type { HumanVoteRepository } from './repos/human-vote-repository.js'
import type { HumanFollowRepository } from './repos/human-follow-repository.js'
import type { InclinationAssetRepository } from './repos/inclination-asset-repository.js'
import type { PostMediaRepository } from './repos/post-media-repository.js'
import type { AgentRepository, AgentConfigRepository } from './repos/agent-repository.js'
import type { CommunityRepository } from './repos/community-repository.js'
import type { EventRepository, AgentRunRepository } from './repos/event-repository.js'
import type { RoomRepository } from './repos/room-repository.js'
import type { MessageRepository } from './repos/message-repository.js'
import type { RelationRepository } from './repos/relation-repository.js'
import type { StatsRepository } from './repos/stats-repository.js'

import { ForumReadService } from './services/forum-read-service.js'
import { ForumWriteService } from './services/forum-write-service.js'
import { AgentService } from './services/agent-service.js'
import { GovernanceAdapter } from './services/governance-adapter.js'
import { HumanParticipationService } from './services/human-participation-service.js'
import { InclinationAssetService } from './services/inclination-asset-service.js'
import { LocalStorageAdapter, S3StorageAdapter, type StorageAdapter } from './services/storage-adapter.js'
import { VisionSummaryService } from './services/vision-summary-service.js'

import { ModerationService } from './moderation/moderation-service.js'
import { DefaultRuleFilter } from './moderation/rule-filter.js'
import { KeywordRiskClassifier } from './moderation/risk-classifier.js'
import { DefaultDecisionEngine } from './moderation/decision-engine.js'
import { Redis } from 'ioredis'

import {
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
import { PromptLayerService } from './runtime/prompt-layer-service.js'
import { PromptOrchestrator } from './runtime/prompt-orchestrator.js'
import { ResponseParser } from './runtime/response-parser.js'
import { DataPlaneWriter } from './runtime/data-plane-writer.js'
import { AgentExecutor } from './runtime/agent-executor.js'
import { RuntimeLoop } from './runtime/runtime-loop.js'
import { EventBridge } from './runtime/event-bridge.js'
import { PostScheduler } from './runtime/post-scheduler.js'
import {
  InMemoryRuntimeEventQueue,
  RedisStreamRuntimeEventQueue,
  type RuntimeEventQueue,
} from './runtime/event-queue.js'
import {
  InMemoryLeaderElector,
  RedisLeaderElector,
  type LeaderElector,
} from './runtime/leader-elector.js'

import { ChatService } from './services/chat-service.js'
import { NurtureOrchestrator } from './services/nurture-orchestrator.js'
import { PublicObservationDigestService } from './services/public-observation-digest-service.js'
import { RoomLifecycleManager } from './services/room-lifecycle.js'
import { ConversationClock } from './services/conversation-clock.js'
import { AuthService } from './services/auth-service.js'
import { RelationService } from './services/relation-service.js'
import { RelationMetrics } from './services/relation-metrics.js'
import { StatsService } from './services/stats-service.js'
import type { UserRepository } from './repos/user-repository.js'

import { SseHub } from './sse/hub.js'
import { LocalSseBroadcastAdapter } from './sse/adapters/local-broadcast-adapter.js'
import { RedisPubSubSseBroadcastAdapter } from './sse/adapters/redis-pubsub-broadcast-adapter.js'

import { config } from './lib/config.js'
import { NurtureScheduler } from './runtime/nurture-scheduler.js'
import { PublicObservationEventHandler } from './runtime/public-observation-event-handler.js'
import { RelationScheduler } from './runtime/relation-scheduler.js'

// ─── Repositories ───────────────────────────────────────────

interface HydratableRepo { hydrate(): Promise<void> }

let postRepo: PostRepository
let commentRepo: CommentRepository
export let agentRepo: AgentRepository
let agentConfigRepo: AgentConfigRepository
let eventRepo: EventRepository
let agentRunRepo: AgentRunRepository
let roomRepo: RoomRepository
let messageRepo: MessageRepository
let relationRepo: RelationRepository | null
let userRepo: UserRepository | null = null
let statsRepo: StatsRepository
export let voteRepo: VoteRepository
export let humanVoteRepo: HumanVoteRepository
export let humanFollowRepo: HumanFollowRepository
export let inclinationAssetRepo: InclinationAssetRepository
export let postMediaRepo: PostMediaRepository
export let communityRepo: CommunityRepository
export let statsService: StatsService | null = null

const _hydratables: HydratableRepo[] = []

if (config.db.usePrisma) {
  const { getPrismaClient } = await import('./persistence/prisma-client.js')
  const prisma = getPrismaClient()

  const { PgPostRepository } = await import('./repos/pg/pg-post-repository.js')
  const { PgCommentRepository } = await import('./repos/pg/pg-comment-repository.js')
  const { PgVoteRepository } = await import('./repos/pg/pg-vote-repository.js')
  const { PgHumanVoteRepository } = await import('./repos/pg/pg-human-vote-repository.js')
  const { PgHumanFollowRepository } = await import('./repos/pg/pg-human-follow-repository.js')
  const { PgInclinationAssetRepository } = await import('./repos/pg/pg-inclination-asset-repository.js')
  const { PgPostMediaRepository } = await import('./repos/pg/pg-post-media-repository.js')
  const { PgAgentRepository, PgAgentConfigRepository } = await import('./repos/pg/pg-agent-repository.js')
  const { PgCommunityRepository } = await import('./repos/pg/pg-community-repository.js')
  const { PgEventRepository, PgAgentRunRepository } = await import('./repos/pg/pg-event-repository.js')
  const { PgRoomRepository } = await import('./repos/pg/pg-room-repository.js')
  const { PgMessageRepository } = await import('./repos/pg/pg-message-repository.js')
  const { PgUserRepository } = await import('./repos/pg/pg-user-repository.js')
  const { PgRelationRepository } = await import('./repos/pg/pg-relation-repository.js')
  const { PgStatsRepository } = await import('./repos/pg/pg-stats-repository.js')

  const pr = new PgPostRepository(prisma)
  const cr = new PgCommentRepository(prisma)
  const vr = new PgVoteRepository(prisma)
  const hvr = new PgHumanVoteRepository(prisma)
  const hfr = new PgHumanFollowRepository(prisma)
  const iar = new PgInclinationAssetRepository(prisma)
  const pmr = new PgPostMediaRepository(prisma)
  const ar = new PgAgentRepository(prisma)
  const acr = new PgAgentConfigRepository(prisma)
  const cmr = new PgCommunityRepository(prisma)
  const er = new PgEventRepository(prisma)
  const arr = new PgAgentRunRepository(prisma)
  const rr = new PgRoomRepository(prisma)
  const mr = new PgMessageRepository(prisma)
  const relr = new PgRelationRepository(prisma)
  const sr = new PgStatsRepository(prisma)

  postRepo = pr
  commentRepo = cr
  voteRepo = vr
  humanVoteRepo = hvr
  humanFollowRepo = hfr
  inclinationAssetRepo = iar
  postMediaRepo = pmr
  agentRepo = ar
  agentConfigRepo = acr
  communityRepo = cmr
  eventRepo = er
  agentRunRepo = arr
  roomRepo = rr
  messageRepo = mr
  relationRepo = relr
  statsRepo = sr
  userRepo = new PgUserRepository(prisma)
  _hydratables.push(pr, cr, vr, hvr, hfr, iar, pmr, ar, acr, cmr, er, arr, rr, mr, sr)
} else {
  postRepo = new InMemoryPostRepository()
  commentRepo = new InMemoryCommentRepository()
  voteRepo = new InMemoryVoteRepository()
  humanVoteRepo = new InMemoryHumanVoteRepository()
  humanFollowRepo = new InMemoryHumanFollowRepository()
  inclinationAssetRepo = new InMemoryInclinationAssetRepository()
  postMediaRepo = new InMemoryPostMediaRepository()
  agentRepo = new InMemoryAgentRepository()
  agentConfigRepo = new InMemoryAgentConfigRepository()
  communityRepo = new InMemoryCommunityRepository()
  eventRepo = new InMemoryEventRepository()
  agentRunRepo = new InMemoryAgentRunRepository()
  roomRepo = new InMemoryRoomRepository()
  messageRepo = new InMemoryMessageRepository()
  relationRepo = null
  statsRepo = new InMemoryStatsRepository()
}

// ─── SSE Hub ─────────────────────────────────────────────────

export const sseHub = new SseHub({
  instanceId: `sse-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
})

// ─── Moderation ─────────────────────────────────────────────

const moderator = new ModerationService({
  ruleFilter: new DefaultRuleFilter(),
  classifier: new KeywordRiskClassifier(),
  decisionEngine: new DefaultDecisionEngine(),
})

// ─── Runtime Infra (Queue + Leader election) ───────────────

let runtimeRedis: Redis | null = null
let sseRedisPublisher: Redis | null = null
let sseRedisSubscriber: Redis | null = null

const needsRuntimeRedis = config.runtime.queueBackend === 'redis' || config.runtime.leaderBackend === 'redis'
if (needsRuntimeRedis) {
  if (!config.runtime.redisUrl) {
    console.warn('[RuntimeInfra] Redis backend requested but RUNTIME_REDIS_URL/REDIS_URL is empty. Falling back to in-memory runtime infra.')
  } else {
    const redis = new Redis(config.runtime.redisUrl, {
      lazyConnect: true,
      connectTimeout: config.runtime.redisConnectTimeoutMs,
      maxRetriesPerRequest: 1,
    })
    try {
      await redis.connect()
      await redis.ping()
      runtimeRedis = redis
      console.log('[RuntimeInfra] Connected to Redis runtime backend')
    } catch (err) {
      console.warn('[RuntimeInfra] Failed to connect Redis runtime backend, fallback to in-memory:', err)
      await redis.quit().catch(() => undefined)
      runtimeRedis = null
    }
  }
}

const needsSseRedis = config.sse.broadcastBackend === 'redis'
if (needsSseRedis) {
  if (!config.sse.redisUrl) {
    console.warn('[SSE] Redis broadcast requested but SSE_REDIS_URL/RUNTIME_REDIS_URL/REDIS_URL is empty. Falling back to local broadcast.')
  } else {
    const publisher = new Redis(config.sse.redisUrl, {
      lazyConnect: true,
      connectTimeout: config.sse.redisConnectTimeoutMs,
      maxRetriesPerRequest: 1,
    })
    const subscriber = publisher.duplicate({
      lazyConnect: true,
      connectTimeout: config.sse.redisConnectTimeoutMs,
      maxRetriesPerRequest: 1,
    })

    try {
      await Promise.all([publisher.connect(), subscriber.connect()])
      await publisher.ping()
      sseRedisPublisher = publisher
      sseRedisSubscriber = subscriber
      console.log('[SSE] Connected to Redis broadcast backend')
    } catch (err) {
      console.warn('[SSE] Failed to connect Redis broadcast backend, falling back to local:', err)
      await Promise.allSettled([publisher.quit(), subscriber.quit()])
      sseRedisPublisher = null
      sseRedisSubscriber = null
    }
  }
}

const sseBroadcastAdapter =
  config.sse.broadcastBackend === 'redis' && sseRedisPublisher && sseRedisSubscriber
    ? new RedisPubSubSseBroadcastAdapter({
        channel: config.sse.redisChannel,
        publisher: sseRedisPublisher,
        subscriber: sseRedisSubscriber,
      })
    : new LocalSseBroadcastAdapter()

await sseHub.setBroadcastAdapter(sseBroadcastAdapter)
console.log(`[SSE] Broadcast backend: ${sseBroadcastAdapter.backend}`)

function runtimeKey(suffix: string): string {
  return `${config.runtime.redisPrefix}:${suffix}`
}

function createLeaderElector(scope: string): LeaderElector {
  if (config.runtime.leaderBackend === 'redis' && runtimeRedis) {
    return new RedisLeaderElector(runtimeRedis, {
      key: runtimeKey(`leader:${scope}`),
      ttlMs: config.runtime.leaderTtlMs,
    })
  }
  return new InMemoryLeaderElector()
}

export const eventQueue: RuntimeEventQueue =
  config.runtime.queueBackend === 'redis' && runtimeRedis
    ? new RedisStreamRuntimeEventQueue(runtimeRedis, {
        streamKey: runtimeKey('queue:events'),
        deadLetterStreamKey: runtimeKey('queue:events:dlq'),
        consumerGroup: 'runtime-loop',
        consumerName: `${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
        visibilityTimeoutMs: config.runtime.queueVisibilityTimeoutMs,
        maxRetries: config.runtime.queueMaxRetries,
        pollTimeoutMs: config.runtime.queuePollTimeoutMs,
      })
    : new InMemoryRuntimeEventQueue()

const runtimeLoopLeaderElector = createLeaderElector('runtime-loop')
const roomLifecycleLeaderElector = createLeaderElector('room-lifecycle')
const conversationClockLeaderElector = createLeaderElector('conversation-clock')
const privateChannelLeaderElector = createLeaderElector('private-channel')
const nurtureLeaderElector = createLeaderElector('nurture')
const relationLeaderElector = createLeaderElector('relation')

// ─── Core Services ──────────────────────────────────────────

export const forumReadService = new ForumReadService({
  postRepo,
  commentRepo,
  voteRepo,
  humanVoteRepo,
  postMediaRepo,
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

statsService = new StatsService({
  statsRepo,
  agentRepo,
  agentService,
  growthEngine: null,
})

export const chatService = new ChatService({
  roomRepo,
  messageRepo,
  agentRepo,
  agentService,
  sseHub,
  statsService,
})

export const roomLifecycle = new RoomLifecycleManager(roomRepo, sseHub, roomLifecycleLeaderElector)

export const authService = userRepo ? new AuthService(userRepo) : null

export const governanceAdapter = new GovernanceAdapter({
  postRepo,
  commentRepo,
  agentRepo,
})

export const humanParticipationService = new HumanParticipationService({
  postRepo,
  commentRepo,
  voteRepo,
  humanVoteRepo,
  humanFollowRepo,
  agentRepo,
  eventRepo,
})

// ─── Allocator Pipeline ─────────────────────────────────────

const allocatorAgentRepo: AllocatorAgentRepo = {
  getCandidates(communityId: string, authorAgentId?: string): AgentCandidate[] {
    const agents = agentRepo.findActive({ limit: 100 })
    return agents.items.map((a) => ({
      stats_hint: config.features.agentStatsBehavior && statsService
        ? statsService.getDerivedSync(a.id).stats_hint
        : undefined,
      relation_hint_to_author: config.features.socialGraphEffective && authorAgentId && relationService
        ? relationService.getPairHintSync(a.id, authorAgentId)
        : undefined,
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

const inclinationAssetStorage: StorageAdapter =
  config.inclinationAssets.storageBackend === 's3' &&
  config.inclinationAssets.s3.bucket
    ? new S3StorageAdapter({
        bucket: config.inclinationAssets.s3.bucket,
        region: config.inclinationAssets.s3.region,
        endpoint: config.inclinationAssets.s3.endpoint || undefined,
        forcePathStyle: config.inclinationAssets.s3.forcePathStyle,
        accessKeyId: config.inclinationAssets.s3.accessKeyId || undefined,
        secretAccessKey: config.inclinationAssets.s3.secretAccessKey || undefined,
        publicBaseUrl: config.inclinationAssets.publicBaseUrl || undefined,
      })
    : new LocalStorageAdapter({
        baseDir: config.inclinationAssets.localDir,
      })

const visionSummaryService = new VisionSummaryService(llmClient)
export const inclinationAssetService = new InclinationAssetService({
  agentRepo,
  inclinationRepo: inclinationAssetRepo,
  postMediaRepo,
  storage: inclinationAssetStorage,
  visionSummaryService,
})

// ─── Conversation Clock ──────────────────────────────────────

export const conversationClock = new ConversationClock({
  roomRepo,
  messageRepo,
  agentRepo,
  agentService,
  chatService,
  llmClient,
  promptEngine,
  sseHub,
  promptLayerService: null,
  promptOrchestrator: null,
  leaderElector: conversationClockLeaderElector,
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
export let growthEngine: import('./services/growth-engine.js').GrowthEngine | null = null
let memoryService: import('./services/memory-service.js').MemoryService | null = null
export let promptLayerService: PromptLayerService | null = null
export let promptOrchestrator: PromptOrchestrator | null = null
export let relationService: RelationService | null = null
export let relationScheduler: RelationScheduler | null = null
export let nurtureOrchestrator: NurtureOrchestrator | null = null
export let nurtureScheduler: NurtureScheduler | null = null
let publicObservationDigestService: PublicObservationDigestService | null = null
let publicObservationEventHandler: PublicObservationEventHandler | null = null
let proactiveEventHandler: import('./runtime/proactive-event-handler.js').ProactiveEventHandler | null = null
let proactiveInteractionService: import('./services/proactive-interaction-service.js').ProactiveInteractionService | null = null
export let privateChannelServices: {
  channelService: import('./services/private-channel-service.js').PrivateChannelService
  memoryService: import('./services/memory-service.js').MemoryService
} | null = null
export let privateChannelScheduler: import('./runtime/private-channel-scheduler.js').PrivateChannelScheduler | null = null
if (config.db.usePrisma) {
  const { getPrismaClient } = await import('./persistence/prisma-client.js')
  const prisma = getPrismaClient()
  ;(globalThis as Record<string, unknown>).__forumPrisma = prisma
  const { TraitEngine } = await import('./services/trait-engine.js')
  const { InstructionEngine } = await import('./services/instruction-engine.js')
  const { GrowthEngine } = await import('./services/growth-engine.js')
  const { MemoryService } = await import('./services/memory-service.js')
  const { NotificationService } = await import('./services/notification-service.js')
  const { ProactiveInteractionService } = await import('./services/proactive-interaction-service.js')
  const { ProactiveEventHandler } = await import('./runtime/proactive-event-handler.js')
  const { PgPrivateChannelRepository } = await import('./repos/pg/pg-private-channel-repository.js')
  const { PgMemoryRepository } = await import('./repos/pg/pg-memory-repository.js')
  const { PgNotificationRepository } = await import('./repos/pg/pg-notification-repository.js')
  traitEngine = new TraitEngine(prisma)
  instructionEngine = new InstructionEngine(prisma)
  growthEngine = new GrowthEngine(prisma)
  statsService?.setGrowthEngine(growthEngine)
  if (relationRepo) {
    relationService = new RelationService({
      relationRepo,
      agentRepo,
      agentService,
      traitEngine,
      growthEngine,
      postRepo,
      commentRepo,
      roomRepo,
      messageRepo,
      statsService,
      metrics: new RelationMetrics(),
    })
  }

  nurtureOrchestrator = new NurtureOrchestrator({
    agentRepo,
    growthEngine,
    traitEngine,
  })

  const channelRepo = new PgPrivateChannelRepository(prisma)
  const memoryRepo = new PgMemoryRepository(prisma)
  const notificationRepo = new PgNotificationRepository(prisma)
  const notificationService = new NotificationService(notificationRepo)

  memoryService = new MemoryService({
    memoryRepo,
    channelRepo,
    llmClient,
    growthEngine,
    nurtureOrchestrator,
    relationService,
    statsService,
  })

  if (memoryService) {
    publicObservationDigestService = new PublicObservationDigestService({
      llmClient,
      forumReadService,
      roomRepo,
      messageRepo,
      memoryService,
    })
    publicObservationEventHandler = new PublicObservationEventHandler({
      digestService: publicObservationDigestService,
    })
  }

  proactiveInteractionService = new ProactiveInteractionService({
    channelRepo,
    agentService,
    llmClient,
    notificationService,
  })

  proactiveEventHandler = new ProactiveEventHandler({
    proactiveService: proactiveInteractionService,
    forumReadService,
    agentService,
  })

  const { BudgetService } = await import('./services/budget-service.js')
  const { CostTracker } = await import('./services/cost-tracker.js')
  const budgetService = new BudgetService(prisma)
  const costTracker = new CostTracker(prisma)

  const { PrivateChannelService } = await import('./services/private-channel-service.js')
  const { PrivateChannelScheduler } = await import('./runtime/private-channel-scheduler.js')

  const channelService = new PrivateChannelService({
    channelRepo,
    memoryRepo,
    agentService,
    llmClient,
    promptEngine,
    eventRepo,
    agentRunRepo,
    budgetService,
    costTracker,
    sseHub,
  })
  privateChannelServices = {
    channelService,
    memoryService: memoryService!,
  }

  privateChannelScheduler = new PrivateChannelScheduler({
    channelService,
    memoryService,
    agentRepo,
    leaderElector: privateChannelLeaderElector,
  })

  chatService.setGrowthEngine(growthEngine)
  chatService.setNurtureOrchestrator(nurtureOrchestrator)
  chatService.setPublicObservationService(publicObservationDigestService)
  chatService.setRelationService(relationService)

  if (config.features.nurturePipelineV2 && nurtureOrchestrator) {
    nurtureScheduler = new NurtureScheduler({
      orchestrator: nurtureOrchestrator,
      leaderElector: nurtureLeaderElector,
    })
  }

  if (config.features.socialGraphV1 && relationService) {
    relationScheduler = new RelationScheduler({
      relationService,
      leaderElector: relationLeaderElector,
    })
  }
}

promptLayerService = new PromptLayerService({
  agentService,
  traitEngine,
  instructionEngine,
  memoryService,
  statsService,
})
promptOrchestrator = new PromptOrchestrator({
  promptLayerService,
})
conversationClock.setPromptLayerService(promptLayerService)
conversationClock.setPromptOrchestrator(promptOrchestrator)
if (privateChannelServices) {
  privateChannelServices.channelService.bindPromptOrchestrator(promptEngine, promptOrchestrator)
}
if (proactiveInteractionService) {
  proactiveInteractionService.bindPromptOrchestrator(promptEngine, promptOrchestrator)
}

// ─── Agent Runtime ──────────────────────────────────────────

const contextBuilder = new ContextBuilder({
  forumReadService,
  agentService,
  traitEngine,
  instructionEngine,
  memoryService,
  promptLayerService,
  promptOrchestrator,
})

const responseParser = new ResponseParser()

const dataplaneWriter = new DataPlaneWriter({
  forumWriteService,
  agentRunRepo,
  chatService,
  growthEngine,
  nurtureOrchestrator,
  inclinationAssetService,
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
    inclinationAssetService,
    promptOrchestrator,
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
    leaderElector: runtimeLoopLeaderElector,
  },
  {
    intervalMs: config.runtime.intervalMs,
    batchSize: config.runtime.batchSize,
  },
)

// (sseHub moved earlier in file — see above)

// ─── Event Bridge ───────────────────────────────────────────

export const eventBridge = new EventBridge(eventQueue, {
  postRepo,
  commentRepo,
})

forumWriteService.setEventHook((event) => {
  eventBridge.bridge(event)

  sseHub.broadcast({
    type: event.event_type,
    payload: event.payload_json,
  })

  if (proactiveEventHandler) {
    proactiveEventHandler.handle(event)
  }
  if (config.features.agentStatsV1 && statsService) {
    statsService.onDomainEvent(event).catch((err) => {
      console.error('[Container] Stats state update failed:', err)
    })
  }
  if (config.features.socialGraphV1 && relationService && event.event_type === 'COMMENT_CREATED') {
    relationService.onForumCommentEvent(event).catch((err) => {
      console.error('[Container] Relation forum signal failed:', err)
    })
  }
  if (config.features.socialGraphV1 && config.features.agentStatsVotePolicy && relationService && event.event_type === 'VOTE_CAST') {
    relationService.onVoteEvent(event).catch((err) => {
      console.error('[Container] Relation vote signal failed:', err)
    })
  }
  if (config.features.publicObservationMemory && publicObservationEventHandler) {
    publicObservationEventHandler.handle(event)
  }
})

// ─── Repository Hydration (Pg mode) ─────────────────────────

export async function hydrateRepositories(): Promise<void> {
  if (_hydratables.length === 0) return
  console.log('[Container] Hydrating Pg repositories from database...')
  await Promise.all(_hydratables.map(r => r.hydrate()))
  console.log(`[Container] ${_hydratables.length} repositories hydrated`)
}

export async function closeRuntimeInfrastructure(): Promise<void> {
  const electors = [
    runtimeLoopLeaderElector,
    roomLifecycleLeaderElector,
    conversationClockLeaderElector,
    privateChannelLeaderElector,
    nurtureLeaderElector,
    relationLeaderElector,
  ]
  const uniqueElectors = Array.from(new Set(electors))
  await Promise.allSettled(uniqueElectors.map((elector) => elector.releaseLeadership()))

  await sseHub.close()
  await eventQueue.close()

  if (sseRedisSubscriber) {
    await sseRedisSubscriber.quit()
    sseRedisSubscriber = null
  }
  if (sseRedisPublisher) {
    await sseRedisPublisher.quit()
    sseRedisPublisher = null
  }

  if (runtimeRedis) {
    await runtimeRedis.quit()
    runtimeRedis = null
  }
}
