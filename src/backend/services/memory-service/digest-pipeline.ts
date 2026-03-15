import { config } from '../../lib/config.js'
import { resolveAgentIdentity } from '../../identity/agent-identity.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'
import { buildPrivateSessionRawEvent, buildPrivateSessionRawEventId } from '../../context-memory/runtime.js'
import { personaObservability } from '../../runtime/persona-observability.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from '../../runtime/persona-observation.js'
import { buildTranscript, parseDigestResponse } from './digest.js'
import { MIN_MESSAGES_FOR_DIGEST } from './constants.js'
import { persistTypedContextState } from './typed-context.js'
import type {
  AgentMemory,
  MemoryServiceDeps,
  MemoryServiceState,
} from './types.js'

export async function generateDigest(
  deps: MemoryServiceDeps,
  state: MemoryServiceState,
  sessionId: string,
): Promise<AgentMemory | null> {
  const session = await deps.channelRepo.findSessionById(sessionId)
  if (!session) return null

  const msgCount = await deps.channelRepo.countMessages(sessionId)
  if (msgCount < MIN_MESSAGES_FOR_DIGEST) {
    await deps.channelRepo.updateDigestStatus(sessionId, 'SKIPPED')
    return null
  }

  await deps.channelRepo.updateDigestStatus(sessionId, 'GENERATING')

  try {
    const messages = await deps.channelRepo.listMessages(sessionId, { limit: 100 })
    const transcript = buildTranscript(messages.items)

    const memory = deps.contextMemory
      ? await generateTypedDigest(
          deps,
          sessionId,
          transcript,
          session.agent_id,
          session.human_user_id,
          session.ended_at ?? new Date(),
        )
      : await generateLegacyDigest(deps, sessionId, transcript, session.agent_id)

    await deps.channelRepo.updateDigestStatus(sessionId, 'COMPLETED')
    emitDigestSideEffects(deps, state, {
      agentId: session.agent_id,
      sessionId: session.id,
      msgCount,
      memory,
    })

    return memory
  } catch (err) {
    console.error('[MemoryService] Digest generation failed:', err)
    await deps.channelRepo.updateDigestStatus(sessionId, 'FAILED')
    return null
  }
}

async function generateTypedDigest(
  deps: MemoryServiceDeps,
  sessionId: string,
  transcript: string,
  agentId: string,
  ownerId: string,
  createdAt: Date,
): Promise<AgentMemory> {
  const runtime = deps.contextMemory
  if (!runtime) {
    throw new Error('context_memory_runtime_missing')
  }
  try {
    const rawEvent = await runtime.journalService.record(
      buildPrivateSessionRawEvent({
        eventId: buildPrivateSessionRawEventId(sessionId),
        agentId,
        sessionId,
        ownerId,
        transcript,
        createdAt,
      }),
    )
    const extracted = await runtime.summaryOrchestrator.extract(rawEvent)
    const distilled = await runtime.summaryOrchestrator.distill(rawEvent, extracted)
    const finalized = await runtime.identityFinalizer.finalize(agentId, distilled)
    await persistTypedContextState({
      runtime,
      agentId,
      distilled,
      finalized,
    })
    personaObservability.recordTypedWrite(true)

    const existing = await findPrivateDigestByEventId(deps, agentId, rawEvent.id)
    if (existing) return existing

    return deps.memoryRepo.createMemory({
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

async function generateLegacyDigest(
  deps: MemoryServiceDeps,
  sessionId: string,
  transcript: string,
  agentId: string,
): Promise<AgentMemory> {
  const startMs = Date.now()
  const llmResponse = await deps.llmGateway.generateHiddenArtifact({
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
  const memory = await deps.memoryRepo.createMemory({
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
  recordDigestRun(deps, {
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

function emitDigestSideEffects(
  deps: MemoryServiceDeps,
  state: MemoryServiceState,
  input: {
    agentId: string
    sessionId: string
    msgCount: number
    memory: AgentMemory
  },
): void {
  if (config.features.nurturePipelineV2 && deps.nurtureOrchestrator) {
    deps.nurtureOrchestrator
      .onPrivateDigestCompleted(input.agentId, input.msgCount, {
        dedup_key: `session:${input.sessionId}`,
      })
      .catch((err) => {
        console.error('[MemoryService] Nurture pipeline failed:', err)
      })
  } else if (deps.xpService) {
    deps.xpService.awardPrivateChatXP(input.agentId, input.msgCount).catch((err) => {
      console.error('[MemoryService] XP award failed:', err)
    })
  }

  if (config.features.socialGraphV1 && deps.relationService) {
    deps.relationService.onPrivateDigestCompleted(input.agentId, input.sessionId).catch((err) => {
      console.error('[MemoryService] relationService onPrivateDigestCompleted failed:', err)
    })
  }

  for (const hook of state.getDigestHooks()) {
    Promise.resolve(
      hook({
        agent_id: input.agentId,
        session_id: input.sessionId,
        memory_id: input.memory.id,
        importance_score: input.memory.importance_score,
        sentiment: input.memory.sentiment,
      }),
    ).catch((hookError) => {
      console.error('[MemoryService] digest hook failed:', hookError)
    })
  }
}

function recordDigestRun(
  deps: MemoryServiceDeps,
  input: {
    agentId: string
    sessionId: string
    memoryId: string
    summaryText: string
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    latencyMs: number
    parseSuccess: boolean
    llmProviderId?: string
    llmModelId?: string
  },
): void {
  if (!deps.eventRepo || !deps.agentRunRepo) {
    return
  }

  const identity = resolveObservationIdentity(deps, input.agentId)
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
    const event = deps.eventRepo.create({
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

    deps.agentRunRepo.create({
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

function resolveObservationIdentity(
  deps: MemoryServiceDeps,
  agentId: string,
): {
  persona_seed_code: import('../../../shared/agent-persona-catalog.js').PersonaSeedCode
  home_voice_line_id: import('../../../shared/agent-persona-catalog.js').VoiceLineId
} | null {
  if (!deps.agentService) {
    return null
  }

  try {
    const agent = deps.agentService.getAgent(agentId)
    const latestConfig = deps.agentService.getLatestConfig(agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    return {
      persona_seed_code: resolved.summary.persona_seed_code,
      home_voice_line_id: resolved.summary.home_voice_line_id,
    }
  } catch {
    return null
  }
}

async function findPrivateDigestByEventId(
  deps: MemoryServiceDeps,
  agentId: string,
  sourceEventId: string,
): Promise<AgentMemory | null> {
  const result = await deps.memoryRepo.listMemories(agentId, {
    limit: 1,
    source_type: 'PRIVATE_CHAT',
    source_event_id: sourceEventId,
    forgotten: false,
  })
  return result.items[0] ?? null
}
