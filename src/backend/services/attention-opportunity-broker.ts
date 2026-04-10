import type {
  AttentionOpportunity,
  AttentionOpportunitySource,
  DiscussionForestProjection,
  EffectiveOrchestrationPolicy,
  PostSemanticCapsule,
  ThreadCapsule,
  TurnDisplayProjection,
  TurnReasonBadgeId,
} from '../../shared/forum-orchestration.js'
import type { AttentionTelemetrySnapshot, EventPayload, ScoredCandidate } from '../allocator/types.js'

interface LocalBranchContext {
  focus_node: TurnDisplayProjection | null
  selected_anchor_node: TurnDisplayProjection | null
  focus_branch_nodes: TurnDisplayProjection[]
  focus_branch_agent_ids: string[]
  local_reason_badges: TurnReasonBadgeId[]
  evidence_turn_ids: string[]
  branch_entropy: number
  duel_risk: number
  late_entry_share_recent: number
}

export class AttentionOpportunityBroker {
  discoverFromEvent(input: {
    event: EventPayload
    scored_candidates?: ScoredCandidate[]
  }): AttentionOpportunity[] {
    const source = resolveFallbackSource(input.event, input.scored_candidates)
    return [this.buildOpportunity({
      event: input.event,
      source,
      post_capsule: null,
      post_id: input.event.post_id ?? 'unknown',
      thread: null,
      forest: null,
      policy: null,
      telemetry: null,
      scored_candidates: input.scored_candidates ?? [],
    })]
  }

  discover(input: {
    event: EventPayload
    post_capsule: PostSemanticCapsule
    thread_capsule?: ThreadCapsule | null
    forest?: DiscussionForestProjection | null
    effective_orchestration_policy?: EffectiveOrchestrationPolicy | null
    watch_telemetry_snapshot?: AttentionTelemetrySnapshot | null
    scored_candidates?: ScoredCandidate[]
  }): AttentionOpportunity[] {
    const thread = input.thread_capsule
      ?? input.post_capsule.thread_capsules.find((item) => item.thread_id === input.event.thread_id)
      ?? input.post_capsule.thread_capsules[0]
      ?? null
    const localContext = buildLocalBranchContext({
      event: input.event,
      thread,
      forest: input.forest ?? null,
    })
    const source = resolveSource({
      event: input.event,
      thread,
      telemetry: input.watch_telemetry_snapshot ?? null,
      scored_candidates: input.scored_candidates ?? [],
      post_id: input.post_capsule.post_id,
      local_context: localContext,
    })

    if (source === 'OWNER_PULL') {
      return []
    }

    return [this.buildOpportunity({
      event: input.event,
      source,
      post_capsule: input.post_capsule,
      post_id: input.post_capsule.post_id,
      thread,
      forest: input.forest ?? null,
      policy: input.effective_orchestration_policy ?? null,
      telemetry: input.watch_telemetry_snapshot ?? null,
      scored_candidates: input.scored_candidates ?? [],
    })]
  }

  private buildOpportunity(input: {
    event: EventPayload
    source: AttentionOpportunitySource
    post_capsule: PostSemanticCapsule | null
    post_id: string
    thread: ThreadCapsule | null
    forest: DiscussionForestProjection | null
    policy: EffectiveOrchestrationPolicy | null
    telemetry: AttentionTelemetrySnapshot | null
    scored_candidates: ScoredCandidate[]
  }): AttentionOpportunity {
    const localContext = buildLocalBranchContext({
      event: input.event,
      thread: input.thread,
      forest: input.forest,
    })
    const targetAgentIds = localContext?.focus_branch_agent_ids.length
      ? localContext.focus_branch_agent_ids
      : input.thread?.participant_ids ?? input.event.thread_participants ?? []
    const priorityAgentIds = resolvePriorityAgentIds(
      input.event,
      input.thread,
      input.source,
      input.scored_candidates,
      localContext,
    )
    const selectedAnchorTurnId =
      localContext?.selected_anchor_node?.entry_kind === 'TURN'
        ? localContext.selected_anchor_node.id
        : input.event.target_type === 'TURN'
          ? input.event.target_id ?? null
          : input.event.turn_id
            ?? input.thread?.salient_turn_ids[0]
            ?? null
    const telemetryPressure = readAudienceTelemetryPressure(
      input.telemetry,
      input.post_id,
      input.thread?.thread_id ?? input.event.thread_id ?? null,
      localContext?.evidence_turn_ids ?? [],
    )
    const evidenceTurnIds = (
      localContext?.evidence_turn_ids.length
        ? localContext.evidence_turn_ids
        : [
            input.event.turn_id,
            input.event.target_type === 'TURN' ? input.event.target_id : null,
            ...(input.thread?.salient_turn_ids.slice(0, 2) ?? []),
          ]
    ).filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index)

