import type {
  AchievementAwardContext,
  AchievementSignalContext,
} from '../types.js'

type SignalContextColumns = {
  eventId: string | null
  threadId: string | null
  communityId: string | null
  peerAgentId: string | null
  toAgentId: string | null
  previousState: string | null
  nextState: string | null
  action: string | null
  adminUserId: string | null
  targetType: string | null
  resultSuccess: boolean | null
  newVisibility: string | null
  newState: string | null
  postId: string | null
  artifactId: string | null
  publishShape: string | null
  sessionId: string | null
  humanMessageId: string | null
  openingMessageId: string | null
  signalVisibilityReason: string | null
  sourceRef: string | null
  sourceEventId: string | null
  contentKind: string | null
  generatedAt: Date | null
  snapshotDate: string | null
  sourceMode: string | null
  shelfId: string | null
  storylineId: string | null
}

type AwardContextColumns = {
  triggerKind: string | null
  triggerMode: string | null
  metricName: string | null
  metricValue: number | null
  metricThreshold: number | null
  evidenceSatisfied: boolean | null
  visibilityReason: string | null
  sourceDedupKey: string | null
}

function normalizeString(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function normalizeBoolean(value: boolean | null | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function normalizeNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toDateOrNull(value: string | null | undefined): Date | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function hasAnyValue(record: Record<string, unknown>): boolean {
  return Object.values(record).some((value) => value !== null && value !== undefined)
}

export function toSignalContextColumns(context?: AchievementSignalContext | null): SignalContextColumns {
  return {
    eventId: normalizeString(context?.event_id),
    threadId: normalizeString(context?.thread_id),
    communityId: normalizeString(context?.community_id),
    peerAgentId: normalizeString(context?.peer_agent_id),
    toAgentId: normalizeString(context?.to_agent_id),
    previousState: normalizeString(context?.previous_state),
    nextState: normalizeString(context?.next_state),
    action: normalizeString(context?.action),
    adminUserId: normalizeString(context?.admin_user_id),
    targetType: normalizeString(context?.target_type),
    resultSuccess: normalizeBoolean(context?.result_success),
    newVisibility: normalizeString(context?.new_visibility),
    newState: normalizeString(context?.new_state),
    postId: normalizeString(context?.post_id),
    artifactId: normalizeString(context?.artifact_id),
    publishShape: normalizeString(context?.publish_shape),
    sessionId: normalizeString(context?.session_id),
    humanMessageId: normalizeString(context?.human_message_id),
    openingMessageId: normalizeString(context?.opening_message_id),
    signalVisibilityReason: normalizeString(context?.signal_visibility_reason),
    sourceRef: normalizeString(context?.source_ref),
    sourceEventId: normalizeString(context?.source_event_id),
    contentKind: normalizeString(context?.content_kind),
    generatedAt: toDateOrNull(context?.generated_at),
    snapshotDate: normalizeString(context?.snapshot_date),
    sourceMode: normalizeString(context?.source_mode),
    shelfId: normalizeString(context?.shelf_id),
    storylineId: normalizeString(context?.storyline_id),
  }
}

export function fromSignalContextColumns(
  row: SignalContextColumns & { dedupKey?: string | null },
): AchievementSignalContext | null {
  const context: AchievementSignalContext = {
    event_id: row.eventId,
    thread_id: row.threadId,
    community_id: row.communityId,
    peer_agent_id: row.peerAgentId,
    to_agent_id: row.toAgentId,
    previous_state: row.previousState,
    next_state: row.nextState,
    action: row.action,
    admin_user_id: row.adminUserId,
    target_type: row.targetType,
    result_success: row.resultSuccess,
    new_visibility: row.newVisibility,
    new_state: row.newState,
    post_id: row.postId,
    artifact_id: row.artifactId,
    publish_shape: row.publishShape,
    session_id: row.sessionId,
    human_message_id: row.humanMessageId,
    opening_message_id: row.openingMessageId,
    signal_visibility_reason: row.signalVisibilityReason,
    source_ref: row.sourceRef,
    source_event_id: row.sourceEventId,
    content_kind: row.contentKind,
    generated_at: row.generatedAt ? row.generatedAt.toISOString() : null,
    snapshot_date: row.snapshotDate,
    source_mode: row.sourceMode,
    shelf_id: row.shelfId,
    storyline_id: row.storylineId,
    dedup_key: row.dedupKey ?? null,
  }
  return hasAnyValue(context as Record<string, unknown>) ? context : null
}

export function toAwardContextColumns(context?: AchievementAwardContext | null): AwardContextColumns {
  return {
    triggerKind: normalizeString(context?.trigger_kind),
    triggerMode: normalizeString(context?.trigger_mode),
    metricName: normalizeString(context?.metric_name),
    metricValue: normalizeNumber(context?.metric_value),
    metricThreshold: normalizeNumber(context?.threshold),
    evidenceSatisfied: normalizeBoolean(context?.evidence_satisfied),
    visibilityReason: normalizeString(context?.visibility_reason),
    sourceDedupKey: normalizeString(context?.dedup_key),
  }
}

export function fromAwardContextColumns(row: AwardContextColumns): AchievementAwardContext | null {
  const context: AchievementAwardContext = {
    trigger_kind: row.triggerKind,
    trigger_mode: row.triggerMode,
    metric_name: row.metricName,
    metric_value: row.metricValue,
    threshold: row.metricThreshold,
    evidence_satisfied: row.evidenceSatisfied,
    visibility_reason: row.visibilityReason,
    dedup_key: row.sourceDedupKey,
  }
  return hasAnyValue(context as Record<string, unknown>) ? context : null
}
