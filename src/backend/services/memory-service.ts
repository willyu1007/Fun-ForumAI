import type { LLMGateway } from '../llm/llm-gateway.js'
import type { PrivateChannelRepository } from '../repos/private-channel-repository.js'
import type { MemoryRepository } from '../repos/memory-repository.js'
import type {
  ActiveTensionItemRepository,
  ContextRelationStateRepository,
  EpisodicCardRepository,
  PrivateShadowMemoryRepository,
  RawContextEventRepository,
  SelfModelStateRepository,
} from '../repos/context-memory-repository.js'
import type { ChronicleRepository } from '../repos/chronicle-repository.js'
import type { XpService } from './xp-service.js'
import type { NurtureOrchestrator } from './nurture-orchestrator.js'
import type { RelationService } from './relation-service.js'
import type { StatsService } from './stats-service.js'
import type { AgentService } from './agent-service.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type {
  AgentMemory,
  AgentPrivacySettingsEntity,
  ContextMemoryScene,
  CreateAgentMemoryInput,
  EvidenceRef,
  MemorySource,
  PaginatedResult,
  PaginationOpts,
} from '../repos/types.js'
import { config } from '../lib/config.js'
import { ValidationError } from '../lib/errors.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type {
  ContextJournalService,
  IdentityFinalizer,
  SummaryOrchestrator,
} from '../context-memory/contracts.js'
import { DefaultMemoryPackRenderer, DefaultRetrievalPacker } from '../context-memory/memory-pack.js'
import {
  buildChatRoomWindowRawEventId,
  buildForumThreadRawEventId,
  buildPrivateSessionRawEvent,
  buildPrivateSessionRawEventId,
} from '../context-memory/runtime.js'
import { personaObservability } from '../runtime/persona-observability.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from '../runtime/persona-observation.js'
import { buildTranscript, parseDigestResponse } from './memory-service/digest.js'
import {
  backfillLegacyPublicObservations,
  emptyTypedRetrievalState,
  loadTypedRetrievalState,
  selectLegacyMemories,
} from './memory-service/retrieval.js'
import {
  average,
  buildNightlyCompactionSummary,
  clamp01,
  compactEpisodicCards,
  listAllEpisodicCards,
} from './memory-service/maintenance.js'
import {
  ingestTypedPublicObservation,
  isUniqueConstraintError,
  persistTypedContextState,
} from './memory-service/typed-context.js'

const DECAY_FACTOR_PER_DAY = 0.995
const FORGET_THRESHOLD = 0.05
const MIN_MESSAGES_FOR_DIGEST = 4
const NIGHTLY_SHADOW_KEEP = 4
const NIGHTLY_TENSION_DECAY = 0.94
const NIGHTLY_TENSION_FORGET_THRESHOLD = 0.22
const NIGHTLY_COMPACTION_MIN_CARDS = 2

export interface ContextMemoryRuntimeDeps {
  journalService: ContextJournalService
  rawEventRepo: RawContextEventRepository
  summaryOrchestrator: SummaryOrchestrator
  identityFinalizer: IdentityFinalizer
  episodicCardRepo: EpisodicCardRepository
  relationStateRepo: ContextRelationStateRepository
  selfModelStateRepo: SelfModelStateRepository
  activeTensionRepo: ActiveTensionItemRepository
  privateShadowRepo: PrivateShadowMemoryRepository
  chronicleRepo?: ChronicleRepository | null
}

export interface MemoryServiceDeps {
  memoryRepo: MemoryRepository
  channelRepo: PrivateChannelRepository
  llmGateway: LLMGateway
  agentService?: AgentService | null
  eventRepo?: EventRepository | null
  agentRunRepo?: AgentRunRepository | null
  xpService?: XpService | null
  nurtureOrchestrator?: NurtureOrchestrator | null
  relationService?: RelationService | null
  statsService?: StatsService | null
  contextMemory?: ContextMemoryRuntimeDeps | null
  onDigestCompleted?: (input: {
    agent_id: string
    session_id: string
    memory_id: string
    importance_score: number
    sentiment: string | null
  }) => Promise<void> | void
}

export interface MemoryForContext {
  memories: AgentMemory[]
  formatted: string
}

