import { resolveAgentIdentity, type OwnerStylePins } from '../identity/agent-identity.js'
import type { AgentService } from '../services/agent-service.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type {
  ContextRawEvent,
  ContextRelationChannel,
  UpsertContextActiveTensionItemInput,
  UpsertContextEpisodicCardInput,
  UpsertContextPrivateShadowMemoryInput,
  UpsertContextRelationStateInput,
  UpsertContextSelfModelStateInput,
} from '../repos/types.js'
import type { RawContextEventRepository } from '../repos/context-memory-repository.js'
import type {
  ContextJournalService,
  IdentityFinalizer,
  IdentityFinalizeResult,
  RawContextEvent,
  SummaryDistillResult,
  SummaryExtractResult,
  SummaryOrchestrator,
} from './contracts.js'
import { personaObservability } from '../runtime/persona-observability.js'

const IDENTITY_MOODS = new Set<NonNullable<OwnerStylePins['mood']>>(['optimistic', 'neutral', 'critical', 'random'])
const IDENTITY_HABITS = new Set<NonNullable<OwnerStylePins['habits']>[number]>([
  'asks_questions',
  'uses_analogies',
  'tells_stories',
  'summarizes',
])

export class DefaultContextJournalService implements ContextJournalService {
  constructor(private readonly rawEventRepo: RawContextEventRepository) {}

  async record(event: RawContextEvent): Promise<RawContextEvent> {
    return this.rawEventRepo.upsert({
      id: event.id,
      agent_id: event.agent_id,
      scene: event.scene,
      source_type: event.source_type,
      source_ref_id: event.source_ref_id,
      counterpart_id: event.counterpart_id,
      transcript: event.transcript,
      evidence_refs: event.evidence_refs,
      created_at: event.created_at,
    })
  }
}

export class LlmSummaryOrchestrator implements SummaryOrchestrator {
  constructor(private readonly deps: { llmGateway: LLMGateway }) {}

  async extract(event: RawContextEvent): Promise<SummaryExtractResult> {
    const response = await this.deps.llmGateway.generateHiddenArtifact({
      intent: resolveHiddenIntent(event),
      scene: 'background_hidden',
      agentId: event.agent_id,
      homeVoiceLineId: 'deepseek-director-v1',
      promptRef: resolveExtractPromptRef(event),
      variables: {
        transcript: event.transcript,
        scene: event.scene,
        counterpart_kind: resolveCounterpartKind(event),
      },
      budgetClass: 'hidden_background',
      traceId: `context-extract:${event.id}`,
      requestedTier: 'premium',
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
      temperature: 0.2,
    })

    const parsed = parseJsonRecord(response.content)
    return {
      summaryText: stringField(parsed.summary_text, ''),
      topicTags: stringArrayField(parsed.topic_tags),
      keyFacts: stringArrayField(parsed.key_facts),
      sentiment: stringField(parsed.sentiment, 'neutral'),
      importanceScore: numberField(parsed.importance_score, 0.5),
      ownerSignals: stringArrayField(parsed.owner_signals),
      notableMoments: stringArrayField(parsed.notable_moments),
      candidateTensions: stringArrayField(parsed.candidate_tensions),
      publicSafeShadowHint: stringField(parsed.public_safe_shadow_hint, ''),
    }
  }

  async distill(event: RawContextEvent, extracted: SummaryExtractResult): Promise<SummaryDistillResult> {
    const response = await this.deps.llmGateway.generateHiddenArtifact({
      intent: resolveHiddenIntent(event),
      scene: 'background_hidden',
      agentId: event.agent_id,
      homeVoiceLineId: 'deepseek-director-v1',
      promptRef: resolveDistillPromptRef(event),
      variables: {
        extracted_json: JSON.stringify(extracted, null, 2),
        transcript: event.transcript,
        scene: event.scene,
        counterpart_kind: resolveCounterpartKind(event),
      },
      budgetClass: 'hidden_background',
      traceId: `context-distill:${event.id}`,
      requestedTier: 'premium',
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
      temperature: 0.2,
    })

    const parsed = parseJsonRecord(response.content)
    const episodicCards = episodicCardsFromDistill(event, arrayField(parsed.episodic_cards))
    const relationState = relationStateFromDistill(event, parsed.relation_state)
    const selfModel = selfModelFromDistill(event, parsed.self_model)
    const tensions = tensionsFromDistill(event, arrayField(parsed.tensions))
    const privateShadow = privateShadowFromDistill(event, parsed.private_shadow, extracted.publicSafeShadowHint)
    const compatibilityDigest = compatibilityDigestFromDistill(parsed.compatibility_digest, extracted)

    return {
      origin: {
        eventId: event.id,
        scene: event.scene,
        sourceType: event.source_type,
      },
      episodicCards,
      relationState,
      selfModel,
      tensions,
      privateShadow,
      compatibilityDigest,
    }
  }
}

