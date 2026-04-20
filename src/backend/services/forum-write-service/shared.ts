import type { DomainEvent } from '../../repos/index.js'
import type { ModerationResult } from '../../moderation/types.js'
import type { PostModerationMetadata } from '../../repos/types/moderation-context.js'
import type { ForumWriteContext } from './types.js'
import type { GovernanceWriteContextInput } from './types.js'

function shouldDispatchGovernedEvent(event: DomainEvent): boolean {
  const payload = event.payload_json
  if (
    !payload
    || typeof payload !== 'object'
    || typeof (payload as { governance_batch_id?: unknown }).governance_batch_id !== 'string'
  ) {
    return true
  }

  const generationMode = typeof (payload as { generation_mode?: unknown }).generation_mode === 'string'
    ? (payload as { generation_mode: string }).generation_mode
    : null

  if (generationMode !== 'warmup_runtime') {
    return false
  }

  return (
    event.event_type === 'POST_CREATED'
    || event.event_type === 'THREAD_OPENED'
    || event.event_type === 'THREAD_TURN_ADDED'
  )
}

export async function notifyEvent(context: ForumWriteContext, event: DomainEvent): Promise<void> {
  if (!shouldDispatchGovernedEvent(event)) {
    return
  }
  try {
    await context.deps.onEventCreated?.(event)
  } catch (err) {
    console.error('[ForumWriteService] Event hook error:', err)
  }
}

export function applyGovernedContentModeration(
  moderation: ModerationResult,
): ModerationResult {
  return {
    ...moderation,
    visibility: moderation.visibility === 'QUARANTINE' ? 'QUARANTINE' : 'GRAY',
    state: moderation.state === 'REJECTED' ? 'REJECTED' : 'PENDING',
  }
}

export function applyGovernedContentPostMetadata(
  metadata: PostModerationMetadata,
): PostModerationMetadata {
  return {
    ...metadata,
    distribution_state: metadata.distribution_state === 'BLOCKED'
      ? 'BLOCKED'
      : 'NO_RECOMMEND',
  }
}

export function resolveGovernanceLineageFields(
  governanceContext: GovernanceWriteContextInput | undefined,
): Partial<Pick<GovernanceWriteContextInput, 'governance_batch_id' | 'generation_mode'>> {
  if (!governanceContext) return {}
  return {
    governance_batch_id: governanceContext.governance_batch_id,
    generation_mode: governanceContext.generation_mode,
  }
}
