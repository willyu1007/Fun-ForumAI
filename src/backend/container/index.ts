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
import { HomeProgrammingSnapshotScheduler } from '../runtime/home-programming-snapshot-scheduler.js'
import { MediaGenerationWorker } from '../runtime/media-generation-worker.js'
import { MediaImportJobWorker } from '../runtime/media-import-job-worker.js'
import { MediaLifecycleWorker } from '../runtime/media-lifecycle-worker.js'
import { PublicDiscussionCueWorker } from '../runtime/public-discussion-cue-worker.js'
import {
  CueAdmissionController,
} from '../programming/cue/cue-admission-controller.js'
import { DirectorCueBriefServiceImpl } from '../programming/cue/director-cue-brief.js'
import { InProcessTrivialCommunityBudgetService } from '../services/community-budget-service.js'
import { RealInProcessCommunityBudgetService } from '../services/community-budget-service-real.js'
import { AdmissionLoadService } from '../programming/load/admission-load-service.js'
import { adaptAdmissionLoadAsLoadSignal } from '../programming/load/admission-load-signal-adapter.js'
import { CachedLoadSignalService } from '../services/load-signal-service.js'
import { CueMediaPlanner } from '../media/cue-media-planner.js'
import { TriggerDetector as AutoEditorTriggerDetector } from '../programming/auto-editor/trigger-detector.js'
import { LoadGate as AutoEditorLoadGate } from '../programming/auto-editor/load-gate.js'
import { AutoCueEditor } from '../programming/auto-editor/auto-cue-editor.js'
import { AutoCueEditorScheduler } from '../programming/auto-editor/auto-cue-editor-scheduler.js'
import { LLMGatewayAutoCueEditorAdapter } from '../programming/auto-editor/llm-gateway-auto-cue-editor-adapter.js'
import { RoleAssignmentExpiryScheduler } from '../runtime/role-assignment-expiry-scheduler.js'
import { AgentBioRefreshScheduler } from '../runtime/agent-bio-refresh-scheduler.js'
import { AgentBiographyCompileScheduler } from '../runtime/agent-biography-compile-scheduler.js'
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
import { handleGuidanceDigestHook } from '../guidance/feature-gates.js'
import { OwnerLifeOverviewService } from '../services/owner-life-overview-service.js'
import {
  createAudienceWriteDispatcher,
  createForumEventDispatcher,
} from '../services/forum-event-dispatcher.js'
import { SearchGuard } from '../services/search/search-guard.js'
import { PostSearchProvider } from '../services/search/post-search-provider.js'
import { CommunitySearchProvider } from '../services/search/community-search-provider.js'
import { AgentSearchProvider } from '../services/search/agent-search-provider.js'
import { ThreadSearchProvider } from '../services/search/thread-search-provider.js'
import { SearchService } from '../services/search-service.js'
import { SearchProjectionService } from '../services/search-projection-service.js'
import { SearchCountsCache } from '../services/search/search-counts-cache.js'
import { SearchTelemetryService } from '../services/search/search-telemetry-service.js'
import { ForumWatchTelemetryService } from '../services/forum-watch-telemetry-service.js'
import { AgentDeletionService } from '../services/agent-deletion-service.js'
import { WarmupRunArtifactService } from '../services/warmup-run-artifact-service.js'
import { WarmupClosureVerifierService } from '../services/warmup-closure-verifier-service.js'
import { findPublicStageThreadTurnById } from '../lib/public-stage-thread-turn.js'
import { createHealthService } from '../health/service.js'
import { healthState } from '../health/state.js'

const kickoffRunArtifactServiceModulePath =
  '../../../.ai/.tmp/kickoff-local/src/backend/services/kickoff-run-artifact-service.js'
const kickoffPlanningReviewServiceModulePath =
  '../../../.ai/.tmp/kickoff-local/src/backend/services/kickoff-planning-review-service.js'
const kickoffRuntimeReadinessServiceModulePath =
  '../../../.ai/.tmp/kickoff-local/src/backend/services/kickoff-runtime-readiness-service.js'
const kickoffSeedServiceModulePath =
  '../../../.ai/.tmp/kickoff-local/src/backend/services/kickoff-seed-service.js'

class KickoffRunArtifactServiceFallback {}
class KickoffPlanningReviewServiceFallback {}

class KickoffRuntimeReadinessServiceFallback {
  constructor(_deps: {
    getRuntimeBaselineAdmission(): Promise<unknown>
    getKickoffDetail(kickoffBaselineId: string): Promise<unknown>
  }) {}
}

