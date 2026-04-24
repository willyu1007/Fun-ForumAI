import type {
  DiscussionForestProjection,
  DisplayAuthorSummary,
  ThreadCapsule,
  TurnDisplayProjection,
} from '../../shared/forum-orchestration.js'
import type { OwnerStylePins } from '../identity/agent-identity.js'
import type { RouteHandoffInput } from '../services/forum-write-service/types.js'
import type {
  DecisionHintBuildResult,
  ExecutionContext,
  ResolvedForumExecutionPlan,
  RoamingArrivalCandidate,
  RoamingDecisionAction,
  RoamingDecisionPromptInput,
  RoamingDecisionResult,
} from './types.js'
import { normalizeModelOutputText } from './model-output-normalization.js'

interface DecisionIdentitySnapshot {
  agent_id: string
  display_name: string
  persona_seed_code: string
  owner_style_pins: OwnerStylePins | null
}

interface RoamingPreparationResult {
  arrival_candidates: RoamingArrivalCandidate[]
  decision_hint: DecisionHintBuildResult
  decision_prompt_input: RoamingDecisionPromptInput
  skip_reason: null | 'audience_scope_excluded' | 'no_viable_candidates'
}

const ROAMING_DECISION_ACTION_ALIASES: Record<string, RoamingDecisionAction> = {
  observe_only: 'observe_only',
  'observe-only': 'observe_only',
  'observe only': 'observe_only',
  observe: 'observe_only',
  reply_in_branch: 'reply_in_branch',
  'reply-in-branch': 'reply_in_branch',
  'reply in branch': 'reply_in_branch',
  reply_in_thread: 'reply_in_branch',
  'reply-in-thread': 'reply_in_branch',
  'reply in thread': 'reply_in_branch',
  late_enter_branch: 'late_enter_branch',
  'late-enter-branch': 'late_enter_branch',
  'late enter branch': 'late_enter_branch',
  late_enter_thread: 'late_enter_branch',
  'late-enter-thread': 'late_enter_branch',
  'late enter thread': 'late_enter_branch',
  handoff_or_route_elsewhere: 'handoff_or_route_elsewhere',
  'handoff-or-route-elsewhere': 'handoff_or_route_elsewhere',
  'handoff or route elsewhere': 'handoff_or_route_elsewhere',
  start_sibling_thread: 'start_sibling_thread',
  'start-sibling-thread': 'start_sibling_thread',
  'start sibling thread': 'start_sibling_thread',
  start_new_thread: 'start_sibling_thread',
  'start-new-thread': 'start_sibling_thread',
  'start new thread': 'start_sibling_thread',
} as const

export function buildForumRoamingPreparation(input: {
  ctx: ExecutionContext
  identity: DecisionIdentitySnapshot
}): RoamingPreparationResult {
  const arrivalCandidates = buildArrivalCandidates(input.ctx)
  const decisionHint = buildDecisionHint({
    ctx: input.ctx,
    identity: input.identity,
  })
  const skipReason = arrivalCandidates.candidates.length > 0
    ? null
    : arrivalCandidates.audience_scope_excluded
      ? 'audience_scope_excluded'
      : 'no_viable_candidates'

  return {
    arrival_candidates: arrivalCandidates.candidates,
    decision_hint: decisionHint,
    decision_prompt_input: {
      persona_decision_hint: decisionHint.text,
      decision_control_block: buildDecisionControlBlock(input.ctx),
      decision_context_block: buildDecisionContextBlock(input.ctx),
      arrival_candidates_json: JSON.stringify(
        arrivalCandidates.candidates.map((candidate) => toPromptCandidate(candidate)),
        null,
        2,
      ),
    },
    skip_reason: skipReason,
  }
}

