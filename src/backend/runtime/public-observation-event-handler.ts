import type { DomainEvent } from '../repos/types.js'
import type { PublicObservationDigestService } from '../services/public-observation-digest-service.js'

export interface PublicObservationEventHandlerDeps {
  digestService: PublicObservationDigestService
}

export class PublicObservationEventHandler {
  constructor(private readonly deps: PublicObservationEventHandlerDeps) {}

  handle(event: DomainEvent): void {
    if (
      event.event_type !== 'POST_CREATED'
      && event.event_type !== 'THREAD_OPENED'
      && event.event_type !== 'THREAD_TURN_ADDED'
    ) {
      return
    }

    this.deps.digestService.onForumEvent(event).catch((err) => {
      console.error('[PublicObservationEventHandler] handle failed:', err)
    })
  }
}