class KickoffSeedServiceFallback {}

async function loadOptionalKickoffServices() {
  try {
    const [
      kickoffRunArtifactModule,
      kickoffPlanningReviewModule,
      kickoffRuntimeReadinessModule,
      kickoffSeedModule,
    ] = await Promise.all([
      import(kickoffRunArtifactServiceModulePath),
      import(kickoffPlanningReviewServiceModulePath),
      import(kickoffRuntimeReadinessServiceModulePath),
      import(kickoffSeedServiceModulePath),
    ])

    return {
      KickoffRunArtifactService:
        kickoffRunArtifactModule.KickoffRunArtifactService as new () => unknown,
      KickoffPlanningReviewService:
        kickoffPlanningReviewModule.KickoffPlanningReviewService as new () => unknown,
      KickoffRuntimeReadinessService:
        kickoffRuntimeReadinessModule.KickoffRuntimeReadinessService as new (deps: {
          getRuntimeBaselineAdmission(): Promise<unknown>
          getKickoffDetail(kickoffBaselineId: string): Promise<unknown>
        }) => unknown,
      KickoffSeedService:
        kickoffSeedModule.KickoffSeedService as new () => unknown,
    }
  } catch (error) {
    console.warn(
      '[container] Optional kickoff-local services unavailable; continuing with fallback stubs.',
      error instanceof Error ? error.message : String(error),
    )
    return {
      KickoffRunArtifactService: KickoffRunArtifactServiceFallback,
      KickoffPlanningReviewService: KickoffPlanningReviewServiceFallback,
      KickoffRuntimeReadinessService: KickoffRuntimeReadinessServiceFallback,
      KickoffSeedService: KickoffSeedServiceFallback,
    }
  }
}

const {
  KickoffRunArtifactService,
  KickoffPlanningReviewService,
  KickoffRuntimeReadinessService,
  KickoffSeedService,
} = await loadOptionalKickoffServices()

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

export const healthService = createHealthService({
  state: healthState,
  getBuildInfo: getRuntimeBuildInfo,
  probeDb: async () => {
    if (!config.db.usePrisma) {
      return { status: 'skipped' as const }
    }

    try {
      const { getPrismaClient } = await import('../persistence/prisma-client.js')
      await getPrismaClient().$queryRaw`SELECT 1`
      return { status: 'ok' as const }
    } catch (err) {
      return {
        status: 'fail' as const,
        failure: err instanceof Error ? err.message : String(err),
      }
    }
  },
  probeRedis: async () => {
    if (config.sse.broadcastBackend !== 'redis') {
      return { status: 'skipped' as const }
    }

    if (infra.sseHub.getStats().broadcast_backend !== 'redis') {
      return { status: 'fail' as const, failure: 'sse_broadcast_backend_fallback' }
    }

    if (!infra.sseRedisPublisher || !infra.sseRedisSubscriber) {
      return { status: 'fail' as const, failure: 'sse_redis_client_unavailable' }
    }

    try {
      await infra.sseRedisPublisher.ping()
    } catch (err) {
      return {
        status: 'fail' as const,
        failure: err instanceof Error ? err.message : String(err),
      }
    }

    if (infra.sseRedisSubscriber.status !== 'ready') {
      return {
        status: 'fail' as const,
        failure: `sse_subscriber_${infra.sseRedisSubscriber.status}`,
      }
    }

    return { status: 'ok' as const }
  },
})

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
  mediaScenePackRepo: repos.mediaScenePackRepo,
  mediaRolloutControllerOverrideRepo: repos.mediaRolloutControllerOverrideRepo,
  mediaLineageEdgeRepo: repos.mediaLineageEdgeRepo,
  mediaCatalogCardRepo: repos.mediaCatalogCardRepo,
  mediaRetrievalDocumentRepo: repos.mediaRetrievalDocumentRepo,
  mediaEmbeddingSnapshotRepo: repos.mediaEmbeddingSnapshotRepo,
  mediaRetrievalSearchRepo: repos.mediaRetrievalSearchRepo,
  mediaDuplicateClusterRepo: repos.mediaDuplicateClusterRepo,
  mediaImportJobRepo: repos.mediaImportJobRepo,
  mediaImportJobItemRepo: repos.mediaImportJobItemRepo,
  forumSceneMetadataRepo: repos.forumSceneMetadataRepo,
  messageRepo: repos.messageRepo,
  eventRepo: repos.eventRepo,
  agentRunRepo: repos.agentRunRepo,
  usageLedgerRepo: pgUsageLedgerRepo,
})

