import { config } from '../lib/config.js'
import { createRepositories } from './repos.js'
import { createInfrastructure } from './infra.js'
import { createLlmServices } from './llm.js'
import { createCoreServices } from './services.js'
import { createAllocator } from './allocator.js'
import { createNurtureEngines } from './nurture.js'
import { createRuntime } from './runtime.js'
import { CommunityConfigScheduler } from '../runtime/community-config-scheduler.js'
import { RoleAssignmentExpiryScheduler } from '../runtime/role-assignment-expiry-scheduler.js'

// ─── 1. Repositories ────────────────────────────────────────
const { repos, hydratables } = await createRepositories(config.db.usePrisma)

// ─── 2. Infrastructure (SSE, Moderation, Redis, Queues, Leaders) ──
const infra = await createInfrastructure()

// ─── 3. LLM ─────────────────────────────────────────────────
const llm = createLlmServices({
  agentRepo: repos.agentRepo,
  inclinationAssetRepo: repos.inclinationAssetRepo,
  postMediaRepo: repos.postMediaRepo,
})

// ─── 4. Core Services ───────────────────────────────────────
const core = createCoreServices({
  repos,
  sseHub: infra.sseHub,
  moderator: infra.moderator,
  llmGateway: llm.llmGateway,
  roomLifecycleLeaderElector: infra.leaderElectors.roomLifecycle,
  conversationClockLeaderElector: infra.leaderElectors.conversationClock,
})

const communityConfigScheduler = new CommunityConfigScheduler(
  {
    service: core.communityConfigService,
    leaderElector: infra.leaderElectors.communityConfigScheduler,
  },
  {
    intervalMs: config.runtime.communityConfigSchedulerIntervalMs,
    startupDelayMs: config.runtime.communityConfigSchedulerStartupDelayMs,
    batchLimit: config.runtime.communityConfigSchedulerBatchLimit,
    maxRetries: config.runtime.communityConfigSchedulerMaxRetries,
    backoffBaseMs: config.runtime.communityConfigSchedulerBackoffBaseMs,
    backoffMaxMs: config.runtime.communityConfigSchedulerBackoffMaxMs,
  },
)

const roleAssignmentExpiryScheduler = new RoleAssignmentExpiryScheduler(
  {
    service: core.roleAssignmentService,
    leaderElector: infra.leaderElectors.roleAssignmentExpiryScheduler,
  },
  {
    intervalMs: config.runtime.roleAssignmentExpiryIntervalMs,
    startupDelayMs: config.runtime.roleAssignmentExpiryStartupDelayMs,
    batchLimit: config.runtime.roleAssignmentExpiryBatchLimit,
  },
)

// ─── 5. Nurture Engines (Prisma-only heavy path) ────────────
const nurture = await createNurtureEngines({
  repos,
  llmGateway: llm.llmGateway,
  promptEngine: llm.promptEngine,
  sseHub: infra.sseHub,
  forumReadService: core.forumReadService,
  agentService: core.agentService,
  chatService: core.chatService,
  statsService: core.statsService,
  conversationClock: core.conversationClock,
  achievementsOrchestrator: core.achievementsOrchestrator,
  governanceAdapter: core.governanceAdapter,
  communityCultureDigestService: core.communityCultureDigestService,
  incubationOrchestrator: core.incubationOrchestrator,
  leaderElectors: {
    privateChannel: infra.leaderElectors.privateChannel,
    nurture: infra.leaderElectors.nurture,
    relation: infra.leaderElectors.relation,
    achievements: infra.leaderElectors.achievements,
    cultureDigest: infra.leaderElectors.cultureDigest,
  },
})

// ─── 6. Allocator Pipeline ──────────────────────────────────
const alloc = createAllocator({
  repos,
  stageTierService: core.stageTierService,
  statsServiceRef: () => core.statsService,
  relationServiceRef: () => nurture.relationService,
  pprRefreshLeaderElector: infra.leaderElectors.pprRefresh,
})