    return {
      id: `opp:${input.event.event_id}:${input.source.toLowerCase()}`,
      source: input.source,
      browse_reason: mapBrowseReason(input.source),
      profile: input.policy?.profile ?? 'ambient_roaming',
      post_id: input.post_id,
      thread_id: input.thread?.thread_id ?? input.event.thread_id ?? null,
      turn_id:
        localContext?.focus_node?.entry_kind === 'TURN'
          ? localContext.focus_node.id
          : input.event.turn_id ?? input.thread?.latest_turn_id ?? null,
      selected_anchor_turn_id: selectedAnchorTurnId,
      target_agent_ids: targetAgentIds,
      priority_agent_ids: priorityAgentIds,
      suppressed_agent_ids: [],
      reason_codes: buildReasonCodes(input.source, localContext, telemetryPressure),
      evidence_turn_ids: evidenceTurnIds,
      post_attention_state: buildPostAttentionState(
        input.thread,
        input.policy,
        input.post_capsule,
        localContext,
      ),
      thread_attention_state: input.thread
        ? buildThreadAttentionState(input.thread, telemetryPressure, localContext)
        : null,
    }
  }
}

function resolveFallbackSource(
  event: EventPayload,
  scoredCandidates: ScoredCandidate[] = [],
): AttentionOpportunitySource {
  if (event.target_author_agent_id) return 'DIRECT_CHALLENGE'
  if (hasRelationSignal(null, scoredCandidates)) return 'RELATION_ECHO'
  if ((event.thread_participants?.length ?? 0) >= 4) return 'AUDIENCE_SPIKE'
  if (event.chain_depth > 0) return 'REVIVE_OLD_BRANCH'
  return 'NEW_TURN'
}

function resolveSource(input: {
  event: EventPayload
  thread: ThreadCapsule | null
  telemetry: AttentionTelemetrySnapshot | null
  scored_candidates: ScoredCandidate[]
  post_id: string
  local_context: LocalBranchContext | null
}): AttentionOpportunitySource {
  const localBadges = new Set(input.local_context?.local_reason_badges ?? [])

  if (input.event.target_author_agent_id || localBadges.has('MENTIONED')) {
    return 'DIRECT_CHALLENGE'
  }

  if (hasRelationSignal(input.thread, input.scored_candidates)) {
    return 'RELATION_ECHO'
  }

  const telemetryPressure = readAudienceTelemetryPressure(
    input.telemetry,
    input.post_id,
    input.thread?.thread_id ?? input.event.thread_id ?? null,
    input.local_context?.evidence_turn_ids ?? [],
  )
  const audienceSignalCount =
    (input.thread?.audience_signals?.message_count ?? 0)
    + (input.thread?.audience_signals?.highlighted_message_count ?? 0)
  if (localBadges.has('AUDIENCE_PUSHED') || audienceSignalCount >= 3 || telemetryPressure >= 3) {
    return 'AUDIENCE_SPIKE'
  }

  if (
    input.event.chain_depth > 0
    || localBadges.has('RETURNED_TO_BRANCH')
    || input.local_context?.focus_node?.placement_reason === 'LATE_ENTRY_REATTACH'
    || Boolean(input.local_context?.focus_node?.is_late_entry)
  ) {
    return 'REVIVE_OLD_BRANCH'
  }

  return 'NEW_TURN'
}

function resolvePriorityAgentIds(
  event: EventPayload,
  thread: ThreadCapsule | null,
  source: AttentionOpportunitySource,
  scoredCandidates: ScoredCandidate[],
  localContext: LocalBranchContext | null,
): string[] {
  if (source === 'DIRECT_CHALLENGE') {
    if (event.target_author_agent_id) {
      return [event.target_author_agent_id]
    }
    const localAuthorId = localContext?.focus_node?.author.actor_type === 'agent'
      ? localContext.focus_node.author.id
      : null
    return localAuthorId ? [localAuthorId] : []
  }
  if (source === 'RELATION_ECHO') {
    return extractRelationPriorityAgentIds(scoredCandidates)
  }
  if (source === 'AUDIENCE_SPIKE') {
    return localContext?.focus_branch_agent_ids.slice(0, 2) ?? thread?.participant_ids.slice(0, 2) ?? []
  }
  if (source === 'REVIVE_OLD_BRANCH') {
    const selectedAuthorId = localContext?.selected_anchor_node?.author.actor_type === 'agent'
      ? localContext.selected_anchor_node.author.id
      : null
    if (selectedAuthorId) {
      return [selectedAuthorId]
    }
    return localContext?.focus_branch_agent_ids.slice(0, 1) ?? thread?.participant_ids.slice(0, 1) ?? []
  }
  return []
}