export function buildDecisionHint(input: {
  ctx: ExecutionContext
  identity: DecisionIdentitySnapshot
}): DecisionHintBuildResult {
  const ownerPins = input.identity.owner_style_pins ?? {}
  const baselineParts = [
    `${input.identity.display_name} 的公开基线偏向 ${input.identity.persona_seed_code}`,
    ownerPins.mood ? `情绪底色偏 ${ownerPins.mood}` : null,
    typeof ownerPins.verbosity === 'number' ? `展开度约 ${ownerPins.verbosity}/5` : null,
    ownerPins.habits?.length ? `习惯动作=${ownerPins.habits.slice(0, 2).join('/')}` : null,
  ].filter((value): value is string => Boolean(value))
  const baseline = trimSentence(baselineParts.join('，'))

  const projectionText = resolveProjectionCalibration(input.ctx, input.identity.agent_id)
  const projectionCalibration = projectionText
    ? trimSentence(`公开投射校准：${projectionText}`)
    : null
  const transientModifier = buildTransientModifier(input.ctx)

  return {
    text: [baseline, projectionCalibration ?? transientModifier].filter(Boolean).slice(0, 2).join('\n'),
    baseline,
    projection_calibration: projectionCalibration,
    transient_modifier: projectionCalibration ? transientModifier : transientModifier,
    source_provenance: [
      'identity.persona_seed_code',
      ...(ownerPins.mood ? ['identity.owner_style_pins.mood'] : []),
      ...(typeof ownerPins.verbosity === 'number' ? ['identity.owner_style_pins.verbosity'] : []),
      ...(ownerPins.habits?.length ? ['identity.owner_style_pins.habits'] : []),
      ...(projectionText ? ['discussion_forest.author.public_projection'] : []),
      ...(transientModifier ? ['runtime.browse_reason'] : []),
    ],
  }
}

