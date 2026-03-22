import { ContextBuilder } from '../runtime/context-builder.js'
import { CommunityPromptProfileCompiler } from '../runtime/community-prompt-profile-compiler.js'
import { ResponseParser } from '../runtime/response-parser.js'
import { DataPlaneWriter } from '../runtime/data-plane-writer.js'
import { AgentExecutor } from '../runtime/agent-executor.js'
import { RuntimeLoop } from '../runtime/runtime-loop.js'
import { EventBridge } from '../runtime/event-bridge.js'
import { PostScheduler } from '../runtime/post-scheduler.js'
import type { RuntimeEventQueue } from '../runtime/event-queue.js'
import type { LeaderElector } from '../runtime/leader-elector.js'
import type { EventAllocator, DefaultDegradationMonitor, DefaultQuotaCalculator } from '../allocator/index.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import type { ForumReadService } from '../services/forum-read-service.js'
import type { ForumWriteService } from '../services/forum-write-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { ChatService } from '../services/chat-service.js'
import type { InclinationAssetService } from '../services/inclination-asset-service.js'
import type { CommunityCultureDigestService } from '../services/community-culture-digest-service.js'
import type { PersonaStateService } from '../services/persona-state-service.js'
import type { InferenceProfileService } from '../services/inference-profile-service.js'
import type { PublicSceneSelectorService } from '../services/public-scene-selector-service.js'
import type { ForumSceneContinuityService } from '../services/forum-scene-continuity-service.js'
import type { XpService } from '../services/xp-service.js'
import type { NurtureOrchestrator } from '../services/nurture-orchestrator.js'
import type { MediaProjectionService } from '../media/media-projection-service.js'
import type { MediaWriteBridge } from '../media/media-write-bridge.js'
import type { VisualDirectiveService } from '../media/visual-directive-service.js'
import type { ImagePlannerService } from '../media/image-planner-service.js'
import type { MediaGenerationService } from '../media/media-generation-service.js'
import type { AgentRunRepository } from '../repos/event-repository.js'
import type { EventRepository } from '../repos/event-repository.js'
import type { PostRepository } from '../repos/post-repository.js'
import type { CommentRepository } from '../repos/comment-repository.js'
import type { AgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import { config } from '../lib/config.js'

export function createRuntime(deps: {
  llmGateway: LLMGateway
  forumReadService: ForumReadService
  forumWriteService: ForumWriteService
  agentService: AgentService
  chatService: ChatService
  inclinationAssetService: InclinationAssetService
  communityCultureDigestService: CommunityCultureDigestService | null
  personaStateService: PersonaStateService
  inferenceProfileService: InferenceProfileService
  publicSceneSelectorService?: PublicSceneSelectorService | null
  forumSceneContinuityService?: ForumSceneContinuityService | null
  promptOrchestrator: PromptOrchestrator | null
  mediaProjectionService: MediaProjectionService
  mediaWriteBridge: MediaWriteBridge
  visualDirectiveService: VisualDirectiveService
  imagePlannerService: ImagePlannerService
  mediaGenerationService: MediaGenerationService
  xpService: XpService | null
  nurtureOrchestrator: NurtureOrchestrator | null
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  membershipRepo: AgentCommunityMembershipRepository
  postRepo: PostRepository
  commentRepo: CommentRepository
  eventQueue: RuntimeEventQueue
  allocator: EventAllocator
  degradationMonitor: DefaultDegradationMonitor
  quotaCalc: DefaultQuotaCalculator
  runtimeLoopLeaderElector: LeaderElector
}) {
  const communityPromptProfileCompiler = new CommunityPromptProfileCompiler({
    communityCultureDigestService: deps.communityCultureDigestService,
  })

  const contextBuilder = new ContextBuilder({
    forumReadService: deps.forumReadService,
    agentService: deps.agentService,
    promptOrchestrator: deps.promptOrchestrator,
    communityPromptProfileCompiler,
    communityCultureDigestService: deps.communityCultureDigestService,
    forumSceneContinuityService: deps.forumSceneContinuityService,
  })

  const responseParser = new ResponseParser()

  const dataplaneWriter = new DataPlaneWriter({
    forumWriteService: deps.forumWriteService,
    agentRunRepo: deps.agentRunRepo,
    chatService: deps.chatService,
    xpService: deps.xpService,
    nurtureOrchestrator: deps.nurtureOrchestrator,
    mediaWriteBridge: deps.mediaWriteBridge,
  })

  const agentExecutor = new AgentExecutor({
    llmGateway: deps.llmGateway,
    contextBuilder,
    responseParser,
    dataplaneWriter,
    agentRunRepo: deps.agentRunRepo,
    agentService: deps.agentService,
    personaStateService: deps.personaStateService,
    inferenceProfileService: deps.inferenceProfileService,
  })

  const postScheduler = new PostScheduler(
    {
      llmGateway: deps.llmGateway,
      forumReadService: deps.forumReadService,
      agentService: deps.agentService,
      responseParser,
      dataplaneWriter,
      eventRepo: deps.eventRepo,
      agentRunRepo: deps.agentRunRepo,
      membershipRepo: deps.membershipRepo,
      promptOrchestrator: deps.promptOrchestrator,
      mediaProjectionService: deps.mediaProjectionService,
      visualDirectiveService: deps.visualDirectiveService,
      imagePlannerService: deps.imagePlannerService,
      mediaGenerationService: deps.mediaGenerationService,
      personaStateService: deps.personaStateService,
      inferenceProfileService: deps.inferenceProfileService,
      publicSceneSelectorService: deps.publicSceneSelectorService,
    },
    {
      postIntervalMs: config.runtime.postIntervalMs,
      postMaxPerDay: config.runtime.postMaxPerDay,
    },
  )

  const runtimeLoop = new RuntimeLoop(
    {
      queue: deps.eventQueue,
      allocator: deps.allocator,
      degradation: deps.degradationMonitor,
      quotaCalc: deps.quotaCalc,
      executor: agentExecutor,
      postScheduler,
      leaderElector: deps.runtimeLoopLeaderElector,
    },
    {
      intervalMs: config.runtime.intervalMs,
      batchSize: config.runtime.batchSize,
    },
  )

  const eventBridge = new EventBridge(deps.eventQueue, {
    postRepo: deps.postRepo,
    commentRepo: deps.commentRepo,
  })

  return { contextBuilder, agentExecutor, postScheduler, runtimeLoop, eventBridge }
}
