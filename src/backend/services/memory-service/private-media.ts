import { personaObservability } from '../../runtime/persona-observability.js'
import type { AgentMemory, ContextRawEvent } from '../../repos/types.js'
import { runPrivateMediaTypedContextPipeline } from './typed-context.js'
import type { MemoryServiceDeps, PrivateMediaMemoryInput } from './types.js'

export async function createPrivateMediaMemory(
  deps: MemoryServiceDeps,
  input: PrivateMediaMemoryInput,
): Promise<AgentMemory> {
  const sourceEventId = buildPrivateMediaRawEventId(input.message_id, input.projection.asset_id)
  const existing = await findPrivateMediaMemoryByEventId(deps, input.agent_id, sourceEventId)
  if (existing) return existing

  if (!deps.contextMemory) {
    throw new Error('contextMemory runtime missing; private media pipeline is unavailable')
  }

  try {
    const { recorded, distilled } = await runPrivateMediaTypedContextPipeline({
      runtime: deps.contextMemory,
      rawEvent: buildPrivateMediaRawEvent({
        eventId: sourceEventId,
        agentId: input.agent_id,
        ownerUserId: input.owner_user_id,
        sessionId: input.session_id,
        messageId: input.message_id,
        projection: input.projection,
        sourceProjectionId: input.source_projection_id ?? null,
        createdAt: input.created_at,
      }),
    })
    personaObservability.recordTypedWrite(true)

    const deduped = await findPrivateMediaMemoryByEventId(deps, input.agent_id, recorded.id)
    if (deduped) return deduped

    return deps.memoryRepo.createMemory({
      agent_id: input.agent_id,
      source_type: 'PRIVATE_CHAT',
      source_session_id: input.session_id,
      source_ref_type: 'private_message',
      source_ref_id: input.message_id,
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

export async function cleanupPrivateMediaMemory(
  deps: MemoryServiceDeps,
  input: {
    agent_id: string
    message_id: string
    asset_ids: string[]
  },
): Promise<void> {
  const eventIds = input.asset_ids.map((assetId) => buildPrivateMediaRawEventId(input.message_id, assetId))
  if (eventIds.length === 0) return

  await deps.memoryRepo.deleteBySourceEventIds(input.agent_id, eventIds)
  if (!deps.contextMemory) return

  await deps.contextMemory.privateShadowRepo.pruneByEventIds(input.agent_id, eventIds)
  await deps.contextMemory.episodicCardRepo.pruneByEventIds(input.agent_id, eventIds)
  await Promise.all(eventIds.map((eventId) => deps.contextMemory!.rawEventRepo.delete(eventId)))
}

export function buildPrivateMediaRawEventId(messageId: string, assetId: string): string {
  return `ctxevent:private-media:${messageId}:${assetId}`
}

function buildPrivateMediaRawEvent(input: {
  eventId: string
  agentId: string
  ownerUserId: string
  sessionId: string
  messageId: string
  projection: PrivateMediaMemoryInput['projection']
  sourceProjectionId: string | null
  createdAt?: Date
}): ContextRawEvent {
  return {
    id: input.eventId,
    agent_id: input.agentId,
    scene: 'private_chat',
    source_type: 'private_session',
    source_ref_id: input.messageId,
    counterpart_id: input.ownerUserId,
    transcript: buildPrivateMediaTranscript(input.projection),
    evidence_refs: dedupeStrings([
      `private_session:${input.sessionId}`,
      `private_message:${input.messageId}`,
      `media_asset:${input.projection.asset_id}`,
      `media_snapshot:${input.projection.semantic_snapshot_id}`,
      input.sourceProjectionId ? `media_projection:${input.sourceProjectionId}` : '',
    ]),
    created_at: input.createdAt ?? new Date(),
  }
}

function buildPrivateMediaTranscript(
  projection: PrivateMediaMemoryInput['projection'],
): string {
  return [
    'owner shared an image attachment in private chat',
    `summary: ${projection.memory_summary.summary_text}`,
    projection.memory_summary.topic_tags.length > 0
      ? `topic_tags: ${projection.memory_summary.topic_tags.join(', ')}`
      : null,
    projection.memory_summary.key_facts.length > 0
      ? `key_facts: ${projection.memory_summary.key_facts.join(' | ')}`
      : null,
    `public_safe_shadow_hint: ${projection.handoff.public_safe_shadow_hint}`,
    `why_relevant_hint: ${projection.handoff.why_relevant_hint}`,
  ].filter(Boolean).join('\n')
}

async function findPrivateMediaMemoryByEventId(
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

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values.map((item) => item.trim()).filter((item) => item.length > 0)) {
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}