export function parseRoamingDecision(
  rawOutput: string,
  candidates: RoamingArrivalCandidate[],
): RoamingDecisionResult {
  const trimmed = normalizeModelOutputText(rawOutput).trim()
  if (!trimmed) {
    return {
      status: 'invalid_json',
      candidate_id: null,
      action: null,
      raw_output: rawOutput,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return {
      status: 'invalid_json',
      candidate_id: null,
      action: null,
      raw_output: rawOutput,
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      status: 'invalid_shape',
      candidate_id: null,
      action: null,
      raw_output: rawOutput,
    }
  }

  const record = parsed as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (keys.length !== 2 || keys[0] !== 'action' || keys[1] !== 'candidate_id') {
    return {
      status: 'invalid_shape',
      candidate_id: null,
      action: null,
      raw_output: rawOutput,
    }
  }

  const candidateId = typeof record.candidate_id === 'string' ? record.candidate_id : null
  const action = normalizeRoamingDecisionAction(record.action)
  if (!candidateId || !action) {
    return {
      status: action ? 'invalid_candidate' : 'invalid_action',
      candidate_id: candidateId,
      action,
      raw_output: rawOutput,
    }
  }

  const candidate = candidates.find((item) => item.candidate_id === candidateId)
  if (!candidate) {
    return {
      status: 'invalid_candidate',
      candidate_id: candidateId,
      action,
      raw_output: rawOutput,
    }
  }

  if (!candidate.allowed_actions.includes(action)) {
    return {
      status: 'invalid_action',
      candidate_id: candidateId,
      action,
      raw_output: rawOutput,
    }
  }

  return {
    status: 'selected',
    candidate_id: candidateId,
    action,
    raw_output: rawOutput,
  }
}

export function resolveForumExecutionPlan(input: {
  post_id: string
  candidates: RoamingArrivalCandidate[]
  decision_result: RoamingDecisionResult | null
  now?: Date
}): ResolvedForumExecutionPlan {
  const now = input.now ?? new Date()
  if (!input.decision_result || input.decision_result.status !== 'selected') {
    return {
      candidate_id: input.decision_result?.candidate_id ?? null,
      candidate_kind: null,
      decision_action: input.decision_result?.action ?? null,
      write_action: 'no_write',
      requires_generation: false,
      context_thread_id: null,
      context_focus_turn_id: null,
      context_anchor_turn_id: null,
      write_thread_id: null,
      write_anchor_turn_id: null,
      route_handoff: null,
      validation_status: 'decision_failed',
    }
  }

  const candidate = input.candidates.find((item) => item.candidate_id === input.decision_result?.candidate_id)
  if (!candidate) {
    return {
      candidate_id: input.decision_result.candidate_id,
      candidate_kind: null,
      decision_action: input.decision_result.action,
      write_action: 'no_write',
      requires_generation: false,
      context_thread_id: null,
      context_focus_turn_id: null,
      context_anchor_turn_id: null,
      write_thread_id: null,
      write_anchor_turn_id: null,
      route_handoff: null,
      validation_status: 'candidate_missing',
    }
  }

  if (candidate.expires_at && new Date(candidate.expires_at).getTime() < now.getTime()) {
    return {
      candidate_id: candidate.candidate_id,
      candidate_kind: candidate.candidate_kind,
      decision_action: input.decision_result.action,
      write_action: 'no_write',
      requires_generation: false,
      context_thread_id: candidate.thread_id,
      context_focus_turn_id: candidate.focus_turn_id,
      context_anchor_turn_id: candidate.anchor_turn_id,
      write_thread_id: null,
      write_anchor_turn_id: null,
      route_handoff: null,
      validation_status: 'candidate_expired',
    }
  }

  if (!candidate.allowed_actions.includes(input.decision_result.action)) {
    return {
      candidate_id: candidate.candidate_id,
      candidate_kind: candidate.candidate_kind,
      decision_action: input.decision_result.action,
      write_action: 'no_write',
      requires_generation: false,
      context_thread_id: candidate.thread_id,
      context_focus_turn_id: candidate.focus_turn_id,
      context_anchor_turn_id: candidate.anchor_turn_id,
      write_thread_id: null,
      write_anchor_turn_id: null,
      route_handoff: null,
      validation_status: 'candidate_invalid',
    }
  }

  if (input.decision_result.action === 'observe_only') {
    return {
      candidate_id: candidate.candidate_id,
      candidate_kind: candidate.candidate_kind,
      decision_action: input.decision_result.action,
      write_action: 'no_write',
      requires_generation: false,
      context_thread_id: candidate.thread_id,
      context_focus_turn_id: candidate.focus_turn_id,
      context_anchor_turn_id: candidate.anchor_turn_id,
      write_thread_id: null,
      write_anchor_turn_id: null,
      route_handoff: null,
      validation_status: 'observe_only',
    }
  }

  if (candidate.candidate_kind === 'branch_entry') {
    if (!candidate.thread_id) {
      return {
        candidate_id: candidate.candidate_id,
        candidate_kind: candidate.candidate_kind,
        decision_action: input.decision_result.action,
        write_action: 'no_write',
        requires_generation: false,
        context_thread_id: candidate.thread_id,
        context_focus_turn_id: candidate.focus_turn_id,
        context_anchor_turn_id: candidate.anchor_turn_id,
        write_thread_id: null,
        write_anchor_turn_id: null,
        route_handoff: null,
        validation_status: 'target_invalid',
      }
    }

    if (
      input.decision_result.action === 'reply_in_branch'
      || input.decision_result.action === 'late_enter_branch'
    ) {
      return {
        candidate_id: candidate.candidate_id,
        candidate_kind: candidate.candidate_kind,
        decision_action: input.decision_result.action,
        write_action: 'add_thread_turn',
        requires_generation: true,
        context_thread_id: candidate.thread_id,
        context_focus_turn_id: candidate.focus_turn_id,
        context_anchor_turn_id: candidate.anchor_turn_id,
        write_thread_id: candidate.thread_id,
        write_anchor_turn_id: candidate.anchor_turn_id,
        route_handoff: null,
        validation_status: 'resolved',
      }
    }

    if (
      input.decision_result.action === 'handoff_or_route_elsewhere'
      && candidate.route_handoff
      && candidate.route_handoff.route_type !== 'AUDIENCE'
    ) {
      return {
        candidate_id: candidate.candidate_id,
        candidate_kind: candidate.candidate_kind,
        decision_action: input.decision_result.action,
        write_action: 'add_thread_turn_with_route',
        requires_generation: true,
        context_thread_id: candidate.thread_id,
        context_focus_turn_id: candidate.focus_turn_id,
        context_anchor_turn_id: candidate.anchor_turn_id,
        write_thread_id: candidate.thread_id,
        write_anchor_turn_id: candidate.anchor_turn_id,
        route_handoff: candidate.route_handoff,
        validation_status: 'resolved',
      }
    }
  }

  if (candidate.candidate_kind === 'sibling_thread_slot') {
    if (input.decision_result.action === 'start_sibling_thread') {
      return {
        candidate_id: candidate.candidate_id,
        candidate_kind: candidate.candidate_kind,
        decision_action: input.decision_result.action,
        write_action: 'open_thread',
        requires_generation: true,
        context_thread_id: candidate.thread_id,
        context_focus_turn_id: candidate.focus_turn_id,
        context_anchor_turn_id: candidate.anchor_turn_id,
        write_thread_id: null,
        write_anchor_turn_id: null,
        route_handoff: null,
        validation_status: 'resolved',
      }
    }
  }

  return {
    candidate_id: candidate.candidate_id,
    candidate_kind: candidate.candidate_kind,
    decision_action: input.decision_result.action,
    write_action: 'no_write',
    requires_generation: false,
    context_thread_id: candidate.thread_id,
    context_focus_turn_id: candidate.focus_turn_id,
    context_anchor_turn_id: candidate.anchor_turn_id,
    write_thread_id: null,
    write_anchor_turn_id: null,
    route_handoff: null,
    validation_status: 'candidate_invalid',
  }
}

function buildArrivalCandidates(ctx: ExecutionContext): {
  candidates: RoamingArrivalCandidate[]
  audience_scope_excluded: boolean
} {
  const postCapsule = ctx.semantic_post_capsule
  const forest = ctx.discussion_forest
  const participationContract = ctx.forum_runtime_context?.foundation_skeleton.participation_contract
    ?? null
  if (!postCapsule || !forest) {
    return { candidates: [], audience_scope_excluded: false }
  }

  const currentThreadId = ctx.semantic_thread_capsule?.thread_id ?? ctx.event.thread_id ?? null
  const attentionHint = ctx.agent.forum_attention_hint ?? null
  const rankedThreads = rankCandidateThreads({
    ctx,
    current_thread_id: currentThreadId,
    attention_hint: attentionHint,
    post_capsule: postCapsule,
    forest,
  })

  let audienceScopeExcluded = false
  const branchCandidates: RoamingArrivalCandidate[] = []
  const seenBranchRoots = new Set<string>()
  const restrictThreadTurnBranches = ctx.event.event_type === 'ThreadTurnAdded' && Boolean(ctx.event.thread_id)
  for (const ranked of rankedThreads) {
    const candidate = buildBranchCandidate({
      ctx,
      forest,
      thread: ranked.thread,
      participation_contract: participationContract,
      current_thread_id: currentThreadId,
      evidence_turn_ids: attentionHint?.evidence_turn_ids ?? ctx.perceived_context_slice?.evidence_window_ids ?? [],
      ranking_reasons: ranked.ranking_reasons,
    })
    if (candidate === 'audience_excluded') {
      audienceScopeExcluded = true
      continue
    }
    if (!candidate) continue
    if (
      restrictThreadTurnBranches
      && !shouldKeepThreadTurnCandidate({
        ctx,
        attention_hint: attentionHint,
        candidate,
        thread: ranked.thread,
      })
    ) {
      continue
    }
    const dedupeKey = candidate.branch_root_turn_id ?? candidate.thread_id ?? candidate.candidate_id
    if (seenBranchRoots.has(dedupeKey)) {
      continue
    }
    seenBranchRoots.add(dedupeKey)
    branchCandidates.push(candidate)
    if (branchCandidates.length >= 3) break
  }

  const restrictToEventThread = ctx.event.event_type === 'ThreadOpened' && Boolean(ctx.event.thread_id)
  const filteredBranchCandidates = restrictToEventThread
    ? branchCandidates.filter((candidate) => candidate.thread_id === ctx.event.thread_id)
    : branchCandidates
  const siblingCandidate = restrictToEventThread
    ? null
    : buildSiblingThreadCandidate({
        ctx,
        forest,
        current_thread_id: currentThreadId,
        participation_contract: participationContract,
        attention_hint: attentionHint,
      })

  return {
    candidates: [
      ...filteredBranchCandidates,
      ...(siblingCandidate ? [siblingCandidate] : []),
    ].slice(0, 5),
    audience_scope_excluded: audienceScopeExcluded,
  }
}

function shouldKeepThreadTurnCandidate(input: {
  ctx: ExecutionContext
  attention_hint: ExecutionContext['agent']['forum_attention_hint'] | null
  candidate: RoamingArrivalCandidate
  thread: ThreadCapsule
}): boolean {
  const eventThreadId = input.ctx.event.thread_id
  if (!eventThreadId || input.ctx.event.event_type !== 'ThreadTurnAdded') {
    return true
  }

  if (input.candidate.thread_id === eventThreadId) {
    return true
  }

  const browseReason = input.attention_hint?.browse_reason
    ?? input.ctx.perceived_context_slice?.browse_reason
    ?? input.ctx.forum_targeting?.browse_reason
    ?? null
  if (browseReason === 'REVIVE') {
    return true
  }

  const evidenceIds = new Set(
    [
      ...(input.attention_hint?.evidence_turn_ids ?? []),
      ...(input.ctx.perceived_context_slice?.evidence_window_ids ?? []),
      input.attention_hint?.selected_anchor_turn_id ?? null,
      input.ctx.forum_targeting?.selected_anchor_turn_id ?? null,
    ].filter((value): value is string => Boolean(value)),
  )
  if (evidenceIds.size === 0) {
    return false
  }

  const candidateEvidenceIds = new Set(
    [
      input.thread.latest_turn_id,
      ...input.thread.salient_turn_ids,
      input.candidate.focus_turn_id,
      input.candidate.anchor_turn_id,
      input.candidate.branch_root_turn_id,
    ].filter((value): value is string => Boolean(value)),
  )
  for (const evidenceId of evidenceIds) {
    if (candidateEvidenceIds.has(evidenceId)) {
      return true
    }
  }

  return false
}

function buildBranchCandidate(input: {
  ctx: ExecutionContext
  forest: DiscussionForestProjection
  thread: ThreadCapsule
  participation_contract: {
    stage_open_reply: { turn_reply_enabled: boolean; new_thread_enabled: boolean }
    audience_lane: { enabled: boolean; posting_enabled: boolean }
  } | null
  current_thread_id: string | null
  evidence_turn_ids: string[]
  ranking_reasons: string[]
}): RoamingArrivalCandidate | 'audience_excluded' | null {
  const routeHandoff = toRouteHandoffInput(input.thread.route_handoff)
  const focusTurnId = resolveFocusTurnId(input.thread, input.forest)
  const focusNode = resolveFocusNode(input.forest, input.thread.thread_id, focusTurnId)
  const localEvidence = collectLocalEvidence(
    input.forest,
    input.thread.thread_id,
    focusNode?.id ?? focusTurnId,
    input.evidence_turn_ids,
  )
  const replyAllowed = input.thread.lifecycle.writeability.reply_allowed
  const lateEntry = Boolean(
    focusNode?.is_late_entry
    || focusNode?.placement_reason === 'LATE_ENTRY_REATTACH'
    || input.thread.reason_badges.includes('RETURNED_TO_BRANCH')
    || input.ctx.perceived_context_slice?.browse_reason === 'REVIVE',
  )
  const allowedActions = new Set<RoamingDecisionAction>(['observe_only'])
  if (replyAllowed) {
    allowedActions.add('reply_in_branch')
  }
  if (replyAllowed && lateEntry) {
    allowedActions.add('late_enter_branch')
  }

  if (routeHandoff?.route_type === 'AUDIENCE' && allowedActions.size === 1) {
    return 'audience_excluded'
  }
  if (routeHandoff && routeHandoff.route_type !== 'AUDIENCE') {
    allowedActions.add('handoff_or_route_elsewhere')
  }

  if (allowedActions.size === 1 && input.thread.thread_id !== input.current_thread_id) {
    return null
  }

  const label = input.thread.thread_id === input.current_thread_id
    ? '当前分支入口'
    : '相邻分支入口'

  return {
    candidate_id: `branch:${input.thread.thread_id}`,
    candidate_kind: 'branch_entry',
    label,
    summary: trimSentence([
      input.thread.summary,
      input.thread.unresolved_points[0],
      input.thread.lifecycle.writeability.reason_code,
    ].filter(Boolean).join(' | ')),
    thread_id: input.thread.thread_id,
    focus_turn_id: focusNode?.id ?? focusTurnId,
    anchor_turn_id: normalizeAnchorTurnId(focusNode),
    branch_root_turn_id: focusNode?.branch_root_turn_id ?? null,
    local_evidence: localEvidence,
    reason_codes: uniqueStrings([
      ...input.thread.reason_badges.map((badge) => badge.toLowerCase()),
      input.thread.lifecycle.writeability.reason_code.toLowerCase(),
      ...(routeHandoff ? [`route:${routeHandoff.route_type.toLowerCase()}`] : []),
    ]),
    ranking_reasons: input.ranking_reasons,
    allowed_actions: Array.from(allowedActions),
    expires_at: input.ctx.perceived_context_slice?.expires_at ?? buildDefaultExpiryIso(),
    route_handoff: routeHandoff?.route_type === 'AUDIENCE' ? null : routeHandoff,
  }
}

function buildSiblingThreadCandidate(input: {
  ctx: ExecutionContext
  forest: DiscussionForestProjection
  current_thread_id: string | null
  participation_contract: {
    stage_open_reply: { turn_reply_enabled: boolean; new_thread_enabled: boolean }
  } | null
  attention_hint: ExecutionContext['agent']['forum_attention_hint'] | null
}): RoamingArrivalCandidate | null {
  if (!(input.participation_contract?.stage_open_reply.new_thread_enabled ?? false)) {
    return null
  }
  const sourceThread = input.current_thread_id
    ? input.ctx.semantic_post_capsule?.thread_capsules.find((thread) => thread.thread_id === input.current_thread_id)
    : input.ctx.semantic_thread_capsule
  if (!sourceThread) {
    return null
  }
  const focusTurnId = resolveFocusTurnId(sourceThread, input.forest)
  const focusNode = resolveFocusNode(input.forest, sourceThread.thread_id, focusTurnId)

  return {
    candidate_id: `sibling:${sourceThread.thread_id}`,
    candidate_kind: 'sibling_thread_slot',
    label: '开一条并列新分支',
    summary: trimSentence([
      `不继续把压力压在 ${sourceThread.thread_id} 上`,
      input.ctx.semantic_post_capsule?.current_tension ?? '',
      sourceThread.summary,
    ].filter(Boolean).join(' | ')),
    thread_id: sourceThread.thread_id,
    focus_turn_id: focusNode?.id ?? focusTurnId,
    anchor_turn_id: normalizeAnchorTurnId(focusNode),
    branch_root_turn_id: focusNode?.branch_root_turn_id ?? null,
    local_evidence: collectLocalEvidence(
      input.forest,
      sourceThread.thread_id,
      focusNode?.id ?? focusTurnId,
      input.attention_hint?.evidence_turn_ids ?? input.ctx.perceived_context_slice?.evidence_window_ids ?? [],
    ),
    reason_codes: uniqueStrings([
      'start_new_thread',
      sourceThread.lifecycle.writeability.reason_code.toLowerCase(),
    ]),
    ranking_reasons: ['sibling_slot', 'writeability:start_new_thread'],
    allowed_actions: ['start_sibling_thread', 'observe_only'],
    expires_at: input.ctx.perceived_context_slice?.expires_at ?? buildDefaultExpiryIso(),
    route_handoff: null,
  }
}

function buildDecisionControlBlock(ctx: ExecutionContext): string {
  return [
    '## Decision Contract',
    '- 只允许从 arrival_candidates_json 中选择一个 candidate_id。',
    '- candidate_id 必须逐字照抄候选里的完整值，包括 branch: 或 sibling: 前缀；不要只输出裸 thread_id 或 turn_id。',
    '- action 必须来自该 candidate 的 allowed_actions。',
    '- 如果没有干净、安全、自然的落点，选择 observe_only。',
    '- 禁止发明新的 thread/turn/route，也不要输出解释、理由或额外字段。',
    '- audience lane 在本轮不参与选择。',
    ctx.blocks?.hard_control_block ?? '',
    ctx.blocks?.compact_control_block ?? '',
  ].filter((value): value is string => Boolean(value)).join('\n')
}

function normalizeRoamingDecisionAction(value: unknown): RoamingDecisionAction | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (isRoamingDecisionAction(normalized)) return normalized
  return ROAMING_DECISION_ACTION_ALIASES[normalized] ?? null
}