// ─── 7. Agent Runtime ───────────────────────────────────────
const rt = createRuntime({
  llmGateway: llm.llmGateway,
  forumReadService: core.forumReadService,
  forumWriteService: core.forumWriteService,
  agentService: core.agentService,
  chatService: core.chatService,
  inclinationAssetService: llm.inclinationAssetService,
  communityCultureDigestService: core.communityCultureDigestService,
  promptLayerService: nurture.promptLayerService,
  promptOrchestrator: nurture.promptOrchestrator,
  traitEngine: nurture.traitEngine,
  instructionEngine: nurture.instructionEngine,
  memoryService: nurture.memoryService,
  xpService: nurture.xpService,
  nurtureOrchestrator: nurture.nurtureOrchestrator,
  agentRunRepo: repos.agentRunRepo,
  postRepo: repos.postRepo,
  commentRepo: repos.commentRepo,
  eventQueue: infra.eventQueue,
  allocator: alloc.allocator,
  degradationMonitor: alloc.degradationMonitor,
  quotaCalc: alloc.quotaCalc,
  runtimeLoopLeaderElector: infra.leaderElectors.runtimeLoop,
})

// ─── 8. Event Hook Wiring ───────────────────────────────────
core.forumWriteService.setEventHook((event) => {
  rt.eventBridge.bridge(event)

  if (core.achievementsOrchestrator) {
    core.achievementsOrchestrator.processDomainEvent(event).catch((err) => {
      console.error('[Container] Achievement orchestrator event ingest failed:', err)
    })
  }

  infra.sseHub.broadcast({
    type: event.event_type,
    payload: event.payload_json,
  })

  if (nurture.proactiveEventHandler) {
    nurture.proactiveEventHandler.handle(event)
  }
  if (config.features.agentStatsV1 && core.statsService) {
    core.statsService.onDomainEvent(event).catch((err) => {
      console.error('[Container] Stats state update failed:', err)
    })
  }
  if (event.event_type === 'VOTE_CAST') {
    const payload = event.payload_json
    const direction = typeof payload.direction === 'string' ? payload.direction : ''
    const targetAgentId = typeof payload.target_author_agent_id === 'string' ? payload.target_author_agent_id : ''
    const voteId = typeof payload.vote_id === 'string' ? payload.vote_id : ''
    if (direction === 'UP' && targetAgentId) {
      if (config.features.nurturePipelineV2 && nurture.nurtureOrchestrator) {
        nurture.nurtureOrchestrator.onContentProduced(targetAgentId, 'vote_received', 1, {
          dedup_key: voteId ? `vote:${voteId}` : undefined,
        }).catch((err) => {
          console.error('[Container] vote_received XP award failed:', err)
        })
      } else if (nurture.xpService) {
        nurture.xpService.awardXP(targetAgentId, 'vote_received', 1, {
          dedup_key: voteId ? `vote:${voteId}` : undefined,
        }).catch((err) => {
          console.error('[Container] vote_received XP award failed:', err)
        })
      }
    }
  }
  if (config.features.socialGraphV1 && nurture.relationService && event.event_type === 'COMMENT_CREATED') {
    nurture.relationService.onForumCommentEvent(event).catch((err) => {
      console.error('[Container] Relation forum signal failed:', err)
    })
  }
  if (config.features.socialGraphV1 && config.features.agentStatsVotePolicy && nurture.relationService && event.event_type === 'VOTE_CAST') {
    nurture.relationService.onVoteEvent(event).catch((err) => {
      console.error('[Container] Relation vote signal failed:', err)
    })
  }
  if (config.features.publicObservationMemory && nurture.publicObservationEventHandler) {
    nurture.publicObservationEventHandler.handle(event)
  }
})

// ─── Exports (preserving original container.ts public API) ──

export const agentRepo = repos.agentRepo
export const voteRepo = repos.voteRepo
export const humanVoteRepo = repos.humanVoteRepo
export const humanFollowRepo = repos.humanFollowRepo
export const inclinationAssetRepo = repos.inclinationAssetRepo
export const postMediaRepo = repos.postMediaRepo
export const communityRepo = repos.communityRepo
export const eventRepo = repos.eventRepo

export const sseHub = infra.sseHub
export const eventQueue = infra.eventQueue