export class MemoryService {
  private readonly retrievalPacker = new DefaultRetrievalPacker()
  private readonly memoryPackRenderer = new DefaultMemoryPackRenderer()
  private digestHooks: Array<(input: {
    agent_id: string
    session_id: string
    memory_id: string
    importance_score: number
    sentiment: string | null
  }) => Promise<void> | void>

  constructor(private readonly deps: MemoryServiceDeps) {
    this.digestHooks = deps.onDigestCompleted ? [deps.onDigestCompleted] : []
  }

  setDigestHook(
    hook: (input: {
      agent_id: string
      session_id: string
      memory_id: string
      importance_score: number
      sentiment: string | null
    }) => Promise<void> | void,
  ): void {
    this.digestHooks = [hook]
  }

  appendDigestHook(
    hook: (input: {
      agent_id: string
      session_id: string
      memory_id: string
      importance_score: number
      sentiment: string | null
    }) => Promise<void> | void,
  ): void {
    this.digestHooks.push(hook)
  }

  async generateDigest(sessionId: string): Promise<AgentMemory | null> {
    const session = await this.deps.channelRepo.findSessionById(sessionId)
    if (!session) return null

    const msgCount = await this.deps.channelRepo.countMessages(sessionId)
    if (msgCount < MIN_MESSAGES_FOR_DIGEST) {
      await this.deps.channelRepo.updateDigestStatus(sessionId, 'SKIPPED')
      return null
    }

    await this.deps.channelRepo.updateDigestStatus(sessionId, 'GENERATING')

    try {
      const messages = await this.deps.channelRepo.listMessages(sessionId, { limit: 100 })
      const transcript = buildTranscript(messages.items)

      const memory = this.deps.contextMemory
        ? await this.generateTypedDigest(sessionId, transcript, session.agent_id, session.human_user_id, session.ended_at ?? new Date())
        : await this.generateLegacyDigest(sessionId, transcript, session.agent_id)

      await this.deps.channelRepo.updateDigestStatus(sessionId, 'COMPLETED')
      this.emitDigestSideEffects({
        agentId: session.agent_id,
        sessionId: session.id,
        msgCount,
        memory,
      })

      return memory
    } catch (err) {
      console.error('[MemoryService] Digest generation failed:', err)
      await this.deps.channelRepo.updateDigestStatus(sessionId, 'FAILED')
      return null
    }
  }

  async getMemoriesForContext(
    agentId: string,
    opts: {
      scene: 'private_chat' | 'forum' | 'chat_room'
      topicHints: string[]
      disclosureLevel: number
      tokenBudget: number
      topK: number
    },
  ): Promise<MemoryForContext> {
    const allMemories = await this.deps.memoryRepo.findActiveMemories(agentId, {})
    let effectiveTopK = opts.topK
    let effectiveBudget = opts.tokenBudget

    if (config.features.agentStatsBehavior && this.deps.statsService) {
      const knobs = this.deps.statsService.getDerivedSync(agentId, {
        privacy_top_k: opts.topK,
        privacy_budget: opts.tokenBudget,
      })
      effectiveTopK = knobs.memory.effective_top_k
      effectiveBudget = knobs.memory.effective_budget
    }

    let filtered = allMemories
    if (opts.scene !== 'private_chat') {
      filtered = allMemories.filter((memory) => memory.privacy_floor <= opts.disclosureLevel)
    }

    const selectedLegacy = selectLegacyMemories({
      memories: filtered,
      topicHints: opts.topicHints,
      topK: effectiveTopK,
      tokenBudget: effectiveBudget,
    })
    let typed = this.deps.contextMemory
      ? await loadTypedRetrievalState({
          runtime: this.deps.contextMemory,
          agentId,
          topK: effectiveTopK,
          scene: opts.scene,
        })
      : emptyTypedRetrievalState()

    if (this.deps.contextMemory && typed.publicEpisodicCards.length === 0) {
      const backfilledCount = await backfillLegacyPublicObservations({
        runtime: this.deps.contextMemory,
        agentId,
        memories: selectedLegacy,
      })
      if (backfilledCount > 0) {
        typed = await loadTypedRetrievalState({
          runtime: this.deps.contextMemory,
          agentId,
          topK: effectiveTopK,
          scene: opts.scene,
        })
      }
    }

    const memoryPack = this.retrievalPacker.pack({
      agentId,
      scene: opts.scene,
      topicHints: opts.topicHints,
      disclosureLevel: opts.disclosureLevel,
      tokenBudget: effectiveBudget,
      legacyMemories: selectedLegacy,
      typed,
    })
    const formatted = this.memoryPackRenderer.render(memoryPack, effectiveBudget).text

    if (memoryPack.selectedMemories.length > 0) {
      await this.deps.memoryRepo.incrementAccessCount(memoryPack.selectedMemories.map((memory) => memory.id)).catch((err) => {
        console.error('[MemoryService] incrementAccessCount failed:', err)
      })
    }

    personaObservability.recordRetrieval(memoryPack.observability)

    return { memories: memoryPack.selectedMemories, formatted }
  }