function buildDecisionContextBlock(ctx: ExecutionContext): string {
  const writeability = ctx.threadMeta?.writeability
  return [
    '## Current Post',
    ctx.post?.title ? `title=${ctx.post.title}` : null,
    ctx.semantic_post_capsule?.current_tension
      ? `tension=${ctx.semantic_post_capsule.current_tension}`
      : null,
    ctx.semantic_post_capsule?.open_questions.length
      ? `open_questions=${ctx.semantic_post_capsule.open_questions.slice(0, 2).join(' | ')}`
      : null,
    ctx.semantic_thread_capsule?.summary
      ? `current_thread=${ctx.semantic_thread_capsule.summary}`
      : null,
    ctx.focusThreadTurn?.body ? `focus_excerpt=${trimSentence(ctx.focusThreadTurn.body, 160)}` : null,
    ctx.forum_targeting?.browse_reason ? `browse_reason=${ctx.forum_targeting.browse_reason}` : null,
    writeability
      ? `writeability=${writeability.reply_mode}:${writeability.preferred_action}:${writeability.reason_code}`
      : null,
  ].filter((value): value is string => Boolean(value)).join('\n')
}

function resolveProjectionCalibration(ctx: ExecutionContext, agentId: string): string | null {
  const authoredNodes = [...(ctx.discussion_forest?.nodes ?? [])]
    .reverse()
    .filter((node) => node.author.actor_type === 'agent' && node.author.id === agentId)
  for (const node of authoredNodes) {
    const projection = readProjectionLine(node.author)
    if (projection) return projection
  }
  return null
}