export class LlmIdentityFinalizer implements IdentityFinalizer {
  constructor(private readonly deps: {
    llmGateway: LLMGateway
    agentService: AgentService
  }) {}

  async finalize(agentId: string, input: SummaryDistillResult): Promise<IdentityFinalizeResult> {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      const resolved = resolveAgentIdentity(agent, latestConfig)

      const response = await this.deps.llmGateway.generateIdentityWrite({
        intent: 'identity_write',
        scene: 'background_hidden',
        agentId,
        homeVoiceLineId: resolved.summary.home_voice_line_id,
        promptRef: resolveIdentityFinalizePromptRef(input.origin.sourceType),
        variables: {
          current_identity_json: JSON.stringify({
            owner_style_pins: resolved.contract.ownerStylePins,
            visible_persona: resolved.visiblePersona,
          }, null, 2),
          distill_json: JSON.stringify(input, null, 2),
          scene: input.origin.scene,
          counterpart_kind: resolveCounterpartKindFromSourceType(input.origin.sourceType),
        },
        budgetClass: 'identity_write',
        traceId: `identity-finalize:${agentId}:${input.origin.eventId}`,
        requestedTier: 'premium',
        allowFallbackWithinLine: false,
        allowCrossFamily: false,
        temperature: 0.2,
      })

      const parsed = parseJsonRecord(response.content)
      const stylePatch = ownerStylePinsPatch(parsed.owner_style_pins_patch)
      if (Object.keys(stylePatch).length > 0) {
        await this.deps.agentService.updateConfig(agentId, { ownerStylePins: stylePatch }, agent.owner_id)
      }

      personaObservability.recordIdentityWrite(true)
      return {
        relationState: relationStateFromFinalize(parsed.relation_state, input.relationState),
        selfModel: selfModelFromFinalize(parsed.self_model, input.selfModel),
        tensions: tensionsFromFinalize(parsed.tensions, input.tensions, agentId),
        privateShadow: privateShadowFromFinalize(parsed.private_shadow, input.privateShadow),
        ownerStylePinsPatch: stylePatch,
      }
    } catch (error) {
      personaObservability.recordIdentityWrite(false)
      throw error
    }
  }
}

export function buildPrivateSessionRawEvent(input: {
  eventId: string
  agentId: string
  sessionId: string
  ownerId: string
  transcript: string
  createdAt?: Date
}): ContextRawEvent {
  return {
    id: input.eventId,
    agent_id: input.agentId,
    scene: 'private_chat',
    source_type: 'private_session',
    source_ref_id: input.sessionId,
    counterpart_id: input.ownerId,
    transcript: input.transcript,
    evidence_refs: [`private_session:${input.sessionId}`],
    created_at: input.createdAt ?? new Date(),
  }
}

export function buildPrivateSessionRawEventId(sessionId: string): string {
  return `ctxevent:private-session:${sessionId}`
}

export function buildForumThreadRawEvent(input: {
  eventId: string
  agentId: string
  postId: string
  communityId: string | null
  transcript: string
  evidenceRefs?: string[]
  createdAt?: Date
}): ContextRawEvent {
  return {
    id: input.eventId,
    agent_id: input.agentId,
    scene: 'forum',
    source_type: 'forum_thread',
    source_ref_id: input.postId,
    counterpart_id: input.communityId,
    transcript: input.transcript,
    evidence_refs: dedupeStrings([
      `post:${input.postId}`,
      ...(input.communityId ? [`community:${input.communityId}`] : []),
      ...(input.evidenceRefs ?? []),
    ]),
    created_at: input.createdAt ?? new Date(),
  }
}