  async listMemories(
    agentId: string,
    opts: PaginationOpts & {
      source_type?: MemorySource
      forgotten?: boolean
      source_session_id?: string
      source_ref_type?: string
      source_ref_id?: string
      source_event_id?: string
    },
  ): Promise<PaginatedResult<AgentMemory>> {
    return this.deps.memoryRepo.listMemories(agentId, opts)
  }

  async createPublicObservationMemory(input: {
    agent_id: string
    source_ref_type: string
    source_ref_id: string
    source_event_id?: string
    summary_text: string
    topic_tags: string[]
    key_facts: string[]
    sentiment?: string | null
    importance_score: number
    typed_context?: {
      scene: Extract<ContextMemoryScene, 'forum' | 'chat_room'>
      transcript: string
      counterpart_id?: string | null
      evidence_refs?: string[]
      created_at?: Date
    }
  }): Promise<AgentMemory> {
    const sourceEventId = input.source_event_id?.trim() || undefined
    let memory: AgentMemory | null = null
    if (sourceEventId) {
      try {
        const existing = await this.findPublicObservationByEventId(input.agent_id, sourceEventId)
        if (existing) {
          memory = existing
        }
      } catch (err) {
        console.warn('[MemoryService] public observation dedup precheck failed, fallback to create:', err)
      }
    }

    if (memory) {
      await this.maybeIngestTypedPublicObservation(memory, input, sourceEventId)
      return memory
    }

    const data: CreateAgentMemoryInput = {
      agent_id: input.agent_id,
      source_type: 'PUBLIC_OBSERVATION',
      source_ref_type: input.source_ref_type,
      source_ref_id: input.source_ref_id,
      source_event_id: sourceEventId ?? null,
      summary_text: input.summary_text,
      topic_tags: input.topic_tags,
      key_facts: input.key_facts,
      sentiment: input.sentiment ?? null,
      importance_score: input.importance_score,
      privacy_floor: 0,
    }

    try {
      memory = await this.deps.memoryRepo.createMemory(data)
      personaObservability.recordLegacyPublicDualWrite()
    } catch (err) {
      if (!sourceEventId || !isUniqueConstraintError(err)) {
        throw err
      }

      const existing = await this.findPublicObservationByEventId(input.agent_id, sourceEventId)
      if (!existing) throw err
      memory = existing
    }

    if (!memory) {
      throw new Error('public_observation_memory_missing')
    }

    await this.maybeIngestTypedPublicObservation(memory, input, sourceEventId)
    return memory
  }

  async getPrivacySettings(agentId: string): Promise<AgentPrivacySettingsEntity> {
    const settings = await this.deps.memoryRepo.getPrivacySettings(agentId)
    if (settings) return settings
    return {
      agent_id: agentId,
      disclosure_level: 1,
      public_memory_budget: 1000,
      public_memory_top_k: 4,
      public_disclosure_cap: null,
      updated_at: new Date(),
      updated_by: '',
    }
  }

