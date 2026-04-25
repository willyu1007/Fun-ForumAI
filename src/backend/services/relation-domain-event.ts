import type {
  DomainEvent,
  PersistRelationDomainEventTemplate,
  RelationSemanticTransition,
  RelationState,
  RelationStateChangedPayload,
  RelationStateChangeTrigger,
} from '../repos/types.js'

const RELATION_STATE_SET = new Set<RelationState>(['shadow', 'effective', 'inactive', 'blocked'])
const RELATION_SEMANTIC_TRANSITION_SET = new Set<RelationSemanticTransition>([
  'none',
  'follow_started',
  'mutual_follow_started',
  'relation_blocked',
  'relation_cooled',
])

export function deriveRelationSemanticTransition(input: {
  previous_state: RelationState | null
  next_state: RelationState
  reverse_state_before: RelationState | null
}): RelationSemanticTransition {
  if (input.next_state === 'blocked' && input.previous_state !== 'blocked') {
    return 'relation_blocked'
  }

  if (input.next_state === 'effective' && input.previous_state !== 'effective') {
    if (input.reverse_state_before === 'effective') {
      return 'mutual_follow_started'
    }
    return 'follow_started'
  }

  if (input.previous_state === 'effective' && input.next_state === 'inactive') {
    return 'relation_cooled'
  }

  return 'none'
}

export function buildRelationStateChangedEventTemplate(input: {
  from_agent_id: string
  to_agent_id: string
  previous_state: RelationState | null
  next_state: RelationState
  reverse_state_before: RelationState | null
  reverse_state_after?: RelationState | null
  next_relation_version: number
  source: {
    trigger: RelationStateChangeTrigger
    relation_event_id?: string | null
  }
  scores: {
    relation_score: number
    interaction_score: number
    persona_score: number
    safety_score: number
  }
}): PersistRelationDomainEventTemplate {
  return {
    event_type: 'AGENT_RELATION_STATE_CHANGED',
    plane: 'CONTROL',
    schema_version: 'v1',
    actor_type: 'system',
    actor_id: null,
    cause_event_id: null,
    idempotency_key: buildRelationStateChangedIdempotencyKey({
      from_agent_id: input.from_agent_id,
      to_agent_id: input.to_agent_id,
      relation_version: input.next_relation_version,
    }),
    payload_base: {
      from_agent_id: input.from_agent_id,
      to_agent_id: input.to_agent_id,
      previous_state: input.previous_state,
      next_state: input.next_state,
      reverse_state_before: input.reverse_state_before,
      reverse_state_after: input.reverse_state_after ?? input.reverse_state_before,
      semantic_transition: deriveRelationSemanticTransition(input),
      source: {
        trigger: input.source.trigger,
        relation_event_id: input.source.relation_event_id ?? null,
      },
      scores: input.scores,
    },
  }
}

export function buildRelationStateChangedIdempotencyKey(input: {
  from_agent_id: string
  to_agent_id: string
  relation_version: number
}): string {
  return `relation-state-changed:${input.from_agent_id}:${input.to_agent_id}:v${input.relation_version}`
}

export function parseRelationStateChangedEvent(event: DomainEvent): RelationStateChangedPayload | null {
  if (event.event_type !== 'AGENT_RELATION_STATE_CHANGED') return null
  return parseRelationStateChangedPayload(event.payload_json)
}

export function parseRelationStateChangedPayload(payload: Record<string, unknown>): RelationStateChangedPayload | null {
  const previousState = toRelationStateOrNull(payload.previous_state)
  const nextState = toRelationState(payload.next_state)
  const reverseBefore = toRelationStateOrNull(payload.reverse_state_before)
  const reverseAfter = toRelationStateOrNull(payload.reverse_state_after)
  const semanticTransition = toSemanticTransition(payload.semantic_transition)
  const source = toSource(payload.source)
  const scores = toScores(payload.scores)

  if (
    typeof payload.relation_id !== 'string'
    || typeof payload.relation_version !== 'number'
    || typeof payload.from_agent_id !== 'string'
    || typeof payload.to_agent_id !== 'string'
    || !nextState
    || !semanticTransition
    || !source
    || !scores
    || typeof payload.emitted_at !== 'string'
  ) {
    return null
  }

  return {
    relation_id: payload.relation_id,
    relation_version: payload.relation_version,
    from_agent_id: payload.from_agent_id,
    to_agent_id: payload.to_agent_id,
    previous_state: previousState,
    next_state: nextState,
    reverse_state_before: reverseBefore,
    reverse_state_after: reverseAfter,
    semantic_transition: semanticTransition,
    source,
    scores,
    emitted_at: payload.emitted_at,
  }
}

function toRelationState(value: unknown): RelationState | null {
  return typeof value === 'string' && RELATION_STATE_SET.has(value as RelationState)
    ? value as RelationState
    : null
}

function toRelationStateOrNull(value: unknown): RelationState | null {
  if (value == null) return null
  return toRelationState(value)
}

function toSemanticTransition(value: unknown): RelationSemanticTransition | null {
  return typeof value === 'string' && RELATION_SEMANTIC_TRANSITION_SET.has(value as RelationSemanticTransition)
    ? value as RelationSemanticTransition
    : null
}

function toSource(value: unknown): RelationStateChangedPayload['source'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const trigger = (value as Record<string, unknown>).trigger
  const relationEventId = (value as Record<string, unknown>).relation_event_id
  if (trigger !== 'signal_ingest' && trigger !== 'reconcile' && trigger !== 'admin_unblock') {
    return null
  }
  return {
    trigger,
    relation_event_id: typeof relationEventId === 'string' ? relationEventId : null,
  }
}

function toScores(value: unknown): RelationStateChangedPayload['scores'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const relationScore = (value as Record<string, unknown>).relation_score
  const interactionScore = (value as Record<string, unknown>).interaction_score
  const personaScore = (value as Record<string, unknown>).persona_score
  const safetyScore = (value as Record<string, unknown>).safety_score
  if (
    typeof relationScore !== 'number'
    || typeof interactionScore !== 'number'
    || typeof personaScore !== 'number'
    || typeof safetyScore !== 'number'
  ) {
    return null
  }
  return {
    relation_score: relationScore,
    interaction_score: interactionScore,
    persona_score: personaScore,
    safety_score: safetyScore,
  }
}