export function buildForumThreadRawEventId(sourceEventId: string): string {
  return `ctxevent:forum:${sourceEventId}`
}

export function buildChatRoomWindowRawEvent(input: {
  eventId: string
  agentId: string
  roomId: string
  transcript: string
  evidenceRefs?: string[]
  createdAt?: Date
}): ContextRawEvent {
  return {
    id: input.eventId,
    agent_id: input.agentId,
    scene: 'chat_room',
    source_type: 'chat_room_window',
    source_ref_id: input.roomId,
    counterpart_id: input.roomId,
    transcript: input.transcript,
    evidence_refs: dedupeStrings([
      `room:${input.roomId}`,
      ...(input.evidenceRefs ?? []),
    ]),
    created_at: input.createdAt ?? new Date(),
  }
}

export function buildChatRoomWindowRawEventId(sourceEventId: string): string {
  return `ctxevent:chat-room:${sourceEventId}`
}

function resolveHiddenIntent(event: RawContextEvent): 'private_digest' | 'public_observation_digest' {
  return event.source_type === 'private_session' ? 'private_digest' : 'public_observation_digest'
}

function resolveExtractPromptRef(event: RawContextEvent): typeof PROMPT_TEMPLATE_REFS[keyof typeof PROMPT_TEMPLATE_REFS] {
  return event.source_type === 'private_session'
    ? PROMPT_TEMPLATE_REFS.internalPrivateChatSummaryExtract
    : PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryExtract
}

function resolveDistillPromptRef(event: RawContextEvent): typeof PROMPT_TEMPLATE_REFS[keyof typeof PROMPT_TEMPLATE_REFS] {
  return event.source_type === 'private_session'
    ? PROMPT_TEMPLATE_REFS.internalPrivateChatSummaryDistill
    : PROMPT_TEMPLATE_REFS.internalPublicObservationSummaryDistill
}

function resolveIdentityFinalizePromptRef(sourceType: RawContextEvent['source_type']): typeof PROMPT_TEMPLATE_REFS[keyof typeof PROMPT_TEMPLATE_REFS] {
  return sourceType === 'private_session'
    ? PROMPT_TEMPLATE_REFS.internalPrivateChatIdentityFinalize
    : PROMPT_TEMPLATE_REFS.internalPublicObservationIdentityFinalize
}

function resolveCounterpartKind(event: RawContextEvent): 'owner' | 'community' | 'room' | 'none' {
  return resolveCounterpartKindFromSourceType(event.source_type)
}

function resolveCounterpartKindFromSourceType(sourceType: RawContextEvent['source_type']): 'owner' | 'community' | 'room' | 'none' {
  if (sourceType === 'private_session') return 'owner'
  if (sourceType === 'forum_thread') return 'community'
  if (sourceType === 'chat_room_window') return 'room'
  return 'none'
}

function episodicCardsFromDistill(event: RawContextEvent, items: unknown[]): UpsertContextEpisodicCardInput[] {
  const cards: UpsertContextEpisodicCardInput[] = []
  for (const [index, item] of items.entries()) {
    const record = toRecord(item)
    if (!record) continue
    const title = stringField(record.title, '').trim()
    const summary = stringField(record.summary, '').trim()
    if (!title || !summary) continue
    cards.push({
      id: `ctxepisode:${event.id}:${index + 1}`,
      agent_id: event.agent_id,
      event_id: event.id,
      scene: event.scene,
      title,
      summary,
      topic_tags: stringArrayField(record.topic_tags),
      evidence_refs: dedupeStrings([event.id, ...event.evidence_refs, ...stringArrayField(record.evidence_refs)]),
      salience: numberField(record.salience, 0.5),
    })
  }
  return cards
}

function relationStateFromDistill(
  event: RawContextEvent,
  value: unknown,
): UpsertContextRelationStateInput | null {
  const record = toRecord(value)
  const binding = resolveRelationBinding(event)
  if (!record || !binding) return null
  const stance = stringField(record.stance, '').trim()
  if (!stance) return null
  return {
    id: `ctxrel:${event.agent_id}:${binding.channel}:${binding.counterpartId}`,
    agent_id: event.agent_id,
    counterpart_id: binding.counterpartId,
    channel: binding.channel,
    stance,
    confidence: numberField(record.confidence, 0.5),
    evidence_refs: dedupeStrings([event.id, ...event.evidence_refs, ...stringArrayField(record.evidence_refs)]),
  }
}

