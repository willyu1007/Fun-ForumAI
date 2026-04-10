import type {
  AudienceSignalCapsule,
  EvidenceRef,
  PostFlowPhase,
  PostSemanticCapsule,
  PublicProjectionCue,
  ReadingGuideProjection,
  ThreadCapsule,
  ThreadRole,
  TurnAct,
  TurnReasonBadgeId,
  TurnSemanticMark,
} from '../../shared/forum-orchestration.js'
import {
  FORUM_AUDIENCE_SIGNAL_CAPSULE_SCHEMA_VERSION as AUDIENCE_SIGNAL_CAPSULE_SCHEMA_VERSION,
  FORUM_POST_SEMANTIC_CAPSULE_SCHEMA_VERSION as POST_SEMANTIC_CAPSULE_SCHEMA_VERSION,
  FORUM_PUBLIC_PROJECTION_CUE_SCHEMA_VERSION as PUBLIC_PROJECTION_CUE_SCHEMA_VERSION,
  FORUM_READING_GUIDE_SCHEMA_VERSION as READING_GUIDE_SCHEMA_VERSION,
  FORUM_THREAD_CAPSULE_SCHEMA_VERSION as THREAD_CAPSULE_SCHEMA_VERSION,
  FORUM_TURN_SEMANTIC_MARK_SCHEMA_VERSION as TURN_SEMANTIC_MARK_SCHEMA_VERSION,
} from '../../shared/forum-orchestration.js'
import type {
  AuthorSummary,
  PostWithMeta,
  PublicStageThreadWithAuthor,
  PublicStageTurnWithAuthor,
} from './forum-read-service.js'
import type { ThreadLifecycleService } from './thread-lifecycle-service.js'
import { ThreadInteractionResolver } from './thread-interaction-resolver.js'

export interface SemanticProjectionServiceDeps {
  threadLifecycleService: ThreadLifecycleService
  threadInteractionResolver?: ThreadInteractionResolver | null
}

export class SemanticProjectionService {
  constructor(private readonly deps: SemanticProjectionServiceDeps) {}

  buildAudienceSignalCapsule(input: {
    post_id: string
    messages?: Array<{ id?: string; created_at: string | Date }>
    highlights?: Array<{ audience_message_id?: string | null }>
    aftershow_summary?: { published_at?: string | null } | null
  }): AudienceSignalCapsule {
    const messages = input.messages ?? []
    const latestMessageAt = messages
      .map((item) => toIsoString(item.created_at))
      .sort()
      .at(-1) ?? null
    const highlightedMessageIds = (input.highlights ?? [])
      .map((item) => item.audience_message_id ?? null)
      .filter((item): item is string => Boolean(item))

    return {
      schema_version: AUDIENCE_SIGNAL_CAPSULE_SCHEMA_VERSION,
      post_id: input.post_id,
      message_count: messages.length,
      message_count_24h: messages.length,
      highlighted_message_count: highlightedMessageIds.length,
      summary_available: Boolean(input.aftershow_summary?.published_at),
      latest_message_at: latestMessageAt,
      summary: messages.length > 0
        ? `观众侧最近累计 ${messages.length} 条公开反馈。`
        : '观众侧暂时没有新的公开反馈。',
      top_signals: buildAudienceTopSignals({
        messageCount: messages.length,
        highlightedMessageCount: highlightedMessageIds.length,
        summaryAvailable: Boolean(input.aftershow_summary?.published_at),
      }),
      highlighted_message_ids: highlightedMessageIds,
      evidence_refs: highlightedMessageIds.map((id) => ({ kind: 'AUDIENCE_MESSAGE', id })),
      updated_at: input.aftershow_summary?.published_at ?? latestMessageAt ?? new Date().toISOString(),
    }
  }

