import { config } from '../lib/config.js'
import { createRepositories } from './repos.js'
import { createInfrastructure } from './infra.js'
import { createLlmServices } from './llm.js'
import { createCoreServices } from './services.js'
import { createAllocator } from './allocator.js'
import { createNurtureEngines } from './nurture.js'
import { createRuntime } from './runtime.js'
import { CommunityConfigScheduler } from '../runtime/community-config-scheduler.js'
import { DirectorHistoryMaintenanceScheduler } from '../runtime/director-history-maintenance-scheduler.js'
import { MediaGenerationWorker } from '../runtime/media-generation-worker.js'
import { MediaLifecycleWorker } from '../runtime/media-lifecycle-worker.js'
import { RoleAssignmentExpiryScheduler } from '../runtime/role-assignment-expiry-scheduler.js'
import { AgentBioRefreshScheduler } from '../runtime/agent-bio-refresh-scheduler.js'
import { getRuntimeBuildInfo } from '../lib/runtime-build-info.js'
import { personaObservability } from '../runtime/persona-observability.js'
import { NotFoundError } from '../lib/errors.js'
import {
  GuidanceBellService,
  GuidanceCopyService,
  GuidanceDeliveryAdapter,
  GuidanceObservabilityService,
  GuidanceOrchestrator,
  GuidanceRecallScheduler,
  GuidanceStateService,
} from '../guidance/index.js'
import { handleGuidanceDigestHook, handleGuidanceForumFanout } from '../guidance/feature-gates.js'
import { OwnerLifeOverviewService } from '../services/owner-life-overview-service.js'
import { SearchGuard } from '../services/search/search-guard.js'
import { PostSearchProvider } from '../services/search/post-search-provider.js'
import { CommunitySearchProvider } from '../services/search/community-search-provider.js'
import { AgentSearchProvider } from '../services/search/agent-search-provider.js'
import { ThreadSearchProvider } from '../services/search/thread-search-provider.js'
import { SearchService } from '../services/search-service.js'
import { SearchProjectionService } from '../services/search-projection-service.js'
import { SearchCountsCache } from '../services/search/search-counts-cache.js'
import { SearchTelemetryService } from '../services/search/search-telemetry-service.js'
import { findPublicStageThreadTurnById } from '../lib/public-stage-thread-turn.js'

function extractOwnerStylePins(configJson: Record<string, unknown>): Record<string, unknown> {
  const identity = configJson.identity
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    return {}
  }
  const contract = (identity as Record<string, unknown>).contract
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return {}
  }
  const ownerStylePins = (contract as Record<string, unknown>).ownerStylePins
  if (!ownerStylePins || typeof ownerStylePins !== 'object' || Array.isArray(ownerStylePins)) {
    return {}
  }
  return ownerStylePins as Record<string, unknown>
}

// ─── 1. Repositories ────────────────────────────────────────
const { repos, hydratables } = await createRepositories(config.db.usePrisma)

// ─── 2. Infrastructure (SSE, Moderation, Redis, Queues, Leaders) ──
const infra = await createInfrastructure()

// ─── 2b. Usage Ledger Repo (Pg-only) ──────────────────────────
let pgUsageLedgerRepo: import('../llm/usage-ledger.js').UsageLedgerRepository | undefined
if (config.db.usePrisma) {
  const { getPrismaClient } = await import('../persistence/prisma-client.js')
  const { PgUsageLedgerRepository } = await import('../repos/pg/pg-usage-ledger-repository.js')
  pgUsageLedgerRepo = new PgUsageLedgerRepository(getPrismaClient())

  const { PgPersonaObservabilityRepository } =
    await import('../repos/pg/pg-persona-observability-repository.js')
  const build = getRuntimeBuildInfo()
  const instanceId = `${build.hostname ?? 'local'}:${process.pid}`
  personaObservability.setRepository(
    new PgPersonaObservabilityRepository(getPrismaClient(), build.code_fingerprint, instanceId),
  )
}