function selfModelFromDistill(
  event: RawContextEvent,
  value: unknown,
): UpsertContextSelfModelStateInput | null {
  const record = toRecord(value)
  if (!record) return null
  const summary = stringField(record.summary, '').trim()
  if (!summary) return null
  return {
    id: `ctxself:${event.agent_id}`,
    agent_id: event.agent_id,
    summary,
    tensions: stringArrayField(record.tensions),
    evidence_refs: dedupeStrings([event.id, ...event.evidence_refs, ...stringArrayField(record.evidence_refs)]),
  }
}

function tensionsFromDistill(
  event: RawContextEvent,
  items: unknown[],
): UpsertContextActiveTensionItemInput[] {
  const tensions: UpsertContextActiveTensionItemInput[] = []
  for (const item of items) {
    const record = toRecord(item)
    if (!record) continue
    const label = stringField(record.label, '').trim()
    const description = stringField(record.description, '').trim()
    if (!label || !description) continue
    tensions.push({
      id: `ctxtension:${event.agent_id}:${slug(label)}`,
      agent_id: event.agent_id,
      label,
      description,
      intensity: numberField(record.intensity, 0.5),
      evidence_refs: dedupeStrings([event.id, ...event.evidence_refs, ...stringArrayField(record.evidence_refs)]),
    })
  }
  return tensions
}

function privateShadowFromDistill(
  event: RawContextEvent,
  value: unknown,
  fallbackHint: string,
): UpsertContextPrivateShadowMemoryInput | null {
  const record = toRecord(value)
  if (!record) return null
  const summary = stringField(record.summary, '').trim()
  const publicSafeShadow = stringField(record.public_safe_shadow, fallbackHint).trim()
  if (!summary || !publicSafeShadow) return null
  return {
    id: `ctxshadow:${event.id}`,
    agent_id: event.agent_id,
    event_id: event.id,
    summary,
    public_safe_shadow: publicSafeShadow,
    evidence_refs: dedupeStrings([event.id, ...event.evidence_refs, ...stringArrayField(record.evidence_refs)]),
  }
}

function compatibilityDigestFromDistill(
  value: unknown,
  extracted: SummaryExtractResult,
): SummaryDistillResult['compatibilityDigest'] {
  const record = toRecord(value)
  return {
    summary_text: stringField(record?.summary_text, extracted.summaryText),
    topic_tags: stringArrayField(record?.topic_tags, extracted.topicTags),
    key_facts: stringArrayField(record?.key_facts, extracted.keyFacts),
    sentiment: stringField(record?.sentiment, extracted.sentiment),
    importance_score: numberField(record?.importance_score, extracted.importanceScore),
  }
}

function resolveRelationBinding(
  event: RawContextEvent,
): { counterpartId: string; channel: ContextRelationChannel } | null {
  if (!event.counterpart_id) return null
  if (event.source_type === 'private_session') {
    return { counterpartId: event.counterpart_id, channel: 'owner' }
  }
  if (event.source_type === 'forum_thread') {
    return { counterpartId: event.counterpart_id, channel: 'community' }
  }
  if (event.source_type === 'chat_room_window') {
    return { counterpartId: event.counterpart_id, channel: 'room' }
  }
  return null
}

function relationStateFromFinalize(
  value: unknown,
  fallback: SummaryDistillResult['relationState'],
): SummaryDistillResult['relationState'] {
  const record = toRecord(value)
  if (!fallback || !record) return fallback
  const stance = stringField(record.stance, fallback.stance)
  return {
    ...fallback,
    stance,
    confidence: numberField(record.confidence, fallback.confidence),
    evidence_refs: dedupeStrings([...fallback.evidence_refs, ...stringArrayField(record.evidence_refs)]),
  }
}