  buildThreadCapsule(
    thread: PublicStageThreadWithAuthor,
    audienceSignals: AudienceSignalCapsule | null = null,
  ): ThreadCapsule {
    const marks = this.buildTurnMarks(thread)
    const badgeIds = Array.from(new Set(marks.flatMap((item) => item.badge_ids)))
    const participantIds = Array.from(new Set([
      thread.author.id,
      ...thread.turns.map((turn) => turn.author.id),
    ]))
    const lifecycle = thread.lifecycle
      ?? (this.deps.threadInteractionResolver ?? new ThreadInteractionResolver()).resolveLifecycleSnapshot(
        this.deps.threadLifecycleService.buildThreadLifecycle(thread, thread.turns.length),
      )
    const salientTurnIds = chooseSalientTurnIds(marks, thread.turns)
    const evidenceRefs = dedupeEvidenceRefs([
      { kind: 'THREAD', id: thread.id } satisfies EvidenceRef,
      ...salientTurnIds.map((id) => ({ kind: 'TURN', id }) satisfies EvidenceRef),
      ...(audienceSignals?.evidence_refs ?? []),
    ])
    const publicCues = buildProjectionCues([
      {
        author: thread.author,
        evidence_refs: [{ kind: 'THREAD', id: thread.id }],
        relation_signal: buildPublicRelationSignal(thread),
      },
      ...thread.turns.slice(-2).map((turn) => ({
        author: turn.author,
        evidence_refs: [{ kind: 'TURN', id: turn.id }] satisfies EvidenceRef[],
        relation_signal: null,
      })),
    ])

    const guideScore = (thread.participant_count * 2)
      + thread.turn_count
      + badgeIds.length
      + (thread.active_route ? 2 : 0)
      + (audienceSignals?.message_count ?? 0) * 0.25

    return {
      schema_version: THREAD_CAPSULE_SCHEMA_VERSION,
      thread_id: thread.id,
      post_id: thread.post_id,
      community_id: thread.community_id,
      author_id: thread.author.id,
      participant_ids: participantIds,
      participant_count: thread.participant_count,
      turn_count: thread.turn_count,
      latest_turn_id: thread.turns.at(-1)?.id ?? null,
      latest_activity_at: toIsoString(thread.last_activity_at),
      lifecycle,
      route_handoff: lifecycle.active_route,
      role: deriveThreadRole({ badgeIds, lifecycleState: lifecycle.thread_state, audienceSignals }),
      summary: buildThreadSummary(thread),
      unresolved_points: buildUnresolvedPoints(thread),
      resolved_points: lifecycle.thread_state === 'CLOSED' || lifecycle.thread_state === 'HANDOFFED'
        ? [truncateText(thread.turns.at(-1)?.body ?? thread.body, 120)]
        : [],
      salient_turn_ids: salientTurnIds,
      reason_badges: badgeIds,
      semantic_marks: marks,
      audience_signals: audienceSignals,
      guide_score: guideScore,
      evidence_refs: evidenceRefs,
      public_persona_cues: publicCues.persona,
      public_growth_cues: publicCues.growth,
      updated_at: toIsoString(thread.last_activity_at),
    }
  }

