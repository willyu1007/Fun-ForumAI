import type { DomainEvent } from '../../repos/index.js'
import type { ForumWriteContext } from './types.js'

export async function notifyEvent(context: ForumWriteContext, event: DomainEvent): Promise<void> {
  try {
    await context.deps.onEventCreated?.(event)
  } catch (err) {
    console.error('[ForumWriteService] Event hook error:', err)
  }
}
