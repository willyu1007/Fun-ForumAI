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
import type { LlmClient } from '../llm/llm-client.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { PromptLayerService } from '../runtime/prompt-layer-service.js'
import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import type { ForumReadService } from '../services/forum-read-service.js'
import type { ForumWriteService } from '../services/forum-write-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { ChatService } from '../services/chat-service.js'
import type { InclinationAssetService } from '../services/inclination-asset-service.js'
import type { CommunityCultureDigestService } from '../services/community-culture-digest-service.js'
import type { PersonaStateService } from '../services/persona-state-service.js'
import type { XpService } from '../services/xp-service.js'
import type { NurtureOrchestrator } from '../services/nurture-orchestrator.js'
import type { AgentRunRepository } from '../repos/event-repository.js'
import type { EventRepository } from '../repos/event-repository.js'
import type { PostRepository } from '../repos/post-repository.js'
import type { CommentRepository } from '../repos/comment-repository.js'
import { config } from '../lib/config.js'

export function createRuntime(deps: {
  llmClient: LlmClient
  promptEngine: PromptEngine
  forumReadService: ForumReadService
  forumWriteService: ForumWriteService
  agentService: AgentService
  chatService: ChatService
  inclinationAssetService: InclinationAssetService
  communityCultureDigestService: CommunityCultureDigestService | null
  personaStateService: PersonaStateService
  promptLayerService: PromptLayerService | null
  promptOrchestrator: PromptOrchestrator | null
  traitEngine: import('../services/trait-engine.js').TraitEngine | null
  instructionEngine: import('../services/instruction-engine.js').InstructionEngine | null
  memoryService: import('../services/memory-service.js').MemoryService | null
  xpService: XpService | null
  nurtureOrchestrator: NurtureOrchestrator | null
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
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
    traitEngine: deps.traitEngine,
    instructionEngine: deps.instructionEngine,
    memoryService: deps.memoryService,
    promptLayerService: deps.promptLayerService,
    promptOrchestrator: deps.promptOrchestrator,
    communityPromptProfileCompiler,
    communityCultureDigestService: deps.communityCultureDigestService,
  })

  const responseParser = new ResponseParser()

  const dataplaneWriter = new DataPlaneWriter({
    forumWriteService: deps.forumWriteService,
    agentRunRepo: deps.agentRunRepo,
    chatService: deps.chatService,
    xpService: deps.xpService,
    nurtureOrchestrator: deps.nurtureOrchestrator,
    inclinationAssetService: deps.inclinationAssetService,
  })

  const agentExecutor = new AgentExecutor({
    llmClient: deps.llmClient,
    promptEngine: deps.promptEngine,
    contextBuilder,
    responseParser,
    dataplaneWriter,
    agentRunRepo: deps.agentRunRepo,
    agentService: deps.agentService,
    personaStateService: deps.personaStateService,
  })

  const postScheduler = new PostScheduler(
    {
      llmClient: deps.llmClient,
      promptEngine: deps.promptEngine,
      forumReadService: deps.forumReadService,
      agentService: deps.agentService,
      responseParser,
      dataplaneWriter,
      eventRepo: deps.eventRepo,
      agentRunRepo: deps.agentRunRepo,
      inclinationAssetService: deps.inclinationAssetService,
      promptOrchestrator: deps.promptOrchestrator,
      personaStateService: deps.personaStateService,
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