// T-213 M1/M2 — load services are constructed up here so `createCoreServices`
// can hand the cached `LoadSignalService` to `CueBoardReadService` (M4
// heatmap). The admission seam still wires the live `AdmissionLoadService`
// down at the worker construction site.
const admissionLoadService = new AdmissionLoadService({
  cueRepo: repos.cueRepo,
  postRepo: repos.postRepo,
})
const loadSignalService = new CachedLoadSignalService({
  admissionLoadService,
  loadSnapshotRepo: repos.loadSnapshotRepo,
})

// ─── 4. Core Services ───────────────────────────────────────
const core = createCoreServices({
  repos,
  sseHub: infra.sseHub,
  moderator: infra.moderator,
  llmGateway: llm.llmGateway,
  mediaWriteBridge: llm.mediaWriteBridge,
  mediaAssetControlService: llm.mediaAssetControlService,
  surfaceMediaPlanningService: llm.surfaceMediaPlanningService,
  mediaObservabilityService: llm.mediaObservabilityService,
  mediaRolloutControllerService: llm.mediaRolloutControllerService,
  loadSignalService,
  usageLedgerRepo: llm.usageLedgerRepo,
  roomLifecycleLeaderElector: infra.leaderElectors.roomLifecycle,
  conversationClockLeaderElector: infra.leaderElectors.conversationClock,
  runtimeRedis: infra.runtimeRedis,
})

const searchGuard = new SearchGuard()
export const searchCountsCache = new SearchCountsCache()
export const searchTelemetryService = new SearchTelemetryService()
export const forumWatchTelemetryService = new ForumWatchTelemetryService()
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
core.humanParticipationService.setVoteRefreshHook(async ({ target_type, target_id }) => {
  await searchProjectionService.refreshVoteTarget(target_type, target_id)
})

const postsSearchProvider = new PostSearchProvider({
  searchDocRepo: repos.searchDocRepo,
  agentRepo: repos.agentRepo,
  agentConfigRepo: repos.agentConfigRepo,
  guard: searchGuard,
})

const communitiesSearchProvider = new CommunitySearchProvider({
  searchDocRepo: repos.searchDocRepo,
})

const agentsSearchProvider = new AgentSearchProvider({
  searchDocRepo: repos.searchDocRepo,
  agentConfigRepo: repos.agentConfigRepo,
  guard: searchGuard,
})

const threadsSearchProvider = new ThreadSearchProvider({
  searchDocRepo: repos.searchDocRepo,
  agentRepo: repos.agentRepo,
  agentConfigRepo: repos.agentConfigRepo,
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
  core.agentBiographyService.markDirty(input.agent_id, `chronicle:${input.type.toLowerCase()}`).catch((error) => {
    console.error('[Container] biography dirty mark failed after chronicle record:', error)
  })
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
    .then(() =>
      searchProjectionService.reconcileAgent(input.agent_id, {
        reason: 'chronicle_public_highlight',
        scopes: ['agent', 'posts', 'threads'],
      }),
    )
    .then(() => undefined)
})