// ─── 3. LLM ─────────────────────────────────────────────────
const llm = createLlmServices({
  agentRepo: repos.agentRepo,
  agentConfigRepo: repos.agentConfigRepo,
  mediaAssetRepo: repos.mediaAssetRepo,
  mediaSemanticSnapshotRepo: repos.mediaSemanticSnapshotRepo,
  sceneMediaBindingRepo: repos.sceneMediaBindingRepo,
  mediaContextProjectionRepo: repos.mediaContextProjectionRepo,
  postMediaRepo: repos.postMediaRepo,
  visualDirectiveRepo: repos.visualDirectiveRepo,
  imagePlanRepo: repos.imagePlanRepo,
  mediaReusePolicyRepo: repos.mediaReusePolicyRepo,
  mediaGenerationJobRepo: repos.mediaGenerationJobRepo,
  mediaObservabilityEventRepo: repos.mediaObservabilityEventRepo,
  mediaRolloutControllerOverrideRepo: repos.mediaRolloutControllerOverrideRepo,
  mediaLineageEdgeRepo: repos.mediaLineageEdgeRepo,
  forumSceneMetadataRepo: repos.forumSceneMetadataRepo,
  messageRepo: repos.messageRepo,
  eventRepo: repos.eventRepo,
  agentRunRepo: repos.agentRunRepo,
  usageLedgerRepo: pgUsageLedgerRepo,
})

// ─── 4. Core Services ───────────────────────────────────────
const core = createCoreServices({
  repos,
  sseHub: infra.sseHub,
  moderator: infra.moderator,
  llmGateway: llm.llmGateway,
  mediaWriteBridge: llm.mediaWriteBridge,
  surfaceMediaPlanningService: llm.surfaceMediaPlanningService,
  visibleModelPin: config.llm.visibleModelPin,
  mediaObservabilityService: llm.mediaObservabilityService,
  mediaRolloutControllerService: llm.mediaRolloutControllerService,
  usageLedgerRepo: llm.usageLedgerRepo,
  roomLifecycleLeaderElector: infra.leaderElectors.roomLifecycle,
  conversationClockLeaderElector: infra.leaderElectors.conversationClock,
})

const searchGuard = new SearchGuard()
export const searchCountsCache = new SearchCountsCache()
export const searchTelemetryService = new SearchTelemetryService()
export const searchProjectionService = new SearchProjectionService({
  searchDocRepo: repos.searchDocRepo,
  countsCache: searchCountsCache,
  forumReadService: core.forumReadService,
  postRepo: repos.postRepo,
  publicStageThreadRepo: repos.publicStageThreadRepo,
  publicStageTurnRepo: repos.publicStageTurnRepo,
  communityRepo: repos.communityRepo,
  agentRepo: repos.agentRepo,
  agentConfigRepo: repos.agentConfigRepo,
  humanFollowRepo: repos.humanFollowRepo,
  membershipRepo: repos.agentCommunityMembershipRepo,
  chronicleRepo: repos.chronicleRepo,
  forumSceneMetadataRepo: repos.forumSceneMetadataRepo,
  audienceRepo: repos.audienceRepo,
  achievementChronicleService: core.achievementChronicleService,
  communityCultureDigestService: core.communityCultureDigestService,
  agentPublicProjectionService: core.agentPublicProjectionService,
  agentBioService: core.agentBioRefreshService,
  aftershowService: core.aftershowService,
  guard: searchGuard,
})

const postsSearchProvider = new PostSearchProvider({
  searchDocRepo: repos.searchDocRepo,
  agentRepo: repos.agentRepo,
  guard: searchGuard,
})

const communitiesSearchProvider = new CommunitySearchProvider({
  searchDocRepo: repos.searchDocRepo,
})

const agentsSearchProvider = new AgentSearchProvider({
  searchDocRepo: repos.searchDocRepo,
  guard: searchGuard,
})

const threadsSearchProvider = new ThreadSearchProvider({
  searchDocRepo: repos.searchDocRepo,
  agentRepo: repos.agentRepo,
  forumReadService: core.forumReadService,
  guard: searchGuard,
})

export const searchService = new SearchService({
  postsProvider: postsSearchProvider,
  communitiesProvider: communitiesSearchProvider,
  agentsProvider: agentsSearchProvider,
  threadsProvider: threadsSearchProvider,
  humanParticipationService: core.humanParticipationService,
  countsCache: searchCountsCache,
  telemetry: searchTelemetryService,
})