  buildPostSemanticCapsule(
    post: PostWithMeta,
    threads: PublicStageThreadWithAuthor[],
    audienceSignals: AudienceSignalCapsule | null = null,
  ): PostSemanticCapsule {
    const threadCapsules = threads.map((thread) => this.buildThreadCapsule(thread, audienceSignals))
      .sort((a, b) => b.guide_score - a.guide_score || a.thread_id.localeCompare(b.thread_id))
    const participantIds = Array.from(new Set([
      post.author.id,
      ...threadCapsules.flatMap((item) => item.participant_ids),
    ]))
    const latestActivityAt = [
      toIsoString(post.created_at),
      ...threadCapsules.map((item) => item.latest_activity_at),
    ].sort().at(-1) ?? toIsoString(post.created_at)
    const flowPhase = derivePostFlowPhase(threadCapsules)
    const mustReadTurnIds = dedupeStrings(threadCapsules.flatMap((item) => item.salient_turn_ids).slice(0, 4))
    const startThreadIds = threadCapsules.slice(0, 2).map((item) => item.thread_id)
    const openQuestions = dedupeStrings(threadCapsules.flatMap((item) => item.unresolved_points)).slice(0, 4)
    const evidenceRefs = dedupeEvidenceRefs([
      ...threadCapsules.slice(0, 3).map((item) => ({ kind: 'THREAD', id: item.thread_id }) satisfies EvidenceRef),
      ...mustReadTurnIds.map((id) => ({ kind: 'TURN', id }) satisfies EvidenceRef),
      ...(audienceSignals?.evidence_refs ?? []),
    ])
    const publicCues = buildProjectionCues([
      {
        author: post.author,
        evidence_refs: threadCapsules[0]
          ? [{ kind: 'THREAD', id: threadCapsules[0].thread_id }]
          : [],
        relation_signal: null,
      },
      ...threadCapsules.slice(0, 2).map((threadCapsule) => {
        const sourceThread = threads.find((thread) => thread.id === threadCapsule.thread_id) ?? null
        return {
          author: sourceThread?.author ?? post.author,
          evidence_refs: [{ kind: 'THREAD', id: threadCapsule.thread_id }] satisfies EvidenceRef[],
          relation_signal: sourceThread ? buildPublicRelationSignal(sourceThread) : null,
        }
      }),
    ])

    return {
      schema_version: POST_SEMANTIC_CAPSULE_SCHEMA_VERSION,
      post_id: post.id,
      community_id: post.community_id,
      thread_count: threadCapsules.length,
      highlighted_thread_ids: threadCapsules.slice(0, 3).map((item) => item.thread_id),
      participant_ids: participantIds,
      participant_count: participantIds.length,
      latest_activity_at: latestActivityAt,
      audience_signals: audienceSignals,
      thread_capsules: threadCapsules,
      flow_phase: flowPhase,
      premise: truncateText(`${post.title} ${post.body}`, 160),
      current_tension: describePostTension(flowPhase, threadCapsules),
      resolved_points: dedupeStrings(threadCapsules.flatMap((item) => item.resolved_points)).slice(0, 3),
      open_questions: openQuestions,
      must_read_turn_ids: mustReadTurnIds,
      start_thread_ids: startThreadIds,
      thread_capsule_ids: threadCapsules.map((item) => item.thread_id),
      audience_capsule_id: audienceSignals ? `audience:${post.id}` : null,
      evidence_refs: evidenceRefs,
      public_persona_cues: publicCues.persona,
      public_growth_cues: publicCues.growth,
      updated_at: latestActivityAt,
    }
  }

  buildReadingGuide(post: PostWithMeta, postCapsule: PostSemanticCapsule): ReadingGuideProjection {
    const entries = postCapsule.thread_capsules
      .slice(0, 3)
      .map((threadCapsule) => {
        const focusMark = chooseGuideMark(threadCapsule.semantic_marks)
        const focusTurnId = focusMark?.turn_id ?? threadCapsule.latest_turn_id
        const evidenceRefs = dedupeEvidenceRefs([
          { kind: 'THREAD', id: threadCapsule.thread_id },
          ...(focusTurnId ? [{ kind: 'TURN', id: focusTurnId } satisfies EvidenceRef] : []),
        ])
        return {
          id: `guide:${threadCapsule.thread_id}`,
          thread_id: threadCapsule.thread_id,
          focus_turn_id: focusTurnId,
          title: describeGuideTitle(threadCapsule),
          teaser: describeGuideTeaser(post.body, threadCapsule),
          reason_badges: threadCapsule.reason_badges,
          participant_count: threadCapsule.participant_count,
          turn_count: threadCapsule.turn_count,
          latest_activity_at: threadCapsule.latest_activity_at,
          evidence_refs: evidenceRefs,
        }
      })

    return {
      schema_version: READING_GUIDE_SCHEMA_VERSION,
      post_id: post.id,
      entries,
      highlighted_thread_ids: entries.map((item) => item.thread_id),
      summary_line: describeReadingGuideSummary(postCapsule),
      start_here_thread_ids: entries.slice(0, 2).map((item) => item.thread_id),
      current_focus_thread_ids: entries.map((item) => item.thread_id),
      must_read_turn_ids: entries
        .map((item) => item.focus_turn_id)
        .filter((item): item is string => Boolean(item)),
      evidence_refs: dedupeEvidenceRefs(entries.flatMap((item) => item.evidence_refs)),
      generated_at: new Date().toISOString(),
    }
  }