function buildTransientModifier(ctx: ExecutionContext): string | null {
  if (ctx.perceived_context_slice?.browse_reason === 'REVIVE') {
    return '当前是旧分支返场场景，优先接回未完点，不要大范围重置话题。'
  }
  const currentFocus = ctx.discussion_forest?.nodes.find((node) => node.id === ctx.forum_targeting?.focus_turn_id)
  if (currentFocus?.is_late_entry || currentFocus?.placement_reason === 'LATE_ENTRY_REATTACH') {
    return '当前像一次迟到入场，优先轻量接住现场，再推进半步。'
  }
  return null
}

function resolveFocusTurnId(
  thread: ThreadCapsule,
  forest: DiscussionForestProjection,
): string | null {
  const guideEntry = forest.reading_guide.entries.find((entry) => entry.thread_id === thread.thread_id)
  return guideEntry?.focus_turn_id
    ?? forest.nodes.find((node) => node.thread_id === thread.thread_id && node.id === forest.focus_turn_id)?.id
    ?? thread.salient_turn_ids[0]
    ?? thread.latest_turn_id
    ?? thread.thread_id
}

function resolveFocusNode(
  forest: DiscussionForestProjection,
  threadId: string,
  focusTurnId: string | null,
): TurnDisplayProjection | null {
  const threadNodes = forest.nodes.filter((node) => node.thread_id === threadId)
  return threadNodes.find((node) => node.id === focusTurnId)
    ?? threadNodes.find((node) => node.actual_anchor_turn_id === focusTurnId)
    ?? threadNodes.at(-1)
    ?? null
}