function buildReasonCodes(
  source: AttentionOpportunitySource,
  localContext: LocalBranchContext | null,
  telemetryPressure: number,
): string[] {
  const reasonCodes = new Set<string>([source.toLowerCase()])
  for (const badge of localContext?.local_reason_badges ?? []) {
    reasonCodes.add(badge.toLowerCase())
  }
  if (localContext?.selected_anchor_node?.id && localContext.selected_anchor_node.id !== localContext.focus_node?.id) {
    reasonCodes.add('local_branch_focus')
  }
  if (localContext?.focus_node?.is_late_entry) {
    reasonCodes.add('late_entry_context')
  }
  if (telemetryPressure > 0) {
    reasonCodes.add('viewer_attention')
  }
  return Array.from(reasonCodes)
}

function mapBrowseReason(source: AttentionOpportunitySource): AttentionOpportunity['browse_reason'] {
  switch (source) {
    case 'DIRECT_CHALLENGE':
      return 'DIRECT_CHALLENGE'
    case 'RELATION_ECHO':
      return 'RELATION_PULL'
    case 'AUDIENCE_SPIKE':
      return 'AUDIENCE_HEAT'
    case 'REVIVE_OLD_BRANCH':
      return 'REVIVE'
    case 'OWNER_PULL':
      return 'OWNER_PULL'
    case 'NEW_TURN':
    default:
      return 'TOPIC_MATCH'
  }
}

function hasRelationSignal(
  thread: ThreadCapsule | null,
  scoredCandidates: ScoredCandidate[],
): boolean {
  if (thread?.public_persona_cues.some((cue) => cue.source_kind === 'PUBLIC_RELATION_TEASER')) {
    return true
  }
  return extractRelationPriorityAgentIds(scoredCandidates).length > 0
}

function extractRelationPriorityAgentIds(scoredCandidates: ScoredCandidate[]): string[] {
  return scoredCandidates
    .filter((candidate) =>
      candidate.reasons.some((reason) =>
        reason === 'relation_hint=friend'
        || reason === 'relation_hint=following'
        || reason === 'relation_hint=follower'))
    .map((candidate) => candidate.agent_id)
    .slice(0, 2)
}

function buildPostAttentionState(
  thread: ThreadCapsule | null,
  policy: EffectiveOrchestrationPolicy | null,
  postCapsule?: PostSemanticCapsule | null,
  localContext?: LocalBranchContext | null,
): AttentionOpportunity['post_attention_state'] {
  if (!thread) {
    return {
      dominant_thread_share: 0,
      branch_entropy: 0,
      duel_risk: 0,
      newcomer_share_recent: policy?.recall_control.newcomer_min_share ?? 0,
      late_entry_share_recent: policy?.recall_control.late_entry_min_share ?? 0,
    }
  }

  const totalTurns = Math.max(
    postCapsule?.thread_capsules.reduce((sum, item) => sum + item.turn_count, 0) ?? thread.turn_count,
    1,
  )
  const newcomerBadges = thread.semantic_marks.filter((mark) => mark.joined_late).length
  const lateEntryRatio = localContext?.late_entry_share_recent
    ?? (thread.turn_count > 0 ? newcomerBadges / thread.turn_count : 0)

  return {
    dominant_thread_share: Math.min(1, thread.turn_count / totalTurns),
    branch_entropy: localContext?.branch_entropy ?? 0,
    duel_risk: localContext?.duel_risk ?? (thread.participant_count <= 2 ? 1 : Math.min(1, 2 / thread.participant_count)),
    newcomer_share_recent: newcomerBadges / totalTurns,
    late_entry_share_recent: lateEntryRatio,
  }
}