  private buildTurnMarks(thread: PublicStageThreadWithAuthor): TurnSemanticMark[] {
    const seenAuthors = new Set<string>([thread.author.id])
    const turnById = new Map<string, PublicStageTurnWithAuthor>(thread.turns.map((turn) => [turn.id, turn]))
    return thread.turns.map((turn, index) => {
      const actualAnchorTurnId = turn.anchor_turn_id ?? null
      const anchorTurn = actualAnchorTurnId ? turnById.get(actualAnchorTurnId) ?? null : null
      const previousTurn = index > 0 ? thread.turns[index - 1] ?? null : null
      const previousParticipant = seenAuthors.has(turn.author.id)
      const joinedLate = index > 0 && !previousParticipant
      const returnedToBranch = Boolean(anchorTurn && previousTurn && anchorTurn.id !== previousTurn.id)
      const mentioned = hasMention(turn.body, [
        thread.author.display_name,
        ...thread.turns.map((item) => item.author.display_name),
      ])
      const topicMatch = Boolean(turn.quoted_excerpt || turn.anchor_intent || actualAnchorTurnId)
      const audiencePushed = thread.active_route?.route_type === 'AUDIENCE'
      const badgeIds = collectBadgeIds({
        joinedLate,
        mentioned,
        topicMatch,
        returnedToBranch,
        audiencePushed,
        previousParticipant,
      })
      seenAuthors.add(turn.author.id)

      return {
        schema_version: TURN_SEMANTIC_MARK_SCHEMA_VERSION,
        turn_id: turn.id,
        thread_id: thread.id,
        post_id: turn.post_id,
        actual_anchor_turn_id: actualAnchorTurnId,
        anchor_source: anchorTurn
          ? 'VISIBLE_TURN'
          : turn.quoted_excerpt
            ? 'STORED_QUOTE'
            : 'NONE',
        quoted_excerpt: turn.quoted_excerpt ?? null,
        badge_ids: badgeIds,
        joined_late: joinedLate,
        mentioned,
        topic_match: topicMatch,
        returned_to_branch: returnedToBranch,
        audience_pushed: audiencePushed,
        previous_participant: previousParticipant,
        act: inferTurnAct(turn.body, {
          actualAnchorTurnId,
          hasQuestion: turn.body.includes('?') || turn.body.includes('？'),
          returnedToBranch,
        }),
        topical_tags: extractTopicalTags(turn.body),
        tension_delta: inferTensionDelta(turn.body, badgeIds),
        references: dedupeEvidenceRefs([
          { kind: 'TURN', id: turn.id },
          ...(anchorTurn ? [{ kind: 'TURN', id: anchorTurn.id } satisfies EvidenceRef] : []),
        ]),
        updated_at: toIsoString(turn.updated_at),
      }
    })
  }
}

function collectBadgeIds(input: {
  joinedLate: boolean
  mentioned: boolean
  topicMatch: boolean
  returnedToBranch: boolean
  audiencePushed: boolean
  previousParticipant: boolean
}): TurnReasonBadgeId[] {
  const badgeIds: TurnReasonBadgeId[] = []
  if (input.joinedLate) badgeIds.push('JOINED_LATE')
  if (input.mentioned) badgeIds.push('MENTIONED')
  if (input.topicMatch) badgeIds.push('TOPIC_MATCH')
  if (input.returnedToBranch) badgeIds.push('RETURNED_TO_BRANCH')
  if (input.audiencePushed) badgeIds.push('AUDIENCE_PUSHED')
  if (input.previousParticipant) badgeIds.push('PREVIOUS_PARTICIPANT')
  return badgeIds
}

function buildAudienceTopSignals(input: {
  messageCount: number
  highlightedMessageCount: number
  summaryAvailable: boolean
}): string[] {
  const signals: string[] = []
  if (input.messageCount > 0) signals.push('audience_active')
  if (input.highlightedMessageCount > 0) signals.push('highlighted_feedback')
  if (input.summaryAvailable) signals.push('aftershow_summary_ready')
  return signals
}

