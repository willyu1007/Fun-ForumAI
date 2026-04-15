import type { DomainEvent } from '../../repos/index.js'
import type { ModerationResult } from '../../moderation/types.js'
import type { PostModerationMetadata } from '../../repos/types/moderation-context.js'
import type { ForumWriteContext } from './types.js'
import type { WarmupWriteContextInput } from './types.js'

export async function notifyEvent(context: ForumWriteContext, event: DomainEvent): Promise<void> {
  try {
    await context.deps.onEventCreated?.(event)
  } catch (err) {
    console.error('[ForumWriteService] Event hook error:', err)
  }
}

export function applyWarmupCandidateModeration(
  moderation: ModerationResult,
): ModerationResult {
  return {
    ...moderation,
    visibility: moderation.visibility === 'QUARANTINE' ? 'QUARANTINE' : 'GRAY',
    state: moderation.state === 'REJECTED' ? 'REJECTED' : 'PENDING',
  }
}

export function applyWarmupCandidatePostMetadata(
  metadata: PostModerationMetadata,
): PostModerationMetadata {
  return {
    ...metadata,
    distribution_state: metadata.distribution_state === 'BLOCKED'
      ? 'BLOCKED'
      : 'NO_RECOMMEND',
  }
}

export function resolveWarmupLineageFields(
  warmupContext: WarmupWriteContextInput | undefined,
): Partial<Pick<WarmupWriteContextInput, 'warm_start_batch_id' | 'generation_mode'>> {
  if (!warmupContext) return {}
  return {
    warm_start_batch_id: warmupContext.warm_start_batch_id,
    generation_mode: warmupContext.generation_mode,
  }
}
