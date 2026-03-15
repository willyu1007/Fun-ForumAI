import {
  buildChatRoomWindowRawEventId,
  buildForumThreadRawEventId,
} from '../../context-memory/runtime.js'
import { personaObservability } from '../../runtime/persona-observability.js'
import { ingestTypedPublicObservation, isUniqueConstraintError } from './typed-context.js'
import type {
  AgentMemory,
  MemoryServiceDeps,
  PublicObservationMemoryInput,
} from './types.js'

export async function createPublicObservationMemory(
  deps: MemoryServiceDeps,
  input: PublicObservationMemoryInput,
): Promise<AgentMemory> {
  const sourceEventId = input.source_event_id?.trim() || undefined
  let memory: AgentMemory | null = null
  if (sourceEventId) {
    try {
      const existing = await findPublicObservationByEventId(deps, input.agent_id, sourceEventId)
      if (existing) {
        memory = existing
      }
    } catch (err) {
      console.warn(
        '[MemoryService] public observation dedup precheck failed, fallback to create:',
        err,
      )
    }
  }

  if (memory) {
    await maybeIngestTypedPublicObservation(deps, memory, input, sourceEventId)
    return memory
  }

  try {
    memory = await deps.memoryRepo.createMemory({
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
    })
    personaObservability.recordLegacyPublicDualWrite()
  } catch (err) {
    if (!sourceEventId || !isUniqueConstraintError(err)) {
      throw err
    }

    const existing = await findPublicObservationByEventId(deps, input.agent_id, sourceEventId)
    if (!existing) throw err
    memory = existing
  }

  if (!memory) {
    throw new Error('public_observation_memory_missing')
  }

  await maybeIngestTypedPublicObservation(deps, memory, input, sourceEventId)
  return memory
}

export async function hasTypedPublicObservationEvent(
  deps: MemoryServiceDeps,
  agentId: string,
  input: { scene: 'forum' | 'chat_room'; sourceEventId: string },
): Promise<boolean> {
  const runtime = deps.contextMemory
  if (!runtime) return false
  const rawEventId =
    input.scene === 'forum'
      ? buildForumThreadRawEventId(input.sourceEventId)
      : buildChatRoomWindowRawEventId(input.sourceEventId)
  const row = await runtime.rawEventRepo.findById(rawEventId)
  return Boolean(row && row.agent_id === agentId)
}

export async function getLatestTypedPublicObservationAt(
  deps: MemoryServiceDeps,
  agentId: string,
  input: { scene: 'forum' | 'chat_room'; sourceRefId: string },
): Promise<Date | null> {
  const runtime = deps.contextMemory
  if (!runtime) return null
  const page = await runtime.rawEventRepo.listByAgent(agentId, {
    limit: 1,
    scene: input.scene,
    source_type: input.scene === 'forum' ? 'forum_thread' : 'chat_room_window',
    source_ref_id: input.sourceRefId,
  })
  return page.items[0]?.created_at ?? null
}

async function findPublicObservationByEventId(
  deps: MemoryServiceDeps,
  agentId: string,
  sourceEventId: string,
): Promise<AgentMemory | null> {
  const result = await deps.memoryRepo.listMemories(agentId, {
    limit: 1,
    source_type: 'PUBLIC_OBSERVATION',
    source_event_id: sourceEventId,
    forgotten: false,
  })
  return result.items[0] ?? null
}

async function maybeIngestTypedPublicObservation(
  deps: MemoryServiceDeps,
  memory: AgentMemory,
  input: PublicObservationMemoryInput,
  sourceEventId?: string,
): Promise<void> {
  if (!deps.contextMemory || !input.typed_context) return
  try {
    await ingestTypedPublicObservation({
      runtime: deps.contextMemory,
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
