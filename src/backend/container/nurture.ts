import { PromptLayerService } from '../runtime/prompt-layer-service.js'
import { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import { RelationService } from '../services/relation-service.js'
import { RelationMetrics } from '../services/relation-metrics.js'
import { NurtureOrchestrator } from '../services/nurture-orchestrator.js'
import { PublicObservationDigestService } from '../services/public-observation-digest-service.js'
import { NurtureScheduler } from '../runtime/nurture-scheduler.js'
import { RelationScheduler } from '../runtime/relation-scheduler.js'
import { AchievementsScheduler } from '../runtime/achievements-scheduler.js'
import { CultureDigestScheduler } from '../runtime/culture-digest-scheduler.js'
import { config } from '../lib/config.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { SseHub } from '../sse/hub.js'
import type { Repositories } from './repos.js'
import type { LeaderElector } from '../runtime/leader-elector.js'
import type { ForumReadService } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { ChatService } from '../services/chat-service.js'
import type { StatsService } from '../services/stats-service.js'
import type { ConversationClock } from '../services/conversation-clock.js'
import type { AchievementsOrchestrator } from '../services/achievements-orchestrator.js'
import type { GovernanceAdapter } from '../services/governance-adapter.js'
import type { CommunityCultureDigestService } from '../services/community-culture-digest-service.js'
import type { IncubationOrchestrator } from '../services/incubation-orchestrator.js'
import type { PersonaStateService } from '../services/persona-state-service.js'

export interface NurtureResult {
  traitEngine: import('../services/trait-engine.js').TraitEngine | null
  instructionEngine: import('../services/instruction-engine.js').InstructionEngine | null
  xpService: import('../services/xp-service.js').XpService | null
  memoryService: import('../services/memory-service.js').MemoryService | null
  promptLayerService: PromptLayerService
  promptOrchestrator: PromptOrchestrator
  relationService: RelationService | null
  relationScheduler: RelationScheduler | null
  nurtureOrchestrator: NurtureOrchestrator | null
  nurtureScheduler: NurtureScheduler | null
  achievementsScheduler: AchievementsScheduler | null
  cultureDigestScheduler: CultureDigestScheduler | null
  privateChannelServices: {
    channelService: import('../services/private-channel-service.js').PrivateChannelService
    memoryService: import('../services/memory-service.js').MemoryService
  } | null
  privateChannelScheduler: import('../runtime/private-channel-scheduler.js').PrivateChannelScheduler | null
  proactiveEventHandler: import('../runtime/proactive-event-handler.js').ProactiveEventHandler | null
  publicObservationEventHandler: import('../runtime/public-observation-event-handler.js').PublicObservationEventHandler | null
}

export async function createNurtureEngines(deps: {
  repos: Repositories
  llmGateway: LLMGateway
  promptEngine: PromptEngine
  sseHub: SseHub
  forumReadService: ForumReadService
  agentService: AgentService
  chatService: ChatService
  statsService: StatsService
  personaStateService: PersonaStateService
  conversationClock: ConversationClock
  achievementsOrchestrator: AchievementsOrchestrator
  governanceAdapter: GovernanceAdapter
  communityCultureDigestService: CommunityCultureDigestService
  incubationOrchestrator: IncubationOrchestrator
  leaderElectors: {
    privateChannel: LeaderElector
    nurture: LeaderElector
    relation: LeaderElector
    achievements: LeaderElector
    cultureDigest: LeaderElector
  }
}): Promise<NurtureResult> {
  const {
    repos, llmGateway, promptEngine, sseHub,
    forumReadService, agentService, chatService, statsService, personaStateService,
    conversationClock, achievementsOrchestrator, governanceAdapter,
    communityCultureDigestService, incubationOrchestrator,
  } = deps

  let traitEngine: import('../services/trait-engine.js').TraitEngine | null = null
  let instructionEngine: import('../services/instruction-engine.js').InstructionEngine | null = null
  let xpEngine: import('../services/xp-service.js').XpService | null = null
  let memoryService: import('../services/memory-service.js').MemoryService | null = null
  let relationService: RelationService | null = null
  let relationScheduler: RelationScheduler | null = null
  let nurtureOrchestrator: NurtureOrchestrator | null = null
  let nurtureScheduler: NurtureScheduler | null = null
  let achievementsScheduler: AchievementsScheduler | null = null
  let cultureDigestScheduler: CultureDigestScheduler | null = null
  let privateChannelServices: NurtureResult['privateChannelServices'] = null
  let privateChannelScheduler: NurtureResult['privateChannelScheduler'] = null
  let proactiveEventHandler: NurtureResult['proactiveEventHandler'] = null
  let publicObservationEventHandler: NurtureResult['publicObservationEventHandler'] = null

  if (config.db.usePrisma) {
    const { getPrismaClient } = await import('../persistence/prisma-client.js')
    const prisma = getPrismaClient()
    ;(globalThis as Record<string, unknown>).__forumPrisma = prisma

    const { TraitEngine } = await import('../services/trait-engine.js')
    const { InstructionEngine } = await import('../services/instruction-engine.js')
    const { XpService } = await import('../services/xp-service.js')
    const { MemoryService } = await import('../services/memory-service.js')
    const { NotificationService } = await import('../services/notification-service.js')
    const { ProactiveInteractionService } = await import('../services/proactive-interaction-service.js')
    const { ProactiveEventHandler } = await import('../runtime/proactive-event-handler.js')
    const { PublicObservationEventHandler } = await import('../runtime/public-observation-event-handler.js')
    const { PgPrivateChannelRepository } = await import('../repos/pg/pg-private-channel-repository.js')
    const { PgMemoryRepository } = await import('../repos/pg/pg-memory-repository.js')
    const {
      PgRawContextEventRepository,
      PgEpisodicCardRepository,
      PgContextRelationStateRepository,
      PgSelfModelStateRepository,
      PgActiveTensionItemRepository,
      PgPrivateShadowMemoryRepository,
    } = await import('../repos/pg/pg-context-memory-repository.js')
    const { PgNotificationRepository } = await import('../repos/pg/pg-notification-repository.js')
    const {
      DefaultContextJournalService,
      LlmIdentityFinalizer,
      LlmSummaryOrchestrator,
    } = await import('../context-memory/runtime.js')

    traitEngine = new TraitEngine(prisma)
    instructionEngine = new InstructionEngine(prisma)
    xpEngine = new XpService(prisma)
    statsService.setXpService(xpEngine)

    if (repos.relationRepo) {
      relationService = new RelationService({
        relationRepo: repos.relationRepo,
        agentRepo: repos.agentRepo,
        agentService,
        traitEngine,
        postRepo: repos.postRepo,
        commentRepo: repos.commentRepo,
        roomRepo: repos.roomRepo,
        messageRepo: repos.messageRepo,
        statsService,
        metrics: new RelationMetrics(),
      })
      if (achievementsOrchestrator) {
        relationService.setStateChangeHook((input) => achievementsOrchestrator.processRelationStateChange(input))
      }
    }

    nurtureOrchestrator = new NurtureOrchestrator({
      agentRepo: repos.agentRepo,
      xpService: xpEngine,
      traitEngine,
      personaStateService,
    })

    const channelRepo = new PgPrivateChannelRepository(prisma)
    const memoryRepo = new PgMemoryRepository(prisma)
    const rawContextEventRepo = new PgRawContextEventRepository(prisma)
    const episodicCardRepo = new PgEpisodicCardRepository(prisma)
    const contextRelationStateRepo = new PgContextRelationStateRepository(prisma)
    const selfModelStateRepo = new PgSelfModelStateRepository(prisma)
    const activeTensionRepo = new PgActiveTensionItemRepository(prisma)
    const privateShadowRepo = new PgPrivateShadowMemoryRepository(prisma)
    const notificationRepo = new PgNotificationRepository(prisma)
    const notificationService = new NotificationService(notificationRepo)
    const contextJournalService = new DefaultContextJournalService(rawContextEventRepo)
    const summaryOrchestrator = new LlmSummaryOrchestrator({ llmGateway, agentService })
    const identityFinalizer = new LlmIdentityFinalizer({ llmGateway, agentService })

    memoryService = new MemoryService({
      memoryRepo,
      channelRepo,
      llmGateway,
      agentService,
      eventRepo: repos.eventRepo,
      agentRunRepo: repos.agentRunRepo,
      xpService: xpEngine,
      nurtureOrchestrator,
      relationService,
      statsService,
      contextMemory: {
        journalService: contextJournalService,
        rawEventRepo: rawContextEventRepo,
        summaryOrchestrator,
        identityFinalizer,
        episodicCardRepo,
        relationStateRepo: contextRelationStateRepo,
        selfModelStateRepo,
        activeTensionRepo,
        privateShadowRepo,
        chronicleRepo: repos.chronicleRepo,
      },
    })

    memoryService.setDigestHook(async (input) => {
      if (achievementsOrchestrator) {
        await achievementsOrchestrator.processPrivateDigest(input)
      }
      await personaStateService.recordPrivateDigest({
        agentId: input.agent_id,
        sessionId: input.session_id,
        memoryId: input.memory_id,
        importanceScore: input.importance_score,
        sentiment: input.sentiment ?? 'neutral',
      })
      await incubationOrchestrator.onPrivateDigestCompleted(input)
    })

    const publicObservationDigestService = new PublicObservationDigestService({
      llmGateway,
      forumReadService,
      roomRepo: repos.roomRepo,
      messageRepo: repos.messageRepo,
      memoryService,
      agentService,
      eventRepo: repos.eventRepo,
      agentRunRepo: repos.agentRunRepo,
    })
    publicObservationEventHandler = new PublicObservationEventHandler({
      digestService: publicObservationDigestService,
    })

    const proactiveInteractionService = new ProactiveInteractionService({
      channelRepo,
      agentService,
      llmGateway,
      personaStateService,
      eventRepo: repos.eventRepo,
      agentRunRepo: repos.agentRunRepo,
      notificationService,
    })

    proactiveEventHandler = new ProactiveEventHandler({
      proactiveService: proactiveInteractionService,
      forumReadService,
      agentService,
    })

    const { BudgetService } = await import('../services/budget-service.js')
    const { CostTracker } = await import('../services/cost-tracker.js')
    const budgetService = new BudgetService(prisma)
    const costTracker = new CostTracker(prisma)
    llmGateway.setBudgetChecker(async ({ agentId }) => budgetService.checkBudget(agentId))

    const { PrivateChannelService } = await import('../services/private-channel-service.js')
    const { PrivateChannelScheduler } = await import('../runtime/private-channel-scheduler.js')

    const channelService = new PrivateChannelService({
      channelRepo,
      memoryRepo,
      agentService,
      llmGateway,
      personaStateService,
      eventRepo: repos.eventRepo,
      agentRunRepo: repos.agentRunRepo,
      budgetService,
      costTracker,
      sseHub,
    })
    privateChannelServices = { channelService, memoryService }

    privateChannelScheduler = new PrivateChannelScheduler({
      channelService,
      memoryService,
      agentRepo: repos.agentRepo,
      leaderElector: deps.leaderElectors.privateChannel,
    })

    chatService.setXpService(xpEngine)
    chatService.setNurtureOrchestrator(nurtureOrchestrator)
    chatService.setPublicObservationService(publicObservationDigestService)
    chatService.setRelationService(relationService)

    if (config.features.nurturePipelineV2 && nurtureOrchestrator) {
      nurtureScheduler = new NurtureScheduler({
        orchestrator: nurtureOrchestrator,
        leaderElector: deps.leaderElectors.nurture,
      })
    }

    if (config.features.socialGraphV1 && relationService) {
      relationScheduler = new RelationScheduler({
        relationService,
        leaderElector: deps.leaderElectors.relation,
      })
    }

    // Wire prompt orchestrator into private channel + proactive services
    const promptLayerSvc = new PromptLayerService({
      agentService,
      traitEngine,
      instructionEngine,
      memoryService,
      statsService,
      personaStateService,
    })
    const promptOrch = new PromptOrchestrator({
      promptLayerService: promptLayerSvc,
      personaStateService,
    })
    conversationClock.setPromptLayerService(promptLayerSvc)
    conversationClock.setPromptOrchestrator(promptOrch)

    if (privateChannelServices) {
      privateChannelServices.channelService.bindPromptOrchestrator(promptEngine, promptOrch)
    }
    if (proactiveInteractionService) {
      proactiveInteractionService.bindPromptOrchestrator(promptEngine, promptOrch)
    }

    // Governance + achievements hooks
    governanceAdapter.setExecutedHook(({ action, target_agent_id }) =>
      achievementsOrchestrator.processGovernanceResult({
        target_agent_id,
        action: action.action,
        source_ref_id: action.target_id,
        admin_user_id: action.admin_user_id,
      }),
    )

    if (config.features.achievementChronicleV1) {
      achievementsScheduler = new AchievementsScheduler({
        orchestrator: achievementsOrchestrator,
        leaderElector: deps.leaderElectors.achievements,
      })
    }

    if (config.features.communityDigestV1 && communityCultureDigestService) {
      cultureDigestScheduler = new CultureDigestScheduler({
        digestService: communityCultureDigestService,
        leaderElector: deps.leaderElectors.cultureDigest,
      })
    }

    return {
      traitEngine,
      instructionEngine,
      xpService: xpEngine,
      memoryService,
      promptLayerService: promptLayerSvc,
      promptOrchestrator: promptOrch,
      relationService,
      relationScheduler,
      nurtureOrchestrator,
      nurtureScheduler,
      achievementsScheduler,
      cultureDigestScheduler,
      privateChannelServices,
      privateChannelScheduler,
      proactiveEventHandler,
      publicObservationEventHandler,
    }
  }

  // Non-Prisma path: minimal wiring
  governanceAdapter.setExecutedHook(({ action, target_agent_id }) =>
    achievementsOrchestrator.processGovernanceResult({
      target_agent_id,
      action: action.action,
      source_ref_id: action.target_id,
      admin_user_id: action.admin_user_id,
    }),
  )

  if (config.features.achievementChronicleV1) {
    achievementsScheduler = new AchievementsScheduler({
      orchestrator: achievementsOrchestrator,
      leaderElector: deps.leaderElectors.achievements,
    })
  }

  if (config.features.communityDigestV1 && communityCultureDigestService) {
    cultureDigestScheduler = new CultureDigestScheduler({
      digestService: communityCultureDigestService,
      leaderElector: deps.leaderElectors.cultureDigest,
    })
  }

  const promptLayerService = new PromptLayerService({
    agentService,
    traitEngine: null,
    instructionEngine: null,
    memoryService: null,
    statsService,
    personaStateService,
  })
  const promptOrchestrator = new PromptOrchestrator({
    promptLayerService,
    personaStateService,
  })
  conversationClock.setPromptLayerService(promptLayerService)
  conversationClock.setPromptOrchestrator(promptOrchestrator)

  return {
    traitEngine,
    instructionEngine,
    xpService: xpEngine,
    memoryService,
    promptLayerService,
    promptOrchestrator,
    relationService,
    relationScheduler,
    nurtureOrchestrator,
    nurtureScheduler,
    achievementsScheduler,
    cultureDigestScheduler,
    privateChannelServices,
    privateChannelScheduler,
    proactiveEventHandler,
    publicObservationEventHandler,
  }
}