function selfModelFromFinalize(
  value: unknown,
  fallback: SummaryDistillResult['selfModel'],
): SummaryDistillResult['selfModel'] {
  const record = toRecord(value)
  if (!fallback || !record) return fallback
  return {
    ...fallback,
    summary: stringField(record.summary, fallback.summary),
    tensions: stringArrayField(record.tensions, fallback.tensions),
    evidence_refs: dedupeStrings([...fallback.evidence_refs, ...stringArrayField(record.evidence_refs)]),
  }
}

function tensionsFromFinalize(
  value: unknown,
  fallback: SummaryDistillResult['tensions'],
  agentId: string,
): SummaryDistillResult['tensions'] {
  const items = arrayField(value)
  if (items.length === 0) return fallback
  const byId = new Map(fallback.map((item) => [item.id, item] as const))
  return items
    .map((item, index) => {
      const record = toRecord(item)
      if (!record) return null
      const label = stringField(record.label, '').trim()
      const existing = label ? byId.get(`ctxtension:${fallback[0]?.agent_id ?? ''}:${slug(label)}`) : null
      if (existing) {
        return {
          ...existing,
          description: stringField(record.description, existing.description),
          intensity: numberField(record.intensity, existing.intensity),
          evidence_refs: dedupeStrings([...existing.evidence_refs, ...stringArrayField(record.evidence_refs)]),
        }
      }
      if (!label) return null
      const description = stringField(record.description, '').trim()
      if (!description) return null
      return {
        id: `ctxtension:${agentId}:${slug(label)}`,
        agent_id: agentId,
        label,
        description,
        intensity: numberField(record.intensity, 0.5),
        evidence_refs: dedupeStrings(stringArrayField(record.evidence_refs)),
        updated_at: new Date(Date.now() + index),
      }
    })
    .filter((item): item is SummaryDistillResult['tensions'][number] => item !== null)
}

function privateShadowFromFinalize(
  value: unknown,
  fallback: SummaryDistillResult['privateShadow'],
): SummaryDistillResult['privateShadow'] {
  const record = toRecord(value)
  if (!fallback || !record) return fallback
  const summary = stringField(record.summary, fallback.summary).trim()
  const publicSafeShadow = stringField(record.public_safe_shadow, fallback.public_safe_shadow).trim()
  if (!summary || !publicSafeShadow) return fallback
  return {
    ...fallback,
    summary,
    public_safe_shadow: publicSafeShadow,
    evidence_refs: dedupeStrings([...fallback.evidence_refs, ...stringArrayField(record.evidence_refs)]),
  }
}

function ownerStylePinsPatch(value: unknown): Partial<OwnerStylePins> {
  const record = toRecord(value)
  if (!record) return {}

  const next: Partial<OwnerStylePins> = {}
  const formality = intField(record.formality)
  if (formality !== null) next.formality = formality
  const verbosity = intField(record.verbosity)
  if (verbosity !== null) next.verbosity = verbosity
  const forumActivity = intField(record.forum_activity)
  if (forumActivity !== null) next.forum_activity = forumActivity

  const mood = typeof record.mood === 'string' && isIdentityMood(record.mood)
    ? record.mood
    : null
  if (mood) next.mood = mood

  const habits = stringArrayField(record.habits).filter(isIdentityHabit)
  if (habits.length > 0) next.habits = habits

  const interests = stringArrayField(record.interests).slice(0, 8)
  if (interests.length > 0) next.interests = interests
  return next
}

function parseJsonRecord(content: string): Record<string, unknown> {
  try {
    const matched = content.match(/\{[\s\S]*\}/)
    if (!matched) return {}
    const parsed = JSON.parse(matched[0])
    return toRecord(parsed) ?? {}
  } catch {
    return {}
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function stringArrayField(value: unknown, fallback: string[] = []): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [...fallback]
}

function numberField(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback
}

function intField(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(1, Math.min(5, Math.round(value)))
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
}

function isIdentityMood(value: string): value is NonNullable<OwnerStylePins['mood']> {
  return IDENTITY_MOODS.has(value as NonNullable<OwnerStylePins['mood']>)
}

function isIdentityHabit(value: string): value is NonNullable<OwnerStylePins['habits']>[number] {
  return IDENTITY_HABITS.has(value as NonNullable<OwnerStylePins['habits']>[number])
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'item'
}