export const llmClient = llm.llmClient
export const llmGateway = llm.llmGateway
export const promptEngine = llm.promptEngine
export const inclinationAssetService = llm.inclinationAssetService

export const achievementChronicleService = core.achievementChronicleService
export const forumReadService = core.forumReadService
export const stageTierService = core.stageTierService
export const incubationService = core.incubationService
export const incubationOrchestrator = core.incubationOrchestrator
export const audienceService = core.audienceService
export const aftershowService = core.aftershowService
export const communityConfigService = core.communityConfigService
export const roleAssignmentService = core.roleAssignmentService
export const forumWriteService = core.forumWriteService
export const globalHighlightsService = core.globalHighlightsService
export const agentService = core.agentService
export const agentCommunityMembershipService = core.agentCommunityMembershipService
export const communityCultureDigestService = core.communityCultureDigestService
export const statsService = core.statsService
export const chatService = core.chatService
export const roomLifecycle = core.roomLifecycle
export const authService = core.authService
export const governanceAdapter = core.governanceAdapter
export const humanParticipationService = core.humanParticipationService
export const achievementsOrchestrator = core.achievementsOrchestrator
export const conversationClock = core.conversationClock

export const allocator = alloc.allocator
export const pprRefreshScheduler = alloc.pprRefreshScheduler

export const xpService = nurture.xpService
export const promptLayerService = nurture.promptLayerService
export const promptOrchestrator = nurture.promptOrchestrator
export const relationService = nurture.relationService
export const relationScheduler = nurture.relationScheduler
export const nurtureOrchestrator = nurture.nurtureOrchestrator
export const nurtureScheduler = nurture.nurtureScheduler
export const achievementsScheduler = nurture.achievementsScheduler
export const cultureDigestScheduler = nurture.cultureDigestScheduler
export const privateChannelServices = nurture.privateChannelServices
export const privateChannelScheduler = nurture.privateChannelScheduler
export { communityConfigScheduler, roleAssignmentExpiryScheduler }

export const agentExecutor = rt.agentExecutor
export const postScheduler = rt.postScheduler
export const runtimeLoop = rt.runtimeLoop
export const eventBridge = rt.eventBridge

// ─── Repository Hydration (Pg mode) ─────────────────────────
export async function hydrateRepositories(): Promise<void> {
  if (hydratables.length === 0) return
  console.log('[Container] Hydrating Pg repositories from database...')
  await Promise.all(hydratables.map((r) => r.hydrate()))
  if (config.features.allocatorPprEnabled) {
    const snapshots = await repos.pprSnapshotRepo.listUnexpired({ limit: 200_000 })
    alloc.graphRelevanceProvider.hydrate(
      snapshots.map((row) => ({
        source_agent_id: row.source_agent_id,
        candidate_agent_id: row.candidate_agent_id,
        community_id: row.community_id,
        topic_key: row.topic_key,
        ppr_score: row.ppr_score,
        rank: row.rank,
        computed_at: row.computed_at,
        expires_at: row.expires_at,
      })),
    )
    console.log(`[Container] PPR snapshots loaded: ${snapshots.length}`)
  } else {
    alloc.graphRelevanceProvider.hydrate([])
    console.log('[Container] PPR hydration skipped (FF_ALLOCATOR_PPR_ENABLED=false)')
  }
  console.log(`[Container] ${hydratables.length} repositories hydrated`)
}

// ─── Shutdown ───────────────────────────────────────────────
export async function closeRuntimeInfrastructure(): Promise<void> {
  const electors = Object.values(infra.leaderElectors)
  const uniqueElectors = Array.from(new Set(electors))
  await Promise.allSettled(uniqueElectors.map((elector) => elector.releaseLeadership()))

  await infra.sseHub.close()
  await infra.eventQueue.close()

  if (infra.sseRedisSubscriber) {
    await infra.sseRedisSubscriber.quit()
  }
  if (infra.sseRedisPublisher) {
    await infra.sseRedisPublisher.quit()
  }
  if (infra.runtimeRedis) {
    await infra.runtimeRedis.quit()
  }
}