function buildThreadSummary(thread: PublicStageThreadWithAuthor): string {
  const latestTurn = thread.turns.at(-1)
  const summarySource = latestTurn
    ? `${thread.body} ${latestTurn.body}`
    : thread.body
  return truncateText(summarySource, 160)
}

function buildUnresolvedPoints(thread: PublicStageThreadWithAuthor): string[] {
  const source = [thread.body, ...thread.turns.map((turn) => turn.body)]
  return dedupeStrings(
    source
      .filter((item) => item.includes('?') || item.includes('？'))
      .map((item) => truncateText(item, 120)),
  ).slice(0, 3)
}

function deriveThreadRole(input: {
  badgeIds: TurnReasonBadgeId[]
  lifecycleState: ThreadCapsule['lifecycle']['thread_state']
  audienceSignals: AudienceSignalCapsule | null
}): ThreadRole | null {
  if (input.audienceSignals?.message_count) return 'AUDIENCE_BRIDGE'
  if (input.lifecycleState === 'SPINOFFED') return 'SPINOFF_CANDIDATE'
  if (input.badgeIds.includes('RETURNED_TO_BRANCH')) return 'COUNTERPOINT'
  if (input.badgeIds.includes('JOINED_LATE')) return 'CONTEXT'
  return 'MAINLINE'
}

function derivePostFlowPhase(threadCapsules: ThreadCapsule[]): PostFlowPhase {
  if (threadCapsules.some((item) => item.lifecycle.thread_state === 'HANDOFFED')) {
    return 'AFTERSHOW'
  }
  if (threadCapsules.some((item) => item.reason_badges.includes('RETURNED_TO_BRANCH'))) {
    return 'PIVOT'
  }
  if (threadCapsules.some((item) => item.lifecycle.thread_state === 'PEAKED' || item.lifecycle.thread_state === 'HEATING')) {
    return 'ESCALATION'
  }
  if (threadCapsules.some((item) => item.lifecycle.thread_state === 'WINDING_DOWN' || item.lifecycle.thread_state === 'CLOSED')) {
    return 'CLOSURE'
  }
  return 'OPENING'
}

function describePostTension(flowPhase: PostFlowPhase, threadCapsules: ThreadCapsule[]): string {
  if (flowPhase === 'AFTERSHOW') return '公开主线正在收口，后续关注正在转向余波与转场。'
  if (flowPhase === 'PIVOT') return '讨论重点正在变化，几条公开支线值得并排回看。'
  if (flowPhase === 'ESCALATION') return '多个分支同时升温，主线张力正在上扬。'
  if (flowPhase === 'CLOSURE') return '讨论开始收束，重点转向收口与余味。'
  return threadCapsules.length > 0
    ? '公开讨论刚刚起势，先看分支如何展开。'
    : '帖子刚刚开启，主舞台还在起步。'
}

function chooseSalientTurnIds(
  marks: TurnSemanticMark[],
  turns: PublicStageThreadWithAuthor['turns'],
): string[] {
  const explicit = marks
    .filter((mark) => mark.returned_to_branch || mark.joined_late || mark.mentioned)
    .map((mark) => mark.turn_id)
  const latest = turns.slice(-2).map((turn) => turn.id)
  return dedupeStrings([...explicit, ...latest]).slice(0, 4)
}

function chooseGuideMark(marks: TurnSemanticMark[]): TurnSemanticMark | null {
  return marks.find((item) => item.returned_to_branch)
    ?? marks.find((item) => item.joined_late)
    ?? marks.find((item) => item.mentioned)
    ?? marks.at(-1)
    ?? null
}

function describeGuideTitle(threadCapsule: ThreadCapsule): string {
  if (threadCapsule.reason_badges.includes('MENTIONED')) {
    return '值得补看的回应'
  }
  if (threadCapsule.route_handoff?.route_type === 'AFTERSHOW') {
    return '接近收束的一条支线'
  }
  if (threadCapsule.participant_count >= 3) {
    return '参与者较多的一条支线'
  }
  if (threadCapsule.turn_count >= 3) {
    return '正在延展的一条支线'
  }
  return '从这里开始看'
}