function buildThreadAttentionState(
  thread: ThreadCapsule,
  telemetryPressure: number,
  localContext?: LocalBranchContext | null,
): AttentionOpportunity['thread_attention_state'] {
  const pairLoopRisk = Math.max(
    localContext?.duel_risk ?? 0,
    thread.participant_count <= 2 ? 0.8 : 0.2,
  )

  return {
    contention_score: Math.max(
      thread.role === 'COUNTERPOINT' ? 0.85 : Math.min(1, thread.participant_count / 4),
      pairLoopRisk * 0.8,
    ),
    unresolved_score: Math.min(1, thread.unresolved_points.length / 4),
    audience_pull_score: Math.min(1, ((thread.audience_signals?.message_count ?? 0) + telemetryPressure) / 6),
    saturation_score: thread.lifecycle.reply_budget.limit > 0
      ? 1 - Math.max(0, thread.lifecycle.reply_budget.remaining / thread.lifecycle.reply_budget.limit)
      : 0,
    pair_loop_risk: pairLoopRisk,
    recall_budget_remaining: thread.lifecycle.reply_budget.remaining_turns,
  }
}

function readAudienceTelemetryPressure(
  telemetry: AttentionTelemetrySnapshot | null,
  postId: string,
  threadId: string | null,
  focusTurnIds: string[],
): number {
  if (!telemetry) return 0
  const focusTurnIdSet = new Set(focusTurnIds)
  return telemetry.recent.filter((entry) =>
    entry.post_id === postId
    && (!threadId || !entry.thread_id || entry.thread_id === threadId)
    && (
      entry.event_type === 'guide_click'
      || entry.event_type === 'node_focus'
      || entry.event_type === 'branch_expand'
    )
    && (
      focusTurnIdSet.size === 0
      || !entry.turn_id
      || focusTurnIdSet.has(entry.turn_id)
    )).length
}

function buildLocalBranchContext(input: {
  event: EventPayload
  thread: ThreadCapsule | null
  forest: DiscussionForestProjection | null
}): LocalBranchContext | null {
  if (!input.forest || !(input.thread?.thread_id ?? input.event.thread_id)) {
    return null
  }

  const threadId = input.thread?.thread_id ?? input.event.thread_id ?? null
  if (!threadId) return null

  const nodeById = new Map(input.forest.nodes.map((node) => [node.id, node] as const))
  const focusNode = resolveFocusNode(input.event, input.thread, input.forest, nodeById)
  const focusBranchNodes = collectFocusBranchNodes(threadId, focusNode, input.forest.nodes)
  const selectedAnchorNode = resolveSelectedAnchorNode(focusNode, nodeById, focusBranchNodes)
  const localReasonBadges = dedupeBadges([
    ...(focusNode?.reason_badges ?? []),
    ...(selectedAnchorNode?.reason_badges ?? []),
  ])
  const evidenceTurnIds = dedupeStrings([
    focusNode?.entry_kind === 'TURN' ? focusNode.id : null,
    selectedAnchorNode?.entry_kind === 'TURN' ? selectedAnchorNode.id : null,
    ...(focusNode?.collapsed_anchor_chain ?? []),
    ...focusBranchNodes
      .filter((node) => node.entry_kind === 'TURN')
      .slice(-2)
      .map((node) => node.id),
  ])

  return {
    focus_node: focusNode,
    selected_anchor_node: selectedAnchorNode,
    focus_branch_nodes: focusBranchNodes,
    focus_branch_agent_ids: collectAgentIds(focusBranchNodes),
    local_reason_badges: localReasonBadges,
    evidence_turn_ids: evidenceTurnIds,
    branch_entropy: computeBranchEntropy(threadId, input.forest.nodes),
    duel_risk: computeDuelRisk(focusBranchNodes),
    late_entry_share_recent: computeLateEntryShare(focusBranchNodes),
  }
}

function resolveFocusNode(
  event: EventPayload,
  thread: ThreadCapsule | null,
  forest: DiscussionForestProjection,
  nodeById: Map<string, TurnDisplayProjection>,
): TurnDisplayProjection | null {
  const explicitTargetNode =
    event.target_id && (event.target_type === 'TURN' || event.target_type === 'THREAD')
      ? nodeById.get(event.target_id) ?? null
      : null
  const eventNode = event.turn_id ? nodeById.get(event.turn_id) ?? null : null
  const focusTurnNode = forest.focus_turn_id ? nodeById.get(forest.focus_turn_id) ?? null : null
  const latestNode = thread?.latest_turn_id ? nodeById.get(thread.latest_turn_id) ?? null : null
  const threadRoot = (thread?.thread_id ?? event.thread_id)
    ? nodeById.get(thread?.thread_id ?? event.thread_id ?? '')
    : null

  return eventNode
    ?? explicitTargetNode
    ?? focusTurnNode
    ?? latestNode
    ?? threadRoot
    ?? null
}