  async updatePrivacySettings(
    agentId: string,
    updatedBy: string,
    changes: {
      disclosure_level?: number
      public_memory_budget?: number
      public_memory_top_k?: number
      public_disclosure_cap?: number | null
    },
  ): Promise<AgentPrivacySettingsEntity> {
    if (changes.disclosure_level !== undefined) {
      if (changes.disclosure_level < 0 || changes.disclosure_level > 3) {
        throw new ValidationError('disclosure_level must be 0-3')
      }
    }
    if (
      changes.public_disclosure_cap !== undefined
      && changes.public_disclosure_cap !== null
      && (changes.public_disclosure_cap < 0 || changes.public_disclosure_cap > 3)
    ) {
      throw new ValidationError('public_disclosure_cap must be 0-3 or null')
    }
    return this.deps.memoryRepo.upsertPrivacySettings({
      agent_id: agentId,
      ...changes,
      updated_by: updatedBy,
    })
  }

  resolveEffectiveDisclosureLevel(settings: AgentPrivacySettingsEntity): {
    requested_disclosure_level: number
    effective_disclosure_level: number
    cap_source: 'owner_setting' | 'server_cap'
    public_disclosure_cap: number | null
    server_cap_sources?: Array<{
      source_type: 'baseline'
      scope_type: 'agent'
      scope_id: string | null
      cap_level: number
      source: 'agent_privacy_settings'
    }>
  } {
    const requested = settings.disclosure_level
    const effective = settings.public_disclosure_cap === null
      ? requested
      : Math.min(requested, settings.public_disclosure_cap)
    return {
      requested_disclosure_level: requested,
      effective_disclosure_level: effective,
      cap_source: settings.public_disclosure_cap === null ? 'owner_setting' : 'server_cap',
      public_disclosure_cap: settings.public_disclosure_cap,
      ...(settings.public_disclosure_cap !== null
        ? {
            server_cap_sources: [{
              source_type: 'baseline' as const,
              scope_type: 'agent' as const,
              scope_id: settings.agent_id,
              cap_level: settings.public_disclosure_cap,
              source: 'agent_privacy_settings' as const,
            }],
          }
        : {}),
    }
  }

  async decayAndForget(agentId: string): Promise<{ decayed: number; forgotten: number }> {
    let decayPerDay = DECAY_FACTOR_PER_DAY
    let forgetThreshold = FORGET_THRESHOLD

    if (config.features.agentStatsBehavior && this.deps.statsService) {
      const knobs = this.deps.statsService.getDerivedSync(agentId)
      decayPerDay = knobs.memory.decay_per_day
      forgetThreshold = knobs.memory.forget_threshold
    }

    const decayed = await this.deps.memoryRepo.batchDecay(agentId, decayPerDay)

    const allActive = await this.deps.memoryRepo.findActiveMemories(agentId, {})
    let forgotten = 0
    for (const memory of allActive) {
      const boost = Math.log2(memory.access_count + 1) * 0.02
      const effective = memory.importance_score + boost
      if (effective < forgetThreshold) {
        await this.deps.memoryRepo.markForgotten(memory.id)
        forgotten++
      }
    }

    if (this.deps.contextMemory) {
      await this.runTypedNightlyMaintenance(agentId)
    }

    return { decayed, forgotten }
  }

  async hasTypedPublicObservationEvent(
    agentId: string,
    input: { scene: Extract<ContextMemoryScene, 'forum' | 'chat_room'>; sourceEventId: string },
  ): Promise<boolean> {
    const runtime = this.deps.contextMemory
    if (!runtime) return false
    const rawEventId = input.scene === 'forum'
      ? buildForumThreadRawEventId(input.sourceEventId)
      : buildChatRoomWindowRawEventId(input.sourceEventId)
    const row = await runtime.rawEventRepo.findById(rawEventId)
    return Boolean(row && row.agent_id === agentId)
  }

  async getLatestTypedPublicObservationAt(
    agentId: string,
    input: { scene: Extract<ContextMemoryScene, 'forum' | 'chat_room'>; sourceRefId: string },
  ): Promise<Date | null> {
    const runtime = this.deps.contextMemory
    if (!runtime) return null
    const page = await runtime.rawEventRepo.listByAgent(agentId, {
      limit: 1,
      scene: input.scene,
      source_type: input.scene === 'forum' ? 'forum_thread' : 'chat_room_window',
      source_ref_id: input.sourceRefId,
    })
    return page.items[0]?.created_at ?? null
  }

