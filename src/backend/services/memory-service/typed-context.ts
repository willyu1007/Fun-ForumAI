import {
  buildChatRoomWindowRawEvent,
  buildChatRoomWindowRawEventId,
  buildForumThreadRawEvent,
  buildForumThreadRawEventId,
} from '../../context-memory/runtime.js'
import type { IdentityFinalizeResult, SummaryDistillResult } from '../../context-memory/contracts.js'
import type { AgentMemory, ContextMemoryScene } from '../../repos/types.js'
import type { ContextMemoryRuntimeDeps } from '../memory-service.js'

export async function runTypedContextPipeline(input: {
  runtime: ContextMemoryRuntimeDeps | null | undefined
  agentId: string
  rawEvent: Parameters<ContextMemoryRuntimeDeps['journalService']['record']>[0]
}): Promise<{
  recorded: Awaited<ReturnType<ContextMemoryRuntimeDeps['journalService']['record']>>
  distilled: SummaryDistillResult
  finalized: IdentityFinalizeResult
}> {
  const runtime = input.runtime
  if (!runtime) {
    throw new Error('context_memory_runtime_missing')
  }

  const recorded = await runtime.journalService.record(input.rawEvent)
  const extracted = await runtime.summaryOrchestrator.extract(recorded)
  const distilled = await runtime.summaryOrchestrator.distill(recorded, extracted)
  const finalized = await runtime.identityFinalizer.finalize(input.agentId, distilled)
  await persistTypedContextState({
    runtime,
    agentId: input.agentId,
    distilled,
    finalized,
  })

  return { recorded, distilled, finalized }
}

export async function ingestTypedPublicObservation(input: {
  runtime: ContextMemoryRuntimeDeps | null | undefined
  memory: AgentMemory
  sourceEventId?: string
  payload: {
    agent_id: string
    source_ref_id: string
    typed_context?: {
      scene: Extract<ContextMemoryScene, 'forum' | 'chat_room'>
      transcript: string
      counterpart_id?: string | null
      evidence_refs?: string[]
      created_at?: Date
    }
  }
}): Promise<void> {
  const runtime = input.runtime
  const typedContext = input.payload.typed_context
  if (!runtime || !typedContext) return

  const rawEvent = typedContext.scene === 'forum'
    ? buildForumThreadRawEvent({
        eventId: buildForumThreadRawEventId(input.sourceEventId ?? input.memory.id),
        agentId: input.payload.agent_id,
        postId: input.payload.source_ref_id,
        communityId: typedContext.counterpart_id ?? null,
        transcript: typedContext.transcript,
        evidenceRefs: typedContext.evidence_refs,
        createdAt: typedContext.created_at ?? input.memory.created_at,
      })
    : buildChatRoomWindowRawEvent({
        eventId: buildChatRoomWindowRawEventId(input.sourceEventId ?? input.memory.id),
        agentId: input.payload.agent_id,
        roomId: input.payload.source_ref_id,
        transcript: typedContext.transcript,
        evidenceRefs: typedContext.evidence_refs,
        createdAt: typedContext.created_at ?? input.memory.created_at,
      })

  await runTypedContextPipeline({
    runtime,
    agentId: input.payload.agent_id,
    rawEvent,
  })
}

export async function persistTypedContextState(input: {
  runtime: ContextMemoryRuntimeDeps | null | undefined
  agentId: string
  distilled: SummaryDistillResult
  finalized: IdentityFinalizeResult
}): Promise<void> {
  const runtime = input.runtime
  if (!runtime) return

  await Promise.all(input.distilled.episodicCards.map((card) => runtime.episodicCardRepo.upsert(card)))
  if (input.finalized.relationState) {
    await runtime.relationStateRepo.upsert(input.finalized.relationState)
  }
  if (input.finalized.selfModel) {
    await runtime.selfModelStateRepo.upsert(input.finalized.selfModel)
  }
  await runtime.activeTensionRepo.replaceForAgent(input.agentId, input.finalized.tensions)
  if (input.finalized.privateShadow) {
    await runtime.privateShadowRepo.upsert(input.finalized.privateShadow)
  }
}

export function isUniqueConstraintError(err: unknown): boolean {
  return Boolean(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002',
  )
}