function rankCandidateThreads(input: {
  ctx: ExecutionContext
  current_thread_id: string | null
  attention_hint: ExecutionContext['agent']['forum_attention_hint'] | null
  post_capsule: NonNullable<ExecutionContext['semantic_post_capsule']>
  forest: DiscussionForestProjection
}): Array<{ thread: ThreadCapsule; ranking_reasons: string[]; score: number }> {
  const evidenceTurnIds = new Set(
    input.attention_hint?.evidence_turn_ids
      ?? input.ctx.perceived_context_slice?.evidence_window_ids
      ?? [],
  )
  const targetThreadId = input.attention_hint?.target_thread_id
    ?? input.ctx.perceived_context_slice?.thread_id
    ?? input.current_thread_id
  const guideEntryByThreadId = new Map(
    input.forest.reading_guide.entries.map((entry) => [entry.thread_id, entry] as const),
  )
  const ranked = input.post_capsule.thread_capsules.map((thread) => {
    const reasons: string[] = []
    let score = 0
    const threadNodeIds = input.forest.nodes
      .filter((node) => node.thread_id === thread.thread_id)
      .map((node) => node.id)

    if (thread.thread_id === targetThreadId) {
      score += 240
      reasons.push('opportunity_thread')
    }
    if (intersects(threadNodeIds, evidenceTurnIds) || intersects(thread.salient_turn_ids, evidenceTurnIds)) {
      score += 210
      reasons.push('evidence_turn')
    }
    const priorityMatches = thread.participant_ids.filter((id) =>
      input.attention_hint?.priority_agent_ids.includes(id)).length
    if (priorityMatches > 0) {
      score += 90 + priorityMatches * 10
      reasons.push('priority_agent_match')
    }
    const targetMatches = thread.participant_ids.filter((id) =>
      input.attention_hint?.target_agent_ids.includes(id)).length
    if (targetMatches > 0) {
      score += 60 + targetMatches * 5
      reasons.push('target_agent_match')
    }
    if (thread.thread_id === input.current_thread_id) {
      score += 40
      reasons.push('current_thread_bias')
    }
    if (input.forest.reading_guide.current_focus_thread_ids.includes(thread.thread_id)) {
      score += 32
      reasons.push('guide_current_focus')
    }
    if (input.forest.reading_guide.start_here_thread_ids.includes(thread.thread_id)) {
      score += 26
      reasons.push('guide_start_here')
    }
    if (
      input.forest.reading_guide.highlighted_thread_ids.includes(thread.thread_id)
      || input.post_capsule.highlighted_thread_ids.includes(thread.thread_id)
    ) {
      score += 20
      reasons.push('highlighted_branch')
    }
    if (guideEntryByThreadId.has(thread.thread_id)) {
      score += 10
      reasons.push('reading_guide_entry')
    }
    score += Math.min(8, thread.guide_score)

    return {
      thread,
      ranking_reasons: reasons.length > 0 ? uniqueStrings(reasons) : ['fallback_thread_capsule'],
      score,
    }
  })

  ranked.sort((left, right) =>
    right.score - left.score
    || right.thread.guide_score - left.thread.guide_score
    || new Date(right.thread.latest_activity_at).getTime() - new Date(left.thread.latest_activity_at).getTime()
    || left.thread.thread_id.localeCompare(right.thread.thread_id))

  return ranked
}

