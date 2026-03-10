import type { AgentRepository } from '../repos/agent-repository.js'
import type { DomainEvent } from '../repos/types.js'
import type { GuidanceOrchestrator } from './guidance-orchestrator.js'

export interface GuidanceDigestHookInput {
  agent_id: string
  session_id: string
  memory_id: string
  importance_score: number
  sentiment: string | null
}

export async function handleGuidanceDigestHook(
  input: GuidanceDigestHookInput,
  deps: {
    guidanceEnabled: boolean
    agentRepo: Pick<AgentRepository, 'findById'>
    orchestrator: Pick<GuidanceOrchestrator, 'ingestEvent'>
  },
): Promise<void> {
  if (!deps.guidanceEnabled) return

  const agent = deps.agentRepo.findById(input.agent_id)
  if (!agent?.owner_id) return

  await deps.orchestrator.ingestEvent(
    { actor_type: 'USER', actor_id: agent.owner_id },
    'PRIVATE_DIGEST_READY',
    {
      agent_id: input.agent_id,
      session_id: input.session_id,
      memory_id: input.memory_id,
    },
    { dedup_key: `private_digest_ready:${input.session_id}` },
  )
}

export function handleGuidanceForumFanout(
  event: DomainEvent,
  deps: {
    guidanceEnabled: boolean
    orchestrator: Pick<GuidanceOrchestrator, 'handleForumEvent'>
    onError?: (err: unknown) => void
  },
): void {
  if (!deps.guidanceEnabled) return

  deps.orchestrator.handleForumEvent(event).catch((err) => {
    if (deps.onError) {
      deps.onError(err)
      return
    }
    console.error('[Container] Guidance forum event ingest failed:', err)
  })
}