function describeGuideTeaser(postBody: string, threadCapsule: ThreadCapsule): string {
  const source = threadCapsule.semantic_marks.find((item) => item.quoted_excerpt)?.quoted_excerpt
    ?? threadCapsule.summary
    ?? postBody
  return truncateText(source, 96)
}

function describeReadingGuideSummary(postCapsule: PostSemanticCapsule): string {
  if (!postCapsule.thread_capsules[0]) {
    return '主舞台刚起步，还没有形成明确的观看入口。'
  }
  return `${postCapsule.current_tension} 先看这几条公开支线。`
}

function inferTurnAct(
  body: string,
  input: {
    actualAnchorTurnId: string | null
    hasQuestion: boolean
    returnedToBranch: boolean
  },
): TurnAct | null {
  if (/总结|归纳|总之/u.test(body)) return 'SUMMARIZE'
  if (/比如|例如|举个例子/u.test(body)) return 'EXAMPLE'
  if (/哈哈|笑死|好玩/u.test(body)) return 'JOKE'
  if (input.returnedToBranch) return 'PIVOT'
  if (input.hasQuestion) return input.actualAnchorTurnId ? 'CLARIFY' : 'PROPOSE'
  if (input.actualAnchorTurnId) return 'COUNTER'
  return 'PROPOSE'
}

function inferTensionDelta(body: string, badgeIds: TurnReasonBadgeId[]): TurnSemanticMark['tension_delta'] {
  if (badgeIds.includes('AUDIENCE_PUSHED') || /不是|但|可是|然而/u.test(body)) return 'UP'
  if (/理解|同意|收口/u.test(body)) return 'DOWN'
  return 'NEUTRAL'
}

function extractTopicalTags(body: string): string[] {
  const normalized = body
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
  return [...new Set(normalized)].slice(0, 4)
}

function hasMention(body: string, names: string[]): boolean {
  const normalizedBody = body.toLowerCase()
  return names.some((name) => {
    const normalized = name.trim().toLowerCase()
    return normalized.length > 1 && normalizedBody.includes(`@${normalized}`)
  })
}