  private async generateTypedDigest(
    sessionId: string,
    transcript: string,
    agentId: string,
    ownerId: string,
    createdAt: Date,
  ): Promise<AgentMemory> {
    const runtime = this.deps.contextMemory
    if (!runtime) {
      throw new Error('context_memory_runtime_missing')
    }
    try {
      const rawEvent = await runtime.journalService.record(buildPrivateSessionRawEvent({
        eventId: buildPrivateSessionRawEventId(sessionId),
        agentId,
        sessionId,
        ownerId,
        transcript,
        createdAt,
      }))
      const extracted = await runtime.summaryOrchestrator.extract(rawEvent)
      const distilled = await runtime.summaryOrchestrator.distill(rawEvent, extracted)
      const finalized = await runtime.identityFinalizer.finalize(agentId, distilled)
      await persistTypedContextState({
        runtime: this.deps.contextMemory,
        agentId,
        distilled,
        finalized,
      })
      personaObservability.recordTypedWrite(true)

      const existing = await this.findPrivateDigestByEventId(agentId, rawEvent.id)
      if (existing) return existing

      return this.deps.memoryRepo.createMemory({
        agent_id: agentId,
        source_type: 'PRIVATE_CHAT',
        source_session_id: sessionId,
        source_event_id: rawEvent.id,
        summary_text: distilled.compatibilityDigest.summary_text,
        topic_tags: distilled.compatibilityDigest.topic_tags,
        key_facts: distilled.compatibilityDigest.key_facts,
        sentiment: distilled.compatibilityDigest.sentiment,
        importance_score: distilled.compatibilityDigest.importance_score,
        privacy_floor: 1,
      })
    } catch (error) {
      personaObservability.recordTypedWrite(false)
      throw error
    }
  }

  private async generateLegacyDigest(
    sessionId: string,
    transcript: string,
    agentId: string,
  ): Promise<AgentMemory> {
    const startMs = Date.now()
    const llmResponse = await this.deps.llmGateway.generateHiddenArtifact({
      intent: 'private_digest',
      scene: 'background_hidden',
      agentId,
      homeVoiceLineId: 'deepseek-director-v1',
      promptRef: PROMPT_TEMPLATE_REFS.internalPrivateChatDigest,
      variables: {
        transcript,
      },
      budgetClass: 'hidden_background',
      traceId: `private-digest:${sessionId}`,
      requestedTier: 'premium',
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
      temperature: 0.3,
    })

    const parsed = parseDigestResponse(llmResponse.content)
    const memory = await this.deps.memoryRepo.createMemory({
      agent_id: agentId,
      source_type: 'PRIVATE_CHAT',
      source_session_id: sessionId,
      summary_text: parsed.summary_text,
      topic_tags: parsed.topic_tags,
      key_facts: parsed.key_facts,
      sentiment: parsed.sentiment,
      importance_score: parsed.importance_score,
      privacy_floor: 1,
    })
    this.recordDigestRun({
      agentId,
      sessionId,
      memoryId: memory.id,
      summaryText: parsed.summary_text,
      usage: llmResponse.usage,
      latencyMs: Date.now() - startMs,
      parseSuccess: parsed.parse_success,
      llmProviderId: llmResponse.renderDecision.providerId,
      llmModelId: llmResponse.renderDecision.modelId,
    })
    return memory
  }

  private emitDigestSideEffects(input: {
    agentId: string
    sessionId: string
    msgCount: number
    memory: AgentMemory
  }): void {
    if (config.features.nurturePipelineV2 && this.deps.nurtureOrchestrator) {
      this.deps.nurtureOrchestrator.onPrivateDigestCompleted(input.agentId, input.msgCount, {
        dedup_key: `session:${input.sessionId}`,
      }).catch((err) => {
        console.error('[MemoryService] Nurture pipeline failed:', err)
      })
    } else if (this.deps.xpService) {
      this.deps.xpService.awardPrivateChatXP(input.agentId, input.msgCount).catch((err) => {
        console.error('[MemoryService] XP award failed:', err)
      })
    }

    if (config.features.socialGraphV1 && this.deps.relationService) {
      this.deps.relationService.onPrivateDigestCompleted(input.agentId, input.sessionId).catch((err) => {
        console.error('[MemoryService] relationService onPrivateDigestCompleted failed:', err)
      })
    }

    for (const hook of this.digestHooks) {
      Promise.resolve(hook({
        agent_id: input.agentId,
        session_id: input.sessionId,
        memory_id: input.memory.id,
        importance_score: input.memory.importance_score,
        sentiment: input.memory.sentiment,
      })).catch((hookError) => {
        console.error('[MemoryService] digest hook failed:', hookError)
      })
    }
  }