core.agentService.setConfigUpdatedHook((input) => {
  core.agentBiographyService.markDirty(input.agent_id, 'identity_config').catch((error) => {
    console.error('[Container] biography dirty mark failed after config update:', error)
  })
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
    const entry = await findPublicStageThreadTurnById(
      {
        publicStageThreadRepo: repos.publicStageThreadRepo,
        publicStageTurnRepo: repos.publicStageTurnRepo,
      },
      action.target_id,
    )
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

const homeProgrammingSnapshotScheduler = new HomeProgrammingSnapshotScheduler(
  {
    service: core.homeProgrammingSnapshotService,
    leaderElector: infra.leaderElectors.homeProgrammingSnapshotScheduler,
  },
  {
    intervalMs: config.runtime.homeProgrammingSnapshotIntervalMs,
    startupDelayMs: config.runtime.homeProgrammingSnapshotStartupDelayMs,
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

const agentBioRefreshScheduler = new AgentBioRefreshScheduler({
  service: core.agentBioRefreshService,
  leaderElector: infra.leaderElectors.agentBioRefreshScheduler,
})
const agentBiographyCompileScheduler = new AgentBiographyCompileScheduler({
  service: core.agentBiographyService,
  leaderElector: infra.leaderElectors.agentBiographyCompileScheduler,
})

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

const mediaImportJobWorker = new MediaImportJobWorker(
  {
    service: llm.mediaInjectionWorker,
    leaderElector: infra.leaderElectors.mediaImportJobWorker,
  },
  {
    intervalMs: config.mediaInjection.workerIntervalMs,
    startupDelayMs: config.mediaInjection.workerStartupDelayMs,
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
  agentBiographyService: core.agentBiographyService,
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
  onMemoryDigestCompleted: (input) =>
    core.agentBiographyService.markDirty(input.agent_id, 'private_digest').then(() => undefined),
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
guidanceStateService.setVisitorMergeHook((visitorId, userId) =>
  core.viewerPublicViewService.mergeVisitorIntoUser(visitorId, userId),
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

core.publicAgentRelationSummaryService.attachRuntimeDeps({
  relationService: nurture.relationService ?? null,
})

ownerLifeOverviewService.attachRuntimeDeps({
  memoryService: nurture.privateChannelServices?.memoryService ?? null,
  relationService: nurture.relationService,
})
core.agentBiographyService.attachRuntimeDeps({
  ownerLifeOverviewService,
})

export const agentDeletionService = new AgentDeletionService({
  agentRepo: repos.agentRepo,
  agentService: core.agentService,
  humanFollowRepo: repos.humanFollowRepo,
  searchProjectionService,
  privateChannelService: nurture.privateChannelServices?.channelService ?? null,
})

if (nurture.memoryService) {
  nurture.memoryService.appendDigestHook(async (input) => {
    await handleGuidanceDigestHook(input, {
      guidanceEnabled: config.launch.capabilities.guidanceV1,
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
  forumReadService: core.forumReadService,
  forumWatchTelemetryService,
  attentionOpportunityBroker: core.attentionOpportunityBroker,
  recallPolicyService: core.recallPolicyService,
})

// T-213 M3 — real per-community cap enforcement. Default `enforced=false`
// so every deploy is no-op until ops flips `COMMUNITY_BUDGET_ENFORCED=true`.
// The trivial in-process stub remains available when the flag is off.
// Hoisted above `createRuntime` so PostScheduler picks it up via runtime deps.
const communityBudgetEnforced =
  process.env.COMMUNITY_BUDGET_ENFORCED === 'true'
const communityBudgetService = communityBudgetEnforced
  ? new RealInProcessCommunityBudgetService({ enforced: true })
  : new InProcessTrivialCommunityBudgetService()

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
  semanticProjectionService: core.semanticProjectionService,
  displayProjectionService: core.displayProjectionService,
  agentPerceptionService: core.agentPerceptionService,
  runtimeContextAssembler: core.runtimeContextAssembler,
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
  roleAssignmentRepo: repos.roleAssignmentRepo,
  stageTierService: core.stageTierService,
  postRepo: repos.postRepo,
  voteRepo: repos.voteRepo,
  publicStageThreadRepo: repos.publicStageThreadRepo,
  publicStageTurnRepo: repos.publicStageTurnRepo,
  statsService: core.statsService,
  publicGrowthGate: core.warmupGovernanceService,
  // T-213 M3 — autonomous-path acquire wiring. Service honors `enforced`
  // flag internally, so this can ship with the default-off flag and flip
  // on at the deploy stage without code changes.
  communityBudgetService,
  eventQueue: infra.eventQueue,
  allocator: alloc.allocator,
  degradationMonitor: alloc.degradationMonitor,
  quotaCalc: alloc.quotaCalc,
  runtimeLoopLeaderElector: infra.leaderElectors.runtimeLoop,
})

core.warmupGovernanceService.attachRuntimeDeps({
  postScheduler: rt.postScheduler,
  runtimeLoop: rt.runtimeLoop,
  eventQueue: infra.eventQueue,
})

// ─── 7b. Public Discussion Cue Worker (T-212 M4 / M5) ───────────
// Independent lightweight loop that drives admin-authored cues from the
// scheduled `triggerAt` window through admission → director brief → scene
// selection → write. Runs only when explicitly enabled via
// PUBLIC_DISCUSSION_CUE_WORKER_ENABLED=true (default off; flip on once
// T-213 admission + budget caps are observed healthy in staging). The
// worker stays out of RuntimeLoop so the PostScheduler cue-isolation
// invariant (I-2) holds in both directions.
// T-213 M1/M2 — admission consumes the live `AdmissionLoadService` (declared
// near `createCoreServices` so the M4 heatmap can share the cached
// `LoadSignalService`). Strict separation: admission MUST NOT read cached
// snapshots; preview / Cue Board / TriggerDetector consume the cached
// service only.
const cueAdmissionController = new CueAdmissionController({
  communityBudgetService,
  publicGrowthGate: core.warmupGovernanceService,
  loadSignalService: adaptAdmissionLoadAsLoadSignal(admissionLoadService),
})
const directorCueBriefService = new DirectorCueBriefServiceImpl()

// T-216 — cue media planner. Records `MediaPlanResolution` rows after
// successful cue execution; when anchor mode is on it also resolves media
// through SurfaceMediaPlanningService -> imagePlannerService before the
// data-plane write so selected media policy can block or attach the post.
const cueMediaPlanner = new CueMediaPlanner({
  mediaPlanResolutionRepo: repos.mediaPlanResolutionRepo,
  anchorModeEnabled: config.runtime.cueMediaPolicyAnchorMode,
  surfaceMediaPlanningService: llm.surfaceMediaPlanningService,
})

// `forumEventDispatcher` is declared further below (depends on services
// that aren't yet built); the worker / rollback handler need to fan their
// cue events through it. We capture the reference via a mutable holder so
// the late-binding doesn't trip TDZ on the `const` dispatcher.
const cueEventDispatcherRef: {
  fn: ((event: import('./../repos/types.js').DomainEvent) => Promise<void> | void) | null
} = { fn: null }
const cueEventDispatcherProxy = (
  event: import('./../repos/types.js').DomainEvent,
): Promise<void> | void => cueEventDispatcherRef.fn?.(event)

const publicDiscussionCueWorker = new PublicDiscussionCueWorker(
  {
    cueRepo: repos.cueRepo,
    admissionController: cueAdmissionController,
    directorCueBrief: directorCueBriefService,
    sceneSelector: core.publicSceneSelectorService,
    dataPlaneWriter: rt.dataplaneWriter,
    eventRepo: repos.eventRepo,
    communityBudgetService,
    eventDispatcher: cueEventDispatcherProxy,
    cueMediaPlanner,
    leaderElector: infra.leaderElectors.publicDiscussionCueWorker,
    // Community resolver — adapts the existing community read path so the
    // worker can target the cue's locked community without taking on a heavy
    // read-service dep.
    communityResolver: {
      resolve: async (id) => {
        const community = repos.communityRepo.findById(id)
        if (!community) return null
        return {
          id: community.id,
          slug: community.slug,
          name: community.name,
          description: community.description ?? '',
          rules:
            typeof community.rules_json === 'object' && community.rules_json !== null
              ? JSON.stringify(community.rules_json)
              : '',
        }
      },
    },
    // T-212 M5 — cast resolver picks active members of the cue's community.
    // MVP keeps it simple (community membership ranking by agent id) so the
    // worker is end-to-end exercisable; full allocator integration with
    // role-requirement scoring is a post-T-212 refinement.
    castResolver: {
      resolveCast: async (cue) => {
        const communityId =
          cue.community_id ??
          (cue.scope.mode === 'single' ? cue.scope.community_id : undefined)
        if (!communityId) return []
        const agentIds = repos.agentCommunityMembershipRepo
          .listActiveAgentIdsByCommunity(communityId)
          .slice(0, 8)
        const agents: Array<{ id: string; display_name: string }> = []
        for (const agentId of agentIds) {
          const agent = repos.agentRepo.findById(agentId)
          if (agent) {
            agents.push({ id: agent.id, display_name: agent.display_name })
          }
        }
        return agents
      },
    },
    // Content generator — MVP returns a brief-derived stub so the seam is
    // exercisable end-to-end without coupling the worker to LLM internals.
    contentGenerator: {
      generate: async ({ cue, primaryAuthor }) => ({
        title: cue.theme_intent.topic_seed,
        body:
          cue.theme_intent.discussion_question ??
          `${cue.theme_intent.topic_seed} — by ${primaryAuthor.display_name}`,
      }),
    },
  },
  {
    intervalMs: config.runtime.publicDiscussionCueWorkerIntervalMs,
    startupDelayMs: config.runtime.publicDiscussionCueWorkerStartupDelayMs,
    graceSeconds: config.runtime.publicDiscussionCueWorkerGraceSeconds,
    leaseSeconds: config.runtime.publicDiscussionCueWorkerLeaseSeconds,
    batchSize: config.runtime.publicDiscussionCueWorkerBatchSize,
  },
)

// ─── T-214 A-M3 — auto-editor scheduler (deterministic detector + LLM editor + inbox writer) ───
// Pg trigger event repo lives in container/repos.ts; container exports it for
// tests + observability. The scheduler is OFF by default
// (`autoCueEditorSchedulerEnabled` flag) so each environment can opt in
// explicitly after validating the hidden director lane.
const autoEditorTriggerDetector = new AutoEditorTriggerDetector({
  postRepo: repos.postRepo,
  loadSignalService,
  triggerRepo: repos.autoEditorTriggerEventRepo,
})
const autoEditorLoadGate = new AutoEditorLoadGate({
  loadSignalService,
})
const autoCueEditorLlmClient = new LLMGatewayAutoCueEditorAdapter({
  llmGateway: llm.llmGateway,
})
const autoCueEditor = new AutoCueEditor({
  llmClient: autoCueEditorLlmClient,
})
export const autoCueEditorScheduler = new AutoCueEditorScheduler(
  {
    triggerDetector: autoEditorTriggerDetector,
    loadGate: autoEditorLoadGate,
    autoCueEditor,
    cueRepo: repos.cueRepo,
    leaderElector: infra.leaderElectors.autoCueEditorScheduler,
    // MVP enumerates communities through the cue schedule list. A
    // dedicated community-active-list provider is a follow-on so the
    // scheduler can ride community lifecycle events instead of
    // schedule presence.
    communityProvider: async () => {
      const schedules = await repos.cueRepo.listSchedules({ limit: 200 })
      const ids = new Set<string>()
      for (const sched of schedules) {
        if (sched.community_id) ids.add(sched.community_id)
      }
      return [...ids]
    },
  },
  {
    intervalMs: config.runtime.autoCueEditorSchedulerIntervalMs,
    startupDelayMs: config.runtime.autoCueEditorSchedulerStartupDelayMs,
  },
)

core.warmupGovernanceService.attachProjectionDeps({
  searchProjectionService,
})
export const kickoffSeedService = new KickoffSeedService()
export const kickoffPlanningReviewService = new KickoffPlanningReviewService()
export const kickoffRunArtifactService = new KickoffRunArtifactService()
export const kickoffRuntimeReadinessService = new KickoffRuntimeReadinessService({
  getRuntimeBaselineAdmission: () => core.warmupGovernanceService.getRuntimeBaselineAdmission(),
  getKickoffDetail: (kickoffBaselineId) => core.warmupGovernanceService.getKickoffDetail(kickoffBaselineId),
})
export const warmupRunArtifactService = new WarmupRunArtifactService()
export const warmupClosureVerifierService = new WarmupClosureVerifierService({
  artifactService: warmupRunArtifactService,
  warmupGovernanceService: core.warmupGovernanceService,
  postScheduler: rt.postScheduler,
  postRepo: repos.postRepo,
  forumReadService: core.forumReadService,
  searchService,
  homeProgrammingService: core.homeProgrammingService,
  globalHighlightsService: core.globalHighlightsService,
  searchProjectionService,
  runtimeLoop: rt.runtimeLoop,
  llmGateway: llm.llmGateway,
})

// ─── 8. Event Hook Wiring ───────────────────────────────────
core.aftershowService.setEventHook(async (event) => {
  await searchProjectionService.handleForumEvent(event)

  if (core.achievementsOrchestrator) {
    core.achievementsOrchestrator.processDomainEvent(event).catch((err) => {
      console.error('[Container] Achievement orchestrator aftershow ingest failed:', err)
    })
  }
})

core.homeProgrammingSnapshotService.setEventHook(async (event) => {
  if (core.achievementsOrchestrator) {
    core.achievementsOrchestrator.processDomainEvent(event).catch((err) => {
      console.error('[Container] Achievement orchestrator home snapshot ingest failed:', err)
    })
  }
})

const forumEventDispatcher = createForumEventDispatcher({
  searchProjectionService,
  eventBridge: rt.eventBridge,
  sseHub: infra.sseHub,
  achievementsOrchestrator: core.achievementsOrchestrator,
  proactiveEventHandler: nurture.proactiveEventHandler,
  statsService: config.launch.capabilities.agentStatsV1 ? core.statsService : null,
  nurtureOrchestrator: nurture.nurtureOrchestrator,
  xpService: nurture.xpService,
  relationService: nurture.relationService,
  publicObservationEventHandler: nurture.publicObservationEventHandler,
  guidanceEnabled: config.launch.capabilities.guidanceV1,
  guidanceOrchestrator,
  agentStatsVotePolicyEnabled: config.launch.capabilities.agentStatsVotePolicy,
  publicObservationMemoryEnabled: config.launch.capabilities.publicObservationMemory,
  onError: (message, err) => {
    console.error(message, err)
  },
})

core.forumWriteService.setEventHook(forumEventDispatcher)
core.viewerPublicWriteService.setAcceptedForumEventHook(forumEventDispatcher)
// T-212 fix: bind the cue worker / rollback handler dispatcher proxy so cue
// domain events fan out through the existing forum-event-dispatcher (I-9 /
// T-211 §F.4 — additive event types on the existing dispatcher).
cueEventDispatcherRef.fn = forumEventDispatcher
core.viewerPublicWriteService.setAcceptedAudienceWriteHook(
  createAudienceWriteDispatcher({
    searchProjectionService,
  }),
)

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
export const communityConfigRepo = repos.communityConfigRepo
export const communityProposalRepo = repos.communityProposalRepo
export const roomRepo = repos.roomRepo
export const userRepo = repos.userRepo
export const eventRepo = repos.eventRepo
export { forumEventDispatcher }
export const agentRunRepo = repos.agentRunRepo
export const riskGovernanceRepo = repos.riskGovernanceRepo
export const searchDocRepo = repos.searchDocRepo
export const warmupGovernanceRepo = repos.warmupGovernanceRepo
export const audienceRepo = repos.audienceRepo

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
export const mediaScenePackService = llm.mediaScenePackService
export const mediaLifecycleService = llm.mediaLifecycleService
export const mediaLineageService = llm.mediaLineageService
export const forumSceneMetadataRepo = repos.forumSceneMetadataRepo
export const cueRepo = repos.cueRepo
// T-213 M1/M2 — load layer singletons.
// Admission path consumes `admissionLoadService` (live); preview / Cue
// Board / TriggerDetector consume `loadSignalService` (cached, ~30s TTL).
export { admissionLoadService, loadSignalService }
export const loadSnapshotRepo = repos.loadSnapshotRepo
// T-216 M1 — media planner audit log + orchestrator.
export const mediaPlanResolutionRepo = repos.mediaPlanResolutionRepo
export { cueMediaPlanner }

export const achievementChronicleService = core.achievementChronicleService
export const forumReadService = core.forumReadService
export const stageTierService = core.stageTierService
export const incubationService = core.incubationService
export const incubationOrchestrator = core.incubationOrchestrator
export const audienceService = core.audienceService
export const aftershowService = core.aftershowService
export const communityConfigService = core.communityConfigService
export const communityGovernanceService = core.communityGovernanceService
export const viewerPublicViewService = core.viewerPublicViewService
export const viewerPublicWriteService = core.viewerPublicWriteService
export const threadLifecycleService = core.threadLifecycleService
export const semanticProjectionService = core.semanticProjectionService
export const displayProjectionService = core.displayProjectionService
export const participationContractService = core.participationContractService
export const forumOrchestrationPolicyService = core.orchestrationPolicyService
export const attentionOpportunityBroker = core.attentionOpportunityBroker
export const recallPolicyService = core.recallPolicyService
export const agentPerceptionService = core.agentPerceptionService
export const runtimeContextAssembler = core.runtimeContextAssembler
export const roleAssignmentService = core.roleAssignmentService
export const forumWriteService = core.forumWriteService
export const globalHighlightsService = core.globalHighlightsService
export const publicAgentRelationSummaryService = core.publicAgentRelationSummaryService
export const launchProgrammingOpsService = core.launchProgrammingOpsService
export const cueBoardReadService = core.cueBoardReadService
export const homeProgrammingService = core.homeProgrammingService
export const homeProgrammingSnapshotService = core.homeProgrammingSnapshotService
export const cuePublicProjectionService = core.cuePublicProjectionService
export const warmupGovernanceService = core.warmupGovernanceService
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
export const biographyPromptPackBuilder = core.biographyPromptPackBuilder
export const biographyWriterService = core.biographyWriterService
export const biographyFactualAuditService = core.biographyFactualAuditService
export const agentBiographyService = core.agentBiographyService
export const chatService = core.chatService
export const roomDiscoveryService = core.roomDiscoveryService
export const roomEcologyService = core.roomEcologyService
export const chatroomCanonizationService = core.chatroomCanonizationService
export const chatroomControlService = core.chatroomControlService
export const roomLifecycle = core.roomLifecycle
export const authService = core.authService
export const adminUserAccessService = core.adminUserAccessService
export const inviteCodeService = core.inviteCodeService
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
export const followingFeedService = core.followingFeedService
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
export const proactiveInteractionService = nurture.proactiveInteractionService
export {
  homeProgrammingSnapshotScheduler,
  communityConfigScheduler,
  agentBioRefreshScheduler,
  agentBiographyCompileScheduler,
  roleAssignmentExpiryScheduler,
  directorHistoryMaintenanceScheduler,
  mediaGenerationWorker,
  mediaLifecycleWorker,
  mediaImportJobWorker,
  publicDiscussionCueWorker,
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

// ─── T-301 runtime operation records / infra snapshot / LLM connectivity ─────
const { RuntimeOperationRecordService } = await import(
  '../services/runtime-operation-record-service.js'
)
const {
  RuntimeInfraSnapshotService,
  buildProcessSection,
  probePostgresSection,
  probeRedisQueueSection,
} = await import('../services/runtime-infra-snapshot-service.js')
const { LlmConnectivityDiagnosticService } = await import(
  '../services/llm-connectivity-diagnostic-service.js'
)
const { getRuntimeBuildInfo: getBuildInfoForSnapshot } = await import('../lib/runtime-build-info.js')

export const runtimeOperationRecordService = new RuntimeOperationRecordService({
  repo: repos.runtimeOperationRecordRepo,
  isWriteEnabled: () => config.launch.capabilities.runtimeOperationRecordsWrite,
})

const { setRuntimeOperationRecorder } = await import('../runtime/runtime-observability.js')
// Fire-and-forget: the runtime hot path never awaits the recorder.
// `record()` already swallows persistence errors and respects the write flag.
setRuntimeOperationRecorder((input) => {
  void runtimeOperationRecordService.record(input)
})

export const runtimeInfraSnapshotService = new RuntimeInfraSnapshotService({
  pollIntervalMs: 15_000,
  process: () => {
    const memory = process.memoryUsage()
    return buildProcessSection({
      uptimeSeconds: process.uptime(),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      buildFingerprint: getBuildInfoForSnapshot().code_fingerprint,
      nodeEnv: config.nodeEnv,
    })
  },
  http: () => ({
    status: 'unknown',
    summary: 'http telemetry collector not wired in this pass',
  }),
  postgres: () =>
    probePostgresSection({
      enabled: config.db.usePrisma,
      ping: async () => {
        const { getPrismaClient } = await import('../persistence/prisma-client.js')
        await getPrismaClient().$queryRaw`SELECT 1`
      },
    }),
  redisQueue: () =>
    probeRedisQueueSection({
      enabled: config.runtime.queueBackend === 'redis' && infra.runtimeRedis !== null,
      ping: async () => {
        if (!infra.runtimeRedis) throw new Error('runtime redis not configured')
        await infra.runtimeRedis.ping()
      },
      queueSize: () => infra.eventQueue.size(),
      oldestTimestampMs: () => infra.eventQueue.oldestTimestampMs(),
    }),
  sse: () => {
    const stats = infra.sseHub.getStats()
    const status = stats.broadcast_last_error ? 'warn' : 'ok'
    return {
      status,
      summary: `clients=${stats.connected_clients} backend=${stats.broadcast_backend}`,
      metrics: stats,
      ...(stats.broadcast_last_error
        ? {
            error_code: 'sse_broadcast_last_error',
            error_message_redacted: stats.broadcast_last_error.slice(0, 256),
          }
        : {}),
    }
  },
  llm: () => ({
    status: llm.llmGateway.isConfigured ? 'ok' : 'warn',
    summary: llm.llmGateway.isConfigured ? 'gateway configured' : 'gateway missing credentials',
    metrics: { configured: llm.llmGateway.isConfigured },
  }),
  storageMedia: () => ({
    status: 'unknown',
    summary: 'storage/media health collector not wired in this pass',
  }),
})

export const llmConnectivityDiagnosticService = new LlmConnectivityDiagnosticService({
  bundle: llm.registryBundle,
  invokeGateway: (request) => llm.llmGateway.chat(request),
})

// ─── Persistence warm-up (Pg mode) ───────────────────────────
export async function warmPersistenceState(): Promise<void> {
  if (hydratables.length === 0) return
  console.log('[Container] Warming persistence state...')
  await Promise.all(hydratables.map((r) => r.hydrate()))
  if (config.launch.capabilities.allocatorPprEnabled) {
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
    console.log('[Container] PPR snapshot warm-up skipped (allocator PPR capability disabled)')
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