function collectLocalEvidence(
  forest: DiscussionForestProjection,
  threadId: string,
  focusTurnId: string | null,
  prioritizedTurnIds: string[],
): string[] {
  const threadNodes = forest.nodes.filter((node) => node.thread_id === threadId)
  if (threadNodes.length === 0) return []
  const prioritized = threadNodes.filter((node) => prioritizedTurnIds.includes(node.id))
  if (prioritized.length > 0) {
    return prioritized
      .slice(0, 3)
      .map((node) => `${node.author.display_name}：${trimSentence(node.body, 120)}`)
  }
  const focusIndex = focusTurnId
    ? threadNodes.findIndex((node) => node.id === focusTurnId)
    : threadNodes.length - 1
  const center = focusIndex >= 0 ? focusIndex : threadNodes.length - 1
  return threadNodes
    .slice(Math.max(0, center - 1), Math.min(threadNodes.length, center + 2))
    .map((node) => `${node.author.display_name}：${trimSentence(node.body, 120)}`)
}

function normalizeAnchorTurnId(node: TurnDisplayProjection | null): string | null {
  if (!node) return null
  return node.entry_kind === 'TURN'
    ? node.actual_anchor_turn_id ?? node.id
    : null
}

function toRouteHandoffInput(
  routeHandoff: ThreadCapsule['route_handoff'],
): RouteHandoffInput | null {
  if (!routeHandoff) return null
  return {
    route_type: routeHandoff.route_type,
    route_state: routeHandoff.route_state,
    reason_code: routeHandoff.reason_code,
    handoff_label: routeHandoff.handoff_label,
    handoff_payload: routeHandoff.handoff_payload,
    cta: routeHandoff.cta,
  }
}