  private recordDigestRun(input: {
    agentId: string
    sessionId: string
    memoryId: string
    summaryText: string
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    latencyMs: number
    parseSuccess: boolean
    llmProviderId?: string
    llmModelId?: string
  }): void {
    if (!this.deps.eventRepo || !this.deps.agentRunRepo) {
      return
    }

    const identity = this.resolveObservationIdentity(input.agentId)
    const observation = buildPersonaObservation({
      sourceCallsiteId: 'memory-private-digest',
      scene: 'background_hidden',
      intent: 'private_digest',
      visibility: 'hidden',
      coverageStatus: 'hidden_partial',
      personaSeedCode: identity?.persona_seed_code,
      homeVoiceLineId: identity?.home_voice_line_id,
      routingVoiceLineId: 'deepseek-director-v1',
      promptRef: { id: 'internal-private-chat-digest', version: 1 },
      requestedTier: 'premium',
      resolvedTier: 'premium',
      usage: input.usage,
      latencyMs: input.latencyMs,
      parseSuccess: input.parseSuccess,
      llmProviderId: input.llmProviderId,
      llmModelId: input.llmModelId,
    })

    try {
      const event = this.deps.eventRepo.create({
        event_type: 'PRIVATE_DIGEST_GENERATED',
        plane: 'RUNTIME',
        actor_type: 'agent',
        actor_id: input.agentId,
        correlation_id: `private-session:${input.sessionId}`,
        payload_json: {
          agent_id: input.agentId,
          session_id: input.sessionId,
          memory_id: input.memoryId,
        },
      })

      this.deps.agentRunRepo.create({
        agent_id: input.agentId,
        trigger_event_id: event.id,
        input_digest: `private_digest|session:${input.sessionId}`,
        output_json: attachPersonaObservation(
          {
            session_id: input.sessionId,
            memory_id: input.memoryId,
            summary_len: input.summaryText.length,
          },
          observation,
        ),
        token_cost: input.usage.total_tokens,
        latency_ms: input.latencyMs,
      })
      recordPersonaObservation(observation)
    } catch (err) {
      console.error('[MemoryService] AgentRun record failed:', err)
    }
  }