core.agentBioRefreshService.setUpdatedHook(async (input) => {
  if (input.refresh_kind === 'minor_presence') {
    return
  }
  await searchProjectionService.reconcileAgent(input.agent_id, {
    reason: `agent_bio_${input.reason}`,
    scopes: input.reason.startsWith('projection_')
      ? ['posts', 'threads']
      : ['agent', 'posts', 'threads'],
  })
})

core.agentPublicProjectionService.setUpdatedHook(async (input) => {
  await core.agentBioRefreshService.refresh(input.agent_id, {
    refresh_kind: 'major',
    reason: `projection_${input.reason}`,
  })
  await searchProjectionService.refreshAgent(input.agent_id)
})

llm.mediaObservabilityService.attachGovernanceDeps({
  riskGovernanceRepo: repos.riskGovernanceRepo,
  publicDisclosureCapService: core.publicDisclosureCapService,
})

core.achievementChronicleService.setRecordHook((input) => {
  if (input.visibility !== 'PUBLIC') {
    return core.agentBioRefreshService
      .refresh(input.agent_id, {
        refresh_kind: 'major',
        reason: 'owner_chronicle',
      })
      .then(() => undefined)
  }
  return core.agentPublicProjectionService
    .refresh(input.agent_id, { reason: 'chronicle' })
    .then(() => searchProjectionService.reconcileAgent(input.agent_id, {
      reason: 'chronicle_public_highlight',
      scopes: ['agent', 'posts', 'threads'],
    }))
    .then(() => undefined)
})

core.agentService.setConfigUpdatedHook((input) => {
  const beforePins = extractOwnerStylePins(input.before_config)
  const afterPins = extractOwnerStylePins(input.after_config)
  if (JSON.stringify(beforePins) !== JSON.stringify(afterPins)) {
    return core.agentPublicProjectionService
      .refresh(input.agent_id, { reason: 'owner_style_pin' })
      .then(() => undefined)
  }
  return core.agentBioRefreshService
    .refresh(input.agent_id, {
      refresh_kind: 'major',
      reason: 'identity_config',
    })
    .then((result) => {
      if (result?.updated) return
      return searchProjectionService.refreshAgent(input.agent_id)
    })
})

