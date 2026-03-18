import { buildPrivateSessionRawEvent, buildPrivateSessionRawEventId } from '../../context-memory/runtime.js'
import { personaObservability } from '../../runtime/persona-observability.js'
import { buildTranscript } from './digest.js'
import { MIN_MESSAGES_FOR_DIGEST } from './constants.js'
import { runTypedContextPipeline } from './typed-context.js'
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

    if (!deps.contextMemory) {
      console.error('[MemoryService] contextMemory runtime missing; private digest pipeline is unavailable')
      await deps.channelRepo.updateDigestStatus(sessionId, 'FAILED')
      return null
    }

    const memory = await generateTypedDigest(
      deps,
      sessionId,
      transcript,
      session.agent_id,
      session.human_user_id,
      session.ended_at ?? new Date(),
    )

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
  try {
    const { recorded, distilled } = await runTypedContextPipeline({
      runtime,
      agentId,
      rawEvent: buildPrivateSessionRawEvent({
        eventId: buildPrivateSessionRawEventId(sessionId),
        agentId,
        sessionId,
        ownerId,
        transcript,
        createdAt,
      }),
    })
    personaObservability.recordTypedWrite(true)

    const existing = await findPrivateDigestByEventId(deps, agentId, recorded.id)
    if (existing) return existing

    return deps.memoryRepo.createMemory({
      agent_id: agentId,
      source_type: 'PRIVATE_CHAT',
      source_session_id: sessionId,
      source_event_id: recorded.id,
      summary_text: distilled.memoryDigest.summary_text,
      topic_tags: distilled.memoryDigest.topic_tags,
      key_facts: distilled.memoryDigest.key_facts,
      sentiment: distilled.memoryDigest.sentiment,
      importance_score: distilled.memoryDigest.importance_score,
      privacy_floor: 1,
    })
  } catch (error) {
    personaObservability.recordTypedWrite(false)
    throw error
  }
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
  if (deps.nurtureOrchestrator) {
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

  if (deps.relationService) {
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