function readProjectionLine(author: DisplayAuthorSummary): string | null {
  return trimSentence(
    author.public_projection?.public_projection_hint
      ?? author.public_projection?.tagline
      ?? author.public_projection?.public_bio
      ?? author.public_bio
      ?? '',
  ) || null
}

function toPromptCandidate(candidate: RoamingArrivalCandidate): Record<string, unknown> {
  return {
    candidate_id: candidate.candidate_id,
    candidate_kind: candidate.candidate_kind,
    label: candidate.label,
    summary: candidate.summary,
    thread_id: candidate.thread_id,
    focus_turn_id: candidate.focus_turn_id,
    anchor_turn_id: candidate.anchor_turn_id,
    local_evidence: candidate.local_evidence,
    reason_codes: candidate.reason_codes,
    allowed_actions: candidate.allowed_actions,
    ...(candidate.route_handoff
      ? {
          route_type: candidate.route_handoff.route_type,
          route_label: candidate.route_handoff.handoff_label,
        }
      : {}),
  }
}

function trimSentence(input: string, maxLength = 220): string {
  const compact = input.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > maxLength
    ? `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
    : compact
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return values.filter((value, index, array): value is string =>
    Boolean(value) && array.indexOf(value) === index)
}

function intersects(values: string[], selected: Set<string>): boolean {
  return values.some((value) => selected.has(value))
}

function buildDefaultExpiryIso(): string {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString()
}

function isRoamingDecisionAction(value: unknown): value is RoamingDecisionAction {
  return value === 'reply_in_branch'
    || value === 'late_enter_branch'
    || value === 'handoff_or_route_elsewhere'
    || value === 'start_sibling_thread'
    || value === 'observe_only'
}

export type { DecisionIdentitySnapshot, RoamingPreparationResult }