core.governanceAdapter.setExecutedHook(async ({ action }) => {
  if (action.target_type === 'post') {
    await searchProjectionService.refreshPost(action.target_id)
    return
  }
  if (action.target_type === 'thread_turn') {
    const entry = await findPublicStageThreadTurnById({
      publicStageThreadRepo: repos.publicStageThreadRepo,
      publicStageTurnRepo: repos.publicStageTurnRepo,
    }, action.target_id)
    if (entry?.entry_kind === 'THREAD') {
      await searchProjectionService.refreshThread(entry.id)
    } else if (entry?.thread_id) {
      await searchProjectionService.refreshThread(entry.thread_id)
    }
    if (entry) {
      await searchProjectionService.refreshPost(entry.post_id)
    }
    return
  }
  if (action.target_type === 'agent') {
    await searchProjectionService.reconcileAgent(action.target_id, {
      reason: 'governance_agent',
      scopes: ['agent', 'posts', 'threads', 'communities'],
    })
  }
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

const agentBioRefreshScheduler = new AgentBioRefreshScheduler(
  {
    service: core.agentBioRefreshService,
    leaderElector: infra.leaderElectors.agentBioRefreshScheduler,
  },
)

const directorHistoryMaintenanceScheduler = config.db.usePrisma
  ? new DirectorHistoryMaintenanceScheduler({
      leaderElector: infra.leaderElectors.directorHistoryMaintenanceScheduler,
    })
  : null

const mediaGenerationWorker = new MediaGenerationWorker(
  {
    service: llm.mediaGenerationService,
    leaderElector: infra.leaderElectors.mediaGenerationWorker,
  },
  {
    intervalMs: config.mediaGeneration.workerIntervalMs,
    startupDelayMs: config.mediaGeneration.workerStartupDelayMs,
  },
)

const mediaLifecycleWorker = new MediaLifecycleWorker(
  {
    service: llm.mediaLifecycleService,
    leaderElector: infra.leaderElectors.mediaLifecycleWorker,
  },
  {
    intervalMs: config.mediaLifecycle.workerIntervalMs,
    startupDelayMs: config.mediaLifecycle.workerStartupDelayMs,
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
  personaStateService: core.personaStateService,
  inferenceProfileService: core.inferenceProfileService,
  agentPublicProjectionService: core.agentPublicProjectionService,
  conversationClock: core.conversationClock,
  achievementsOrchestrator: core.achievementsOrchestrator,
  governanceAdapter: core.governanceAdapter,
  communityCultureDigestService: core.communityCultureDigestService,
  incubationOrchestrator: core.incubationOrchestrator,
  policyGatewayService: core.policyGatewayService,
  identityGateService: core.identityGateService,
  publicDisclosureCapService: core.publicDisclosureCapService,
  mediaAssetService: llm.mediaAssetService,
  leaderElectors: {
    privateChannel: infra.leaderElectors.privateChannel,
    nurture: infra.leaderElectors.nurture,
    relation: infra.leaderElectors.relation,
    achievements: infra.leaderElectors.achievements,
    cultureDigest: infra.leaderElectors.cultureDigest,
  },
})

core.agentBioWorldviewService.attachRuntimeDeps({
  memoryService: nurture.privateChannelServices?.memoryService ?? null,
})

if (nurture.privateChannelServices) {
  core.complaintAppealService.setPrivateSessionLookup(async (sessionId) => {
    try {
      const session = await nurture.privateChannelServices!.channelService.getSession(sessionId)
      return {
        id: session.id,
        human_user_id: session.human_user_id,
      }
    } catch (err) {
      if (err instanceof NotFoundError) return null
      throw err
    }
  })
}

if (nurture.xpService) {
  core.inferenceProfileService.setXpService(nurture.xpService)
}

const guidanceCopyService = new GuidanceCopyService()
const guidanceStateService = new GuidanceStateService(
  repos.guidanceActorStateRepo,
  repos.guidanceInboxRepo,
  guidanceCopyService,
)
const guidanceDelivery = new GuidanceDeliveryAdapter(infra.sseHub)
const guidanceBellService = new GuidanceBellService({
  inboxRepo: repos.guidanceInboxRepo,
  eventLogRepo: repos.guidanceEventLogRepo,
})
const guidanceObservabilityService = new GuidanceObservabilityService({
  inboxRepo: repos.guidanceInboxRepo,
  eventLogRepo: repos.guidanceEventLogRepo,
})
const guidanceOrchestrator = new GuidanceOrchestrator({
  stateService: guidanceStateService,
  inboxRepo: repos.guidanceInboxRepo,
  eventLogRepo: repos.guidanceEventLogRepo,
  humanFollowRepo: repos.humanFollowRepo,
  agentRepo: repos.agentRepo,
  copyService: guidanceCopyService,
  delivery: guidanceDelivery,
})
const guidanceRecallScheduler = new GuidanceRecallScheduler({
  stateRepo: repos.guidanceActorStateRepo,
  inboxRepo: repos.guidanceInboxRepo,
  eventLogRepo: repos.guidanceEventLogRepo,
  copyService: guidanceCopyService,
  bellService: guidanceBellService,
  leaderElector: infra.leaderElectors.guidanceRecallScheduler,
})

export const ownerLifeOverviewService = new OwnerLifeOverviewService({
  agentService: core.agentService,
  chronicleService: core.achievementChronicleService,
  projectionService: core.agentPublicProjectionService,
  membershipService: core.agentCommunityMembershipService,
  communityRepo: repos.communityRepo,
  roomRepo: repos.roomRepo,
  runtimeSceneStateManager: core.runtimeSceneStateManager,
  statsService: core.statsService,
})

ownerLifeOverviewService.attachRuntimeDeps({
  memoryService: nurture.privateChannelServices?.memoryService ?? null,
  relationService: nurture.relationService,
})

if (nurture.memoryService) {
  nurture.memoryService.appendDigestHook(async (input) => {
    await handleGuidanceDigestHook(input, {
      guidanceEnabled: config.features.guidanceV1,
      agentRepo: repos.agentRepo,
      orchestrator: guidanceOrchestrator,
    })
  })
}

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
  mediaAssetControlService: llm.mediaAssetControlService,
  communityCultureDigestService: core.communityCultureDigestService,
  personaStateService: core.personaStateService,
  inferenceProfileService: core.inferenceProfileService,
  publicSceneSelectorService: core.publicSceneSelectorService,
  forumSceneContinuityService: core.forumSceneContinuityService,
  chatroomRuntimeContextBuilder: core.chatroomRuntimeContextBuilder,
  promptOrchestrator: nurture.promptOrchestrator,
  mediaProjectionService: llm.mediaProjectionService,
  mediaWriteBridge: llm.mediaWriteBridge,
  visualDirectiveService: llm.visualDirectiveService,
  imagePlannerService: llm.imagePlannerService,
  mediaGenerationService: llm.mediaGenerationService,
  surfaceMediaPlanningService: llm.surfaceMediaPlanningService,
  mediaRolloutControllerService: llm.mediaRolloutControllerService,
  mediaObservabilityService: llm.mediaObservabilityService,
  xpService: nurture.xpService,
  nurtureOrchestrator: nurture.nurtureOrchestrator,
  eventRepo: repos.eventRepo,
  agentRunRepo: repos.agentRunRepo,
  membershipRepo: repos.agentCommunityMembershipRepo,
  postRepo: repos.postRepo,
  publicStageThreadRepo: repos.publicStageThreadRepo,
  publicStageTurnRepo: repos.publicStageTurnRepo,
  eventQueue: infra.eventQueue,
  allocator: alloc.allocator,
  degradationMonitor: alloc.degradationMonitor,
  quotaCalc: alloc.quotaCalc,
  runtimeLoopLeaderElector: infra.leaderElectors.runtimeLoop,
})