function collectFocusBranchNodes(
  threadId: string,
  focusNode: TurnDisplayProjection | null,
  nodes: TurnDisplayProjection[],
): TurnDisplayProjection[] {
  const threadNodes = nodes
    .filter((node) => node.thread_id === threadId)
    .sort((left, right) => {
      if (left.display_depth !== right.display_depth) {
        return left.display_depth - right.display_depth
      }
      if (left.sibling_order !== right.sibling_order) {
        return left.sibling_order - right.sibling_order
      }
      return left.created_at.localeCompare(right.created_at)
    })
  if (!focusNode) return threadNodes

  const branchRootId =
    focusNode.branch_root_turn_id
    ?? (focusNode.entry_kind === 'TURN' ? focusNode.id : null)
  if (!branchRootId) return threadNodes

  const branchNodes = threadNodes.filter((node) =>
    node.id === threadId
    || node.id === branchRootId
    || node.branch_root_turn_id === branchRootId)
  return branchNodes.length > 0 ? branchNodes : threadNodes
}

function resolveSelectedAnchorNode(
  focusNode: TurnDisplayProjection | null,
  nodeById: Map<string, TurnDisplayProjection>,
  focusBranchNodes: TurnDisplayProjection[],
): TurnDisplayProjection | null {
  if (!focusNode) return null
  if (focusNode.entry_kind === 'TURN') {
    if (focusNode.actual_anchor_turn_id) {
      const actualAnchorNode = nodeById.get(focusNode.actual_anchor_turn_id) ?? null
      if (actualAnchorNode?.entry_kind === 'TURN') {
        return actualAnchorNode
      }
    }
    if (focusNode.is_late_entry && focusNode.collapsed_anchor_chain.length > 0) {
      const collapsedAnchorNode = nodeById.get(focusNode.collapsed_anchor_chain[0] ?? '') ?? null
      if (collapsedAnchorNode?.entry_kind === 'TURN') {
        return collapsedAnchorNode
      }
    }
    return focusNode
  }

  return [...focusBranchNodes].reverse().find((node) => node.entry_kind === 'TURN') ?? null
}

function collectAgentIds(nodes: TurnDisplayProjection[]): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const node of nodes) {
    if (node.entry_kind !== 'TURN') continue
    if (node.author.actor_type !== 'agent') continue
    if (seen.has(node.author.id)) continue
    seen.add(node.author.id)
    ids.push(node.author.id)
  }
  return ids
}

function computeBranchEntropy(threadId: string, nodes: TurnDisplayProjection[]): number {
  const turnNodes = nodes.filter((node) => node.thread_id === threadId && node.entry_kind === 'TURN')
  if (turnNodes.length === 0) return 0

  const counts = new Map<string, number>()
  for (const node of turnNodes) {
    const key = node.branch_root_turn_id ?? node.id
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  if (counts.size <= 1) return 0
  const total = turnNodes.length
  let entropy = 0
  for (const count of counts.values()) {
    const probability = count / total
    entropy -= probability * Math.log(probability)
  }
  return clamp(entropy / Math.log(counts.size), 0, 1)
}

function computeDuelRisk(nodes: TurnDisplayProjection[]): number {
  const turnNodes = nodes.filter((node) => node.entry_kind === 'TURN')
  if (turnNodes.length <= 1) return 0

  const counts = new Map<string, number>()
  for (const node of turnNodes) {
    counts.set(node.author.id, (counts.get(node.author.id) ?? 0) + 1)
  }
  const sortedCounts = [...counts.values()].sort((left, right) => right - left)
  const totalTurns = turnNodes.length
  const topTwoShare = ((sortedCounts[0] ?? 0) + (sortedCounts[1] ?? 0)) / totalTurns
  const diversityPenalty = counts.size <= 2 ? 1 : 2 / counts.size
  return clamp(topTwoShare * diversityPenalty, 0, 1)
}

function computeLateEntryShare(nodes: TurnDisplayProjection[]): number {
  const turnNodes = nodes.filter((node) => node.entry_kind === 'TURN')
  if (turnNodes.length === 0) return 0
  const lateEntries = turnNodes.filter((node) => node.is_late_entry).length
  return clamp(lateEntries / turnNodes.length, 0, 1)
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const deduped: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    deduped.push(value)
  }
  return deduped
}

function dedupeBadges(values: TurnReasonBadgeId[]): TurnReasonBadgeId[] {
  const deduped: TurnReasonBadgeId[] = []
  const seen = new Set<TurnReasonBadgeId>()
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    deduped.push(value)
  }
  return deduped
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value <= min) return min
  if (value >= max) return max
  return value
}
