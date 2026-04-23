import type { DomainEvent } from '../repos/index.js'
import type { GuidanceOrchestrator } from '../guidance/guidance-orchestrator.js'
import { handleGuidanceForumFanout } from '../guidance/feature-gates.js'

export interface ForumEventDispatcherDeps {
  searchProjectionService: {
    handleForumEvent(event: DomainEvent): Promise<void>
  }
  eventBridge: {
    bridge(event: DomainEvent): void
  }
  sseHub: {
    broadcast(input: { type: string; payload: Record<string, unknown> }): void
  }
  achievementsOrchestrator?: {
    processDomainEvent(event: DomainEvent): Promise<void>
  } | null
  proactiveEventHandler?: {
    handle(event: DomainEvent): void
  } | null
  statsService?: {
    onDomainEvent(event: DomainEvent): Promise<void>
  } | null
  nurtureOrchestrator?: {
    onContentProduced(
      agentId: string,
      signalType: 'vote_received',
      amount: number,
      options?: { dedup_key?: string },
    ): Promise<void>
  } | null
  xpService?: {
    awardXP(
      agentId: string,
      signalType: 'vote_received',
      amount: number,
      options?: { dedup_key?: string },
    ): Promise<unknown>
  } | null
  relationService?: {
    onForumStageEvent(event: DomainEvent): Promise<void>
    onVoteEvent?(event: DomainEvent): Promise<void>
  } | null
  publicObservationEventHandler?: {
    handle(event: DomainEvent): void
  } | null
  guidanceEnabled: boolean
  guidanceOrchestrator?: Pick<GuidanceOrchestrator, 'handleForumEvent'> | null
  agentStatsVotePolicyEnabled: boolean
  publicObservationMemoryEnabled: boolean
  onError?: (message: string, err: unknown) => void
}

export interface AcceptedAudienceWriteEvent {
  post_id: string
  thread_id: string
  audience_message_id: string
}

function reportDispatcherError(
  deps: Pick<ForumEventDispatcherDeps, 'onError'>,
  message: string,
  err: unknown,
): void {
  if (deps.onError) {
    deps.onError(message, err)
    return
  }
  console.error(message, err)
}

function isVoteCastSignalEvent(event: DomainEvent): boolean {
  return event.event_type === 'VOTE_CAST' || event.event_type === 'AGENT_VOTE_CAST'
}

function isVoteClearProjectionEvent(event: DomainEvent): boolean {
  return (
    event.event_type === 'VOTE_CLEARED'
    || event.event_type === 'AGENT_VOTE_CLEARED'
    || event.event_type === 'HUMAN_VOTE_CLEARED'
  )
}

export function createForumEventDispatcher(deps: ForumEventDispatcherDeps) {
  return async (event: DomainEvent): Promise<void> => {
    await deps.searchProjectionService.handleForumEvent(event)

    deps.eventBridge.bridge(event)

    if (deps.achievementsOrchestrator) {
      deps.achievementsOrchestrator.processDomainEvent(event).catch((err) => {
        reportDispatcherError(deps, '[ForumEventDispatcher] Achievement orchestrator ingest failed:', err)
      })
    }

    deps.sseHub.broadcast({
      type: event.event_type,
      payload: event.payload_json,
    })

    if (deps.proactiveEventHandler) {
      deps.proactiveEventHandler.handle(event)
    }

    if (deps.statsService) {
      deps.statsService.onDomainEvent(event).catch((err) => {
        reportDispatcherError(deps, '[ForumEventDispatcher] Stats state update failed:', err)
      })
    }

    if (isVoteCastSignalEvent(event)) {
      const payload = event.payload_json
      const direction = typeof payload.direction === 'string' ? payload.direction : ''
      const targetAgentId =
        typeof payload.target_author_agent_id === 'string' ? payload.target_author_agent_id : ''
      const voteId = typeof payload.vote_id === 'string' ? payload.vote_id : ''
      if (direction === 'UP' && targetAgentId) {
        const dedupKey = voteId ? `vote:${voteId}` : undefined
        if (deps.nurtureOrchestrator) {
          deps.nurtureOrchestrator
            .onContentProduced(targetAgentId, 'vote_received', 1, { dedup_key: dedupKey })
            .catch((err) => {
              reportDispatcherError(deps, '[ForumEventDispatcher] vote_received XP award failed:', err)
            })
        } else if (deps.xpService) {
          deps.xpService
            .awardXP(targetAgentId, 'vote_received', 1, { dedup_key: dedupKey })
            .catch((err) => {
              reportDispatcherError(deps, '[ForumEventDispatcher] vote_received XP award failed:', err)
            })
        }
      }
    }

    if (
      deps.relationService
      && (event.event_type === 'THREAD_OPENED' || event.event_type === 'THREAD_TURN_ADDED')
    ) {
      deps.relationService.onForumStageEvent(event).catch((err) => {
        reportDispatcherError(deps, '[ForumEventDispatcher] Relation forum signal failed:', err)
      })
    }

    if (
      deps.agentStatsVotePolicyEnabled
      && deps.relationService
      && deps.relationService.onVoteEvent
      && isVoteCastSignalEvent(event)
    ) {
      deps.relationService.onVoteEvent(event).catch((err) => {
        reportDispatcherError(deps, '[ForumEventDispatcher] Relation vote signal failed:', err)
      })
    }

    if (
      deps.publicObservationMemoryEnabled
      && deps.publicObservationEventHandler
      && !isVoteClearProjectionEvent(event)
    ) {
      deps.publicObservationEventHandler.handle(event)
    }

    if (deps.guidanceOrchestrator && !isVoteClearProjectionEvent(event)) {
      handleGuidanceForumFanout(event, {
        guidanceEnabled: deps.guidanceEnabled,
        orchestrator: deps.guidanceOrchestrator,
        onError: (err) => {
          reportDispatcherError(deps, '[ForumEventDispatcher] Guidance forum event ingest failed:', err)
        },
      })
    }
  }
}

export function createAudienceWriteDispatcher(deps: {
  searchProjectionService: {
    refreshPost(postId: string): Promise<void>
  }
}) {
  return async (event: AcceptedAudienceWriteEvent): Promise<void> => {
    await deps.searchProjectionService.refreshPost(event.post_id)
  }
}