// ─── 8. Event Hook Wiring ───────────────────────────────────
core.forumWriteService.setEventHook(async (event) => {
  await searchProjectionService.handleForumEvent(event)

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
    const targetAgentId =
      typeof payload.target_author_agent_id === 'string' ? payload.target_author_agent_id : ''
    const voteId = typeof payload.vote_id === 'string' ? payload.vote_id : ''
    if (direction === 'UP' && targetAgentId) {
      if (nurture.nurtureOrchestrator) {
        nurture.nurtureOrchestrator
          .onContentProduced(targetAgentId, 'vote_received', 1, {
            dedup_key: voteId ? `vote:${voteId}` : undefined,
          })
          .catch((err) => {
            console.error('[Container] vote_received XP award failed:', err)
          })
      } else if (nurture.xpService) {
        nurture.xpService
          .awardXP(targetAgentId, 'vote_received', 1, {
            dedup_key: voteId ? `vote:${voteId}` : undefined,
          })
          .catch((err) => {
            console.error('[Container] vote_received XP award failed:', err)
          })
      }
    }
  }
  if (
    nurture.relationService
    && (event.event_type === 'THREAD_OPENED' || event.event_type === 'THREAD_TURN_ADDED')
  ) {
    nurture.relationService.onForumStageEvent(event).catch((err) => {
      console.error('[Container] Relation forum signal failed:', err)
    })
  }
  if (
    config.features.agentStatsVotePolicy &&
    nurture.relationService &&
    event.event_type === 'VOTE_CAST'
  ) {
    nurture.relationService.onVoteEvent(event).catch((err) => {
      console.error('[Container] Relation vote signal failed:', err)
    })
  }
  if (config.features.publicObservationMemory && nurture.publicObservationEventHandler) {
    nurture.publicObservationEventHandler.handle(event)
  }
  handleGuidanceForumFanout(event, {
    guidanceEnabled: config.features.guidanceV1,
    orchestrator: guidanceOrchestrator,
    onError: (err) => {
      console.error('[Container] Guidance forum event ingest failed:', err)
    },
  })
})

// ─── Exports (preserving original container.ts public API) ──