function buildProjectionCues(inputs: Array<{
  author: AuthorSummary
  evidence_refs: EvidenceRef[]
  relation_signal?: {
    label: string
    detail: string | null
  } | null
}>): {
  persona: PublicProjectionCue[]
  growth: PublicProjectionCue[]
} {
  const persona: PublicProjectionCue[] = []
  const growth: PublicProjectionCue[] = []
  const seen = new Set<string>()
  const now = new Date().toISOString()

  for (const input of inputs) {
    const author = input.author
    if (author.public_identity?.identity_role_id) {
      const cue = buildProjectionCue({
        cue_id: `persona:identity:${author.id}:${author.public_identity.identity_role_id}`,
        source_kind: 'PUBLIC_IDENTITY',
        label: author.public_identity.identity_role_id,
        detail: author.public_identity.home_community
          ? `公开身份来自 ${author.public_identity.home_community}。`
          : null,
        evidence_refs: input.evidence_refs,
        updated_at: now,
      })
      if (!seen.has(cue.cue_id)) {
        seen.add(cue.cue_id)
        persona.push(cue)
      }
    }

    if (author.public_projection?.tagline) {
      const cue = buildProjectionCue({
        cue_id: `persona:projection:${author.id}:tagline`,
        source_kind: 'PUBLIC_PROJECTION',
        label: truncateText(author.public_projection.tagline, 24),
        detail: truncateText(author.public_projection.tagline, 96),
        evidence_refs: input.evidence_refs,
        updated_at: now,
      })
      if (!seen.has(cue.cue_id)) {
        seen.add(cue.cue_id)
        persona.push(cue)
      }
    }

    if (author.public_projection?.public_projection_hint) {
      const cue = buildProjectionCue({
        cue_id: `persona:projection:${author.id}:hint`,
        source_kind: 'PUBLIC_PROJECTION',
        label: truncateText(author.public_projection.public_projection_hint, 24),
        detail: truncateText(author.public_projection.public_projection_hint, 96),
        evidence_refs: input.evidence_refs,
        updated_at: now,
      })
      if (!seen.has(cue.cue_id)) {
        seen.add(cue.cue_id)
        persona.push(cue)
      }
    }

    const publicBio = author.public_projection?.public_bio ?? null
    if (publicBio) {
      const cue = buildProjectionCue({
        cue_id: `persona:bio:${author.id}`,
        source_kind: 'PUBLIC_BIO',
        label: truncateText(publicBio, 24),
        detail: truncateText(publicBio, 96),
        evidence_refs: input.evidence_refs,
        updated_at: now,
      })
      if (!seen.has(cue.cue_id)) {
        seen.add(cue.cue_id)
        persona.push(cue)
      }
    }

    if (input.relation_signal) {
      const cue = buildProjectionCue({
        cue_id: `persona:relation:${author.id}:${input.relation_signal.label}`,
        source_kind: 'PUBLIC_RELATION_TEASER',
        label: input.relation_signal.label,
        detail: input.relation_signal.detail,
        evidence_refs: input.evidence_refs,
        updated_at: now,
      })
      if (!seen.has(cue.cue_id)) {
        seen.add(cue.cue_id)
        persona.push(cue)
      }
    }

    for (const badge of author.public_proof?.achievement_badges ?? []) {
      const cue = buildProjectionCue({
        cue_id: `growth:proof:${author.id}:${badge.code}`,
        source_kind: 'PUBLIC_PROOF',
        label: badge.name,
        detail: `公开成就等级 ${badge.level}。`,
        evidence_refs: input.evidence_refs,
        updated_at: now,
      })
      if (!seen.has(cue.cue_id)) {
        seen.add(cue.cue_id)
        growth.push(cue)
      }
    }

    const topBadge = author.public_proof?.achievement_badges[0]
    if (topBadge) {
      const cue = buildProjectionCue({
        cue_id: `growth:achievement:${author.id}:${topBadge.code}`,
        source_kind: 'PUBLIC_ACHIEVEMENT_HIGHLIGHT',
        label: topBadge.name,
        detail: topBadge.level >= 2
          ? `公开成就 ${topBadge.name} 已在舞台上形成辨识度。`
          : `公开成就 ${topBadge.name} 正在积累公共印象。`,
        evidence_refs: input.evidence_refs,
        updated_at: now,
      })
      if (!seen.has(cue.cue_id)) {
        seen.add(cue.cue_id)
        growth.push(cue)
      }
    }
  }

  return {
    persona: persona.slice(0, 5),
    growth: growth.slice(0, 5),
  }
}

function buildPublicRelationSignal(thread: PublicStageThreadWithAuthor): {
  label: string
  detail: string | null
} | null {
  const recentCallout = thread.turns
    .slice(-3)
    .some((turn) => hasMention(turn.body, [thread.author.display_name]))
  if (recentCallout) {
    return {
      label: '公开点名仍在继续',
      detail: '最近的公开回应还在把话头递回给这位作者。',
    }
  }
  if (thread.turns.length >= 2 && thread.turns.some((turn) => turn.anchor_turn_id === null)) {
    const returnedToRoot = thread.turns.some((turn) => turn.anchor_turn_id === thread.turns[0]?.id)
    if (returnedToRoot) {
      return {
        label: '这条话头仍被接续',
        detail: '公开支线还在继续顺着这位作者抛出的线索推进。',
      }
    }
  }
  return null
}

function buildProjectionCue(input: {
  cue_id: string
  source_kind: PublicProjectionCue['source_kind']
  label: string
  detail: string | null
  evidence_refs: EvidenceRef[]
  updated_at: string
}): PublicProjectionCue {
  return {
    schema_version: PUBLIC_PROJECTION_CUE_SCHEMA_VERSION,
    cue_id: input.cue_id,
    source_kind: input.source_kind,
    label: input.label,
    detail: input.detail,
    evidence_refs: dedupeEvidenceRefs(input.evidence_refs),
    updated_at: input.updated_at,
  }
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function dedupeEvidenceRefs(values: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>()
  const refs: EvidenceRef[] = []
  for (const value of values) {
    const key = `${value.kind}:${value.id}`
    if (seen.has(key)) continue
    seen.add(key)
    refs.push(value)
  }
  return refs
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value
}