  private resolveObservationIdentity(agentId: string): {
    persona_seed_code: import('../../shared/agent-persona-catalog.js').PersonaSeedCode
    home_voice_line_id: import('../../shared/agent-persona-catalog.js').VoiceLineId
  } | null {
    if (!this.deps.agentService) {
      return null
    }

    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      const resolved = resolveAgentIdentity(agent, latestConfig)
      return {
        persona_seed_code: resolved.summary.persona_seed_code,
        home_voice_line_id: resolved.summary.home_voice_line_id,
      }
    } catch {
      return null
    }
  }

  private async findPrivateDigestByEventId(agentId: string, sourceEventId: string): Promise<AgentMemory | null> {
    const result = await this.deps.memoryRepo.listMemories(agentId, {
      limit: 1,
      source_type: 'PRIVATE_CHAT',
      source_event_id: sourceEventId,
      forgotten: false,
    })
    return result.items[0] ?? null
  }

  private async findPublicObservationByEventId(agentId: string, sourceEventId: string): Promise<AgentMemory | null> {
    const result = await this.deps.memoryRepo.listMemories(agentId, {
      limit: 1,
      source_type: 'PUBLIC_OBSERVATION',
      source_event_id: sourceEventId,
      forgotten: false,
    })
    return result.items[0] ?? null
  }

  private async maybeIngestTypedPublicObservation(
    memory: AgentMemory,
    input: Parameters<MemoryService['createPublicObservationMemory']>[0],
    sourceEventId?: string,
  ): Promise<void> {
    if (!this.deps.contextMemory || !input.typed_context) return
    try {
      await ingestTypedPublicObservation({
        runtime: this.deps.contextMemory,
        memory,
        sourceEventId,
        payload: input,
      })
      personaObservability.recordTypedWrite(true)
    } catch (err) {
      personaObservability.recordTypedWrite(false)
      console.error('[MemoryService] typed public observation ingest failed:', err)
    }
  }

  private async runTypedNightlyMaintenance(agentId: string): Promise<void> {
    const runtime = this.deps.contextMemory
    if (!runtime) return

    try {
      const [allCards, shadows, tensions, selfModel] = await Promise.all([
        listAllEpisodicCards({ runtime: this.deps.contextMemory, agentId }),
        runtime.privateShadowRepo.listByAgent(agentId, 12),
        runtime.activeTensionRepo.listByAgent(agentId, 10),
        runtime.selfModelStateRepo.findByAgent(agentId),
      ])

      const now = new Date()
      const compacted = compactEpisodicCards(allCards, now)
      const nextTensions = tensions
        .map((item) => ({
          id: item.id,
          agent_id: item.agent_id,
          label: item.label,
          description: item.description,
          intensity: clamp01(item.intensity * NIGHTLY_TENSION_DECAY),
          evidence_refs: [...item.evidence_refs],
        }))
        .filter((item) => item.intensity >= NIGHTLY_TENSION_FORGET_THRESHOLD)
        .slice(0, 5)

      await Promise.all(compacted.kept.map((card) => runtime.episodicCardRepo.upsert({
        id: card.id,
        agent_id: card.agent_id,
        event_id: card.event_id,
        scene: card.scene,
        title: card.title,
        summary: card.summary,
        topic_tags: card.topic_tags,
        evidence_refs: card.evidence_refs,
        salience: card.salience,
        created_at: card.created_at,
      })))

      if (compacted.prunedIds.length > 0) {
        await runtime.episodicCardRepo.pruneByIds(agentId, compacted.prunedIds)
      }

      await runtime.activeTensionRepo.replaceForAgent(agentId, nextTensions)

      if (selfModel) {
        await runtime.selfModelStateRepo.upsert({
          id: selfModel.id,
          agent_id: selfModel.agent_id,
          summary: selfModel.summary,
          tensions: nextTensions.map((item) => item.label),
          evidence_refs: selfModel.evidence_refs,
        })
      }

      const shadowPrunedIds = shadows.slice(NIGHTLY_SHADOW_KEEP).map((item) => item.id)
      if (shadowPrunedIds.length > 0) {
        await runtime.privateShadowRepo.pruneByIds(agentId, shadowPrunedIds)
      }

      let compactionCreated = false
      let compactionDedupHit = false
      if (runtime.chronicleRepo && compacted.mergeCandidates.length >= NIGHTLY_COMPACTION_MIN_CARDS) {
        const dedupKey = `context-nightly:${agentId}:${now.toISOString().slice(0, 10)}`
        const existing = await runtime.chronicleRepo.findByDedupKey(agentId, dedupKey)
        if (existing) {
          compactionDedupHit = true
        } else {
          const evidence = compacted.mergeCandidates
            .slice(0, 5)
            .map((card) => ({
              kind: 'context_episode',
              ref_id: card.id,
              summary: card.title,
            } satisfies EvidenceRef))
          await runtime.chronicleRepo.create({
            agent_id: agentId,
            visibility: 'OWNER_ONLY',
            type: 'HIGHLIGHT',
            occurred_at: now,
            title: 'Nightly Context Compaction',
            summary: buildNightlyCompactionSummary(compacted.mergeCandidates),
            importance_score: clamp01(average(compacted.mergeCandidates.map((card) => card.salience)) + 0.05),
            evidence,
            tags: ['context:nightly', 'context:compaction', ...Array.from(new Set(compacted.mergeCandidates.map((card) => `scene:${card.scene}`)))],
            meta: {
              source: 'context_memory_nightly',
              event_ids: compacted.mergeCandidates.map((card) => card.event_id).filter((value): value is string => Boolean(value)),
            },
            dedup_key: dedupKey,
          })
          compactionCreated = true
        }
      }

      personaObservability.recordNightlyCompaction({
        created: compactionCreated,
        dedupHit: compactionDedupHit,
        failed: false,
      })
    } catch (error) {
      personaObservability.recordNightlyCompaction({
        created: false,
        dedupHit: false,
        failed: true,
      })
      throw error
    }
  }
}