export const agentRepo = repos.agentRepo
export const agentConfigRepo = repos.agentConfigRepo
export const devSeedRegistryRepo = repos.devSeedRegistryRepo
export const voteRepo = repos.voteRepo
export const humanVoteRepo = repos.humanVoteRepo
export const humanFollowRepo = repos.humanFollowRepo
export const postRepo = repos.postRepo
export const publicStageThreadRepo = repos.publicStageThreadRepo
export const publicStageTurnRepo = repos.publicStageTurnRepo
export const mediaAssetRepo = repos.mediaAssetRepo
export const mediaSemanticSnapshotRepo = repos.mediaSemanticSnapshotRepo
export const postMediaRepo = repos.postMediaRepo
export const sceneMediaBindingRepo = repos.sceneMediaBindingRepo
export const mediaContextProjectionRepo = repos.mediaContextProjectionRepo
export const communityRepo = repos.communityRepo
export const roomRepo = repos.roomRepo
export const userRepo = repos.userRepo
export const eventRepo = repos.eventRepo
export const agentRunRepo = repos.agentRunRepo
export const riskGovernanceRepo = repos.riskGovernanceRepo
export const searchDocRepo = repos.searchDocRepo

export const sseHub = infra.sseHub
export const eventQueue = infra.eventQueue

export const llmClient = llm.llmClient
export const llmGateway = llm.llmGateway
export const llmRegistryBundle = llm.registryBundle
export const usageLedger = llm.usageLedger
export const usageLedgerRepo = llm.usageLedgerRepo
export const promptEngine = llm.promptEngine
export const mediaAssetControlService = llm.mediaAssetControlService
export const mediaProjectionService = llm.mediaProjectionService
export const mediaWriteBridge = llm.mediaWriteBridge
export const visualDirectiveService = llm.visualDirectiveService
export const imagePlannerService = llm.imagePlannerService
export const mediaReuseGovernanceService = llm.mediaReuseGovernanceService
export const mediaGenerationGateway = llm.mediaGenerationGateway
export const mediaGenerationService = llm.mediaGenerationService
export const mediaObservabilityService = llm.mediaObservabilityService
export const mediaRolloutControllerService = llm.mediaRolloutControllerService
export const mediaLifecycleService = llm.mediaLifecycleService
export const mediaLineageService = llm.mediaLineageService

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
export const personaStateService = core.personaStateService
export const inferenceProfileService = core.inferenceProfileService
export const agentPublicProjectionService = core.agentPublicProjectionService
export const agentBioWorldviewService = core.agentBioWorldviewService
export const agentBioRenderService = core.agentBioRenderService
export const agentBioRefreshService = core.agentBioRefreshService
export const chatService = core.chatService
export const roomDiscoveryService = core.roomDiscoveryService
export const roomEcologyService = core.roomEcologyService
export const chatroomCanonizationService = core.chatroomCanonizationService
export const chatroomControlService = core.chatroomControlService
export const roomLifecycle = core.roomLifecycle
export const authService = core.authService
export const governanceAdapter = core.governanceAdapter
export const hotTopicOpsService = core.hotTopicOpsService
export const notificationService = core.notificationService
export const safeReplyService = core.safeReplyService
export const hotTopicPolicyService = core.hotTopicPolicyService
export const publicDisclosureCapService = core.publicDisclosureCapService
export const reviewService = core.reviewService
export const riskEventService = core.riskEventService
export const identityGateService = core.identityGateService
export const policyGatewayService = core.policyGatewayService
export const complaintAppealService = core.complaintAppealService
export const feedbackService = core.feedbackService
export const agentConfigLintService = core.agentConfigLintService
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
export {
  communityConfigScheduler,
  agentBioRefreshScheduler,
  roleAssignmentExpiryScheduler,
  directorHistoryMaintenanceScheduler,
  mediaGenerationWorker,
  mediaLifecycleWorker,
}
export {
  guidanceBellService,
  guidanceCopyService,
  guidanceObservabilityService,
  guidanceRecallScheduler,
  guidanceStateService,
  guidanceOrchestrator,
}

export const agentExecutor = rt.agentExecutor
export const postScheduler = rt.postScheduler
export const runtimeLoop = rt.runtimeLoop
export const eventBridge = rt.eventBridge

// ─── Persistence warm-up (Pg mode) ───────────────────────────
export async function warmPersistenceState(): Promise<void> {
  if (hydratables.length === 0) return
  console.log('[Container] Warming persistence state...')
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
    console.log(`[Container] PPR snapshot state warmed: ${snapshots.length}`)
  } else {
    alloc.graphRelevanceProvider.hydrate([])
    console.log('[Container] PPR snapshot warm-up skipped (FF_ALLOCATOR_PPR_ENABLED=false)')
  }
  console.log(`[Container] ${hydratables.length} persistence adapters warmed`)
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
