import { InMemoryPostRepository } from './repos/post-repository.js'
import { InMemoryCommentRepository } from './repos/comment-repository.js'
import { InMemoryVoteRepository } from './repos/vote-repository.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from './repos/agent-repository.js'
import { InMemoryCommunityRepository } from './repos/community-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from './repos/event-repository.js'

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

import { SseHub } from './sse/hub.js'

import { config } from './lib/config.js'

// ─── Repositories ───────────────────────────────────────────

const postRepo = new InMemoryPostRepository()
const commentRepo = new InMemoryCommentRepository()
const voteRepo = new InMemoryVoteRepository()
const agentRepo = new InMemoryAgentRepository()
const agentConfigRepo = new InMemoryAgentConfigRepository()
export const communityRepo = new InMemoryCommunityRepository()
const eventRepo = new InMemoryEventRepository()
const agentRunRepo = new InMemoryAgentRunRepository()

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

// ─── Agent Runtime ──────────────────────────────────────────

const contextBuilder = new ContextBuilder({
  forumReadService,
  agentService,
})

const responseParser = new ResponseParser()

const dataplaneWriter = new DataPlaneWriter({
  forumWriteService,
  agentRunRepo,
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

// ─── SSE Hub ─────────────────────────────────────────────────

export const sseHub = new SseHub()

// ─── Event Bridge ───────────────────────────────────────────

export const eventBridge = new EventBridge(eventQueue)

forumWriteService.setEventHook((event) => {
  eventBridge.bridge(event)

  sseHub.broadcast({
    type: event.event_type,
    payload: event.payload_json,
  })
})

// ─── Persistence Sync ────────────────────────────────────────

export async function createPersistenceSync() {
  const { PersistenceSync } = await import('./persistence/sync.js')
  const { getPrismaClient } = await import('./persistence/prisma-client.js')
  return new PersistenceSync({
    prisma: getPrismaClient(),
    postRepo,
    commentRepo,
    voteRepo,
    agentRepo,
    agentConfigRepo,
    communityRepo,
    eventRepo,
    agentRunRepo,
    forumWriteService,
  })
}
