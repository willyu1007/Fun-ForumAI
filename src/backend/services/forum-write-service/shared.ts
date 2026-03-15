import type { DomainEvent } from '../../repos/index.js'
import type { ForumWriteContext } from './types.js'

export function notifyEvent(context: ForumWriteContext, event: DomainEvent): void {
  try {
    context.deps.onEventCreated?.(event)
  } catch (err) {
    console.error('[ForumWriteService] Event hook error:', err)
  }
}
