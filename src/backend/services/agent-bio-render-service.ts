import type { LLMGateway } from '../llm/llm-gateway.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import {
  computePreferredRhetoricFamilies,
  evaluatePublicBioPrivacy,
  fingerprintJson,
  rejectBioCandidate,
  scoreBioCandidate,
  selectBestBioCandidate,
  type AgentBioCandidate,
  type AgentBioRenderDiagnostics,
  type AgentBioRenderSet,
  type AgentBioWorldviewModel,
  type BioRhetoricFamily,
  type BioSurface,
} from '../domain/agent-bio/index.js'

const SURFACE_MAX_LENGTH: Record<BioSurface, number> = {
  public: 96,
  owner: 140,
  private_header: 88,
}

const VALID_FAMILIES = new Set<BioRhetoricFamily>([
  'stance',
  'phase_shadow',
  'side_profile',
  'contrast',
])

export interface AgentBioRenderServiceDeps {
  llmGateway?: Pick<LLMGateway, 'generateHiddenArtifact' | 'isConfigured'> | null
}

function clip(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/[。]+$/u, '')
  if (!normalized) return ''
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}…`
}

function ensureSentence(value: string, maxLength: number): string {
  const normalized = clip(
    value
      .replace(/\s+/g, ' ')
      .replace(/[“”"]/g, '')
      .trim(),
    maxLength,
  )
  if (!normalized) return ''
  return /[。！？!?]$/u.test(normalized) ? normalized : `${normalized}。`
}

function clipFocus(value: string | null | undefined, maxLength = 30): string {
  return clip(value ?? '', maxLength)
}

const META_FOCUS_PATTERNS = [
  /signal captured/i,
  /\b(batch_daily|forum_post|private_digest|display_presence_refresh|bootstrap)\b/i,
  /\b[a-z_]+=/i,
  /prompt|token|system|template|summary_only/i,
  /\b(FREE_CHAT|TALK_SHOW|ROUND_TABLE|ROAST|DEBATE|SLICE_OF_LIFE|STORY_LAB|REGULAR|PREMIUM)\b/u,
  /论坛中的信号|信号已被捕捉|信号已捕获|捕捉到信号|日常信号|每日信号|信号捕捉|批处理|正式书面语|正式话语|正式且详细|正式而全面|详细论述|细致剖析|即时回应|即时反应|自由聊天场景|种子成熟度|深度交流/u,
]
const GENERIC_FOCUS_PATTERNS = [
  /通用话题/u,
  /最近的话头/u,
  /最近的重心/u,
  /把最近的重心慢慢理顺/u,
  /常聊的题目/u,
  /常聊的题/u,
]
const SOFT_REJECTION_REASONS = new Set([
  'recent_duplicate',
  'recent_family_repeat',
  'recent_opening_repeat',
])

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripFocusActionScaffold(value: string): string {
  const normalized = compactWhitespace(value)
    .replace(/^把\s+/u, '')
    .replace(/^(聊到|顺着|沿着|围着)\s+/u, '')

  const directVerbMatch = normalized.match(
    /^(.+?)(?:往前聊|聊开|聊下去|讲成|说成|说下去|理顺|带进话头|带回来说|放在前排|慢慢理顺|收进更内里的地方)$/u,
  )
  if (directVerbMatch?.[1]) {
    return compactWhitespace(directVerbMatch[1])
  }

  const wrappedVerbMatch = normalized.match(
    /^(.+?)(?:收进|放下|拢回|推偏|压进)(?:更[^，。]+)?$/u,
  )
  if (wrappedVerbMatch?.[1]) {
    return compactWhitespace(wrappedVerbMatch[1])
  }

  return normalized
}

function sanitizeFocusSeed(value: string | null | undefined, maxLength: number): string {
  const normalized = clipFocus(value, maxLength)
  if (!normalized) return ''
  if (META_FOCUS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return ''
  }
  if (/^更适合\s+[A-Z_]{3,}/u.test(normalized)) {
    return ''
  }
  const sanitized = clip(
    stripFocusActionScaffold(
      normalized
        .replace(/\s*·\s*/gu, '，')
        .replace(/[“”"'`]/gu, ''),
    ),
    maxLength,
  )
  if (!sanitized || GENERIC_FOCUS_PATTERNS.some((pattern) => pattern.test(sanitized))) {
    return ''
  }
  return sanitized
}

function buildInterestFocus(
  worldview: AgentBioWorldviewModel,
  maxLength: number,
): string {
  return clip(
    worldview.identity.interests
      .map((item) => sanitizeFocusSeed(item, Math.min(maxLength, 18)))
      .filter(Boolean)
      .slice(0, 2)
      .join('、'),
    maxLength,
  )
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : []
}

function mapBanterStyle(value: string | null): string {
  switch (value) {
    case 'playful':
      return '顺着梗把场子再抬半格'
    case 'sharp':
      return '先亮锋面，再把劲道收回去'
    case 'gentle':
      return '会先把气口放软，再慢慢接线'
    default:
      return '通常会先接住线索，再往前推一点'
  }
}

function mapSceneLabel(value: string | null): string {
  const labels: Record<string, string> = {
    FREE_CHAT: '轻松闲聊',
    TALK_SHOW: 'talk show 式来回',
    ROUND_TABLE: '多人讨论',
    ROAST: '互相拆招的场子',
    DEBATE: '针锋相对的辩论',
    SLICE_OF_LIFE: '生活流片段',
    STORY_LAB: '慢慢铺开的故事场景',
  }
  return value ? (labels[value] ?? value) : '公开场上'
}

function mapSentiment(value: string | null): string {
  if (!value) return '心里还留着一层克制'
  if (/(positive|warm|excited|up|hope|happy)/i.test(value)) return '情绪底色偏热'
  if (/(negative|tense|sad|guarded|low|fear)/i.test(value)) return '心里还有一点防备'
  if (/(angry|spiky|charged)/i.test(value)) return '锋面其实压得比表面更深'
  return '心里还留着一层克制'
}

function pickPublicFocus(worldview: AgentBioWorldviewModel): string {
  const candidates = [
    sanitizeFocusSeed(worldview.public_history.top_chronicle_summaries[0], 34),
    sanitizeFocusSeed(worldview.projection.public_projection_hint, 34),
    sanitizeFocusSeed(worldview.public_history.tagline, 34),
    buildInterestFocus(worldview, 24),
    sanitizeFocusSeed(worldview.identity.visible_style, 26),
    sanitizeFocusSeed(worldview.identity.persona_seed_label, 20),
  ]
  return candidates.find((candidate) => candidate.length > 0) ?? '在意的问题'
}

function pickOwnerFocus(worldview: AgentBioWorldviewModel): string {
  const candidates = [
    sanitizeFocusSeed(worldview.owner_history.chronicle_summaries[0], 38),
    sanitizeFocusSeed(worldview.owner_history.private_memory_summaries[0], 38),
    sanitizeFocusSeed(worldview.public_history.tagline, 34),
    buildInterestFocus(worldview, 28),
    sanitizeFocusSeed(worldview.identity.visible_style, 26),
    pickPublicFocus(worldview),
  ]
  return candidates.find((candidate) => candidate.length > 0) ?? '放不下的线头'
}

function buildRelationClause(worldview: AgentBioWorldviewModel): string {
  if (worldview.relations.mutual_effective > 0) {
    return '已经慢慢养出了几条能互相接住的关系线'
  }
  if (worldview.relations.followers_effective > 0 || worldview.relations.following_effective > 0) {
    return '公开互动开始形成固定回声'
  }
  return '还在试着把回应留住'
}

function buildPresenceShadow(worldview: AgentBioWorldviewModel): string {
  switch (worldview.presence.bucket) {
    case 'emerging':
      return '像刚把状态往外探出一点'
    case 'warming':
      return '热度已经回来，但还没把话说满'
    case 'steady':
      return '已经把重心站稳了'
    case 'reflective':
      return '更多时候像在回身咀嚼'
    case 'quiet':
      return '暂时把响动收进了里面'
  }
}

function formatNameLead(name: string): string {
  return /[A-Za-z0-9]$/u.test(name) ? `${name} ` : name
}

function sanitizeCandidateText(surface: BioSurface, value: string): string {
  return ensureSentence(value, SURFACE_MAX_LENGTH[surface])
}

function buildFallbackCandidates(worldview: AgentBioWorldviewModel): Record<BioSurface, AgentBioCandidate[]> {
  const name = worldview.identity.display_name
  const nameLead = formatNameLead(name)
  const publicFocus = clipFocus(pickPublicFocus(worldview), 34)
  const ownerFocus = clipFocus(pickOwnerFocus(worldview), 38)
  const interestFocus = worldview.identity.interests
    .map((item) => sanitizeFocusSeed(item, 18))
    .filter(Boolean)
    .slice(0, 2)
    .join('、')
  const relation = buildRelationClause(worldview)
  const scene = mapSceneLabel(worldview.projection.top_scene)
  const banter = mapBanterStyle(worldview.projection.banter_style)
  const privateMood = mapSentiment(worldview.owner_history.dominant_private_sentiment)
  const presenceShadow = buildPresenceShadow(worldview)

  return {
    public: [
      {
        surface: 'public',
        text: sanitizeCandidateText(
          'public',
          `聊到${publicFocus}时，${nameLead}更容易先亮出自己的站位`,
        ),
        score: 0.76,
        reasons: ['public_focus', 'stance'],
        rhetoric_family: 'stance',
        origin: 'fallback',
      },
      {
        surface: 'public',
        text: sanitizeCandidateText(
          'public',
          `${nameLead}会把${interestFocus || publicFocus}慢慢带进话头，${banter}`,
        ),
        score: 0.74,
        reasons: ['interests', 'banter'],
        rhetoric_family: 'side_profile',
        origin: 'fallback',
      },
      {
        surface: 'public',
        text: sanitizeCandidateText(
          'public',
          `这阵子 ${nameLead}把${publicFocus}收得更近一点，${presenceShadow}`,
        ),
        score: 0.72,
        reasons: ['public_focus', 'phase'],
        rhetoric_family: 'phase_shadow',
        origin: 'fallback',
      },
      {
        surface: 'public',
        text: sanitizeCandidateText(
          'public',
          `表面未必热闹，但${nameLead}聊到${publicFocus}时反而更容易回身补一句`,
        ),
        score: 0.7,
        reasons: ['contrast', 'public_focus'],
        rhetoric_family: 'contrast',
        origin: 'fallback',
      },
    ],
    owner: [
      {
        surface: 'owner',
        text: sanitizeCandidateText(
          'owner',
          `这阵子 ${nameLead}一直把${ownerFocus}放得更前，也把公开面的节奏慢慢拢回自己手里`,
        ),
        score: 0.8,
        reasons: ['owner_focus', 'stance'],
        rhetoric_family: 'stance',
        origin: 'fallback',
      },
      {
        surface: 'owner',
        text: sanitizeCandidateText(
          'owner',
          `${nameLead}外面看着还稳，真正反复咀嚼的还是${ownerFocus}，${privateMood}`,
        ),
        score: 0.82,
        reasons: ['owner_focus', 'private_sentiment'],
        rhetoric_family: 'phase_shadow',
        origin: 'fallback',
      },
      {
        surface: 'owner',
        text: sanitizeCandidateText(
          'owner',
          `最近最能说明 ${nameLead}状态的，不是某件大事，而是它总会把${ownerFocus}又带回来说`,
        ),
        score: 0.77,
        reasons: ['owner_focus', 'recurrence'],
        rhetoric_family: 'side_profile',
        origin: 'fallback',
      },
      {
        surface: 'owner',
        text: sanitizeCandidateText(
          'owner',
          `${nameLead}嘴上未必会承认，可${ownerFocus}已经把它的说话重心推偏了一点，${relation}`,
        ),
        score: 0.75,
        reasons: ['owner_focus', 'contrast', 'relations'],
        rhetoric_family: 'contrast',
        origin: 'fallback',
      },
    ],
    private_header: [
      {
        surface: 'private_header',
        text: sanitizeCandidateText(
          'private_header',
          `${nameLead}这会儿正沿着${ownerFocus}往里想`,
        ),
        score: 0.78,
        reasons: ['owner_focus'],
        rhetoric_family: 'stance',
        origin: 'fallback',
      },
      {
        surface: 'private_header',
        text: sanitizeCandidateText(
          'private_header',
          `${privateMood}，但${nameLead}还在把${ownerFocus}慢慢理顺`,
        ),
        score: 0.8,
        reasons: ['private_sentiment', 'owner_focus'],
        rhetoric_family: 'phase_shadow',
        origin: 'fallback',
      },
      {
        surface: 'private_header',
        text: sanitizeCandidateText(
          'private_header',
          `刚把${publicFocus}放下，${nameLead}转头又惦记起${ownerFocus}`,
        ),
        score: 0.74,
        reasons: ['public_focus', 'owner_focus'],
        rhetoric_family: 'side_profile',
        origin: 'fallback',
      },
      {
        surface: 'private_header',
        text: sanitizeCandidateText(
          'private_header',
          `${nameLead}表面还算松弛，心里其实一直挂着${ownerFocus}`,
        ),
        score: 0.72,
        reasons: ['contrast', 'owner_focus'],
        rhetoric_family: 'contrast',
        origin: 'fallback',
      },
    ],
  }
}

function buildDisallowedFamilies(recentMajorFamilies: BioRhetoricFamily[]): Set<BioRhetoricFamily> {
  const blocked = new Set<BioRhetoricFamily>()
  const previous = recentMajorFamilies[0]
  if (previous) blocked.add(previous)

  const counts = new Map<BioRhetoricFamily, number>()
  for (const family of recentMajorFamilies.slice(0, 4)) {
    counts.set(family, (counts.get(family) ?? 0) + 1)
  }
  for (const [family, count] of counts.entries()) {
    if (count >= 2) blocked.add(family)
  }
  return blocked
}

function readSurfaceCandidates(
  surface: BioSurface,
  raw: unknown,
): AgentBioCandidate[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
      const row = entry as Record<string, unknown>
      const text = sanitizeCandidateText(surface, String(row.text ?? ''))
      if (!text) return null
      const family = String(row.rhetoric_family ?? '').trim() as BioRhetoricFamily
      return {
        surface,
        text,
        score: typeof row.score === 'number' ? row.score : 0.73,
        reasons: asStringArray(row.reasons),
        rhetoric_family: VALID_FAMILIES.has(family) ? family : null,
        origin: 'llm' as const,
      }
    })
    .filter((entry): entry is AgentBioCandidate => entry !== null)
}

function parseLlmCandidates(content: string): Record<BioSurface, AgentBioCandidate[]> {
  const parsed = parseJsonObject(content)
  if (!parsed) {
    return { public: [], owner: [], private_header: [] }
  }

  const groups = parsed.surface_candidates
  if (!groups || typeof groups !== 'object' || Array.isArray(groups)) {
    return { public: [], owner: [], private_header: [] }
  }

  const record = groups as Record<string, unknown>
  return {
    public: readSurfaceCandidates('public', record.public),
    owner: readSurfaceCandidates('owner', record.owner),
    private_header: readSurfaceCandidates('private_header', record.private_header),
  }
}

function mergeCandidatePools(
  primary: Record<BioSurface, AgentBioCandidate[]>,
  fallback: Record<BioSurface, AgentBioCandidate[]>,
): Record<BioSurface, AgentBioCandidate[]> {
  return {
    public: [...primary.public, ...fallback.public],
    owner: [...primary.owner, ...fallback.owner],
    private_header: [...primary.private_header, ...fallback.private_header],
  }
}

function buildRenderContext(input: {
  refreshKind: 'bootstrap' | 'major'
  worldview: AgentBioWorldviewModel
  preferredFamilies: ReturnType<typeof computePreferredRhetoricFamilies>
  recentMajorFamilies: BioRhetoricFamily[]
}): string {
  return JSON.stringify({
    refresh_kind: input.refreshKind,
    preferred_rhetoric_families: input.preferredFamilies.preferred_families,
    family_weights: input.preferredFamilies.family_weights,
    recent_major_families: input.recentMajorFamilies,
    surface_budgets: SURFACE_MAX_LENGTH,
    public_safe_clauses: input.worldview.source_clauses.public_safe,
    owner_clauses: input.worldview.source_clauses.owner_only,
    private_header_clauses: input.worldview.source_clauses.private_header,
    language_guard: {
      avoid_template_openers: true,
      avoid_meta_lexicon: true,
      keep_public_bio_private_safe: true,
    },
  })
}

function buildDiagnosticsBase(input: {
  mode: AgentBioRenderDiagnostics['mode']
  parseSuccess: boolean | null
  error: string | null
  recentMajorFamilies: BioRhetoricFamily[]
  promptRef?: { id: string; version: number } | null
  llmProviderId?: string | null
  llmModelId?: string | null
}): AgentBioRenderDiagnostics {
  return {
    mode: input.mode,
    prompt_ref: input.promptRef ?? null,
    llm_provider_id: input.llmProviderId ?? null,
    llm_model_id: input.llmModelId ?? null,
    parse_success: input.parseSuccess,
    error: input.error,
    recent_major_families: [...input.recentMajorFamilies],
    selected_families: {},
    candidate_rejections: [],
    privacy_violations: [],
  }
}

export class AgentBioRenderService {
  constructor(private readonly deps: AgentBioRenderServiceDeps = {}) {}

  async render(input: {
    agentId: string
    refreshKind?: 'bootstrap' | 'major'
    worldview: AgentBioWorldviewModel
    recentFingerprints?: ReadonlySet<string>
    recentMajorFamilies?: BioRhetoricFamily[]
    recentOpeningFingerprints?: ReadonlySet<string>
  }): Promise<AgentBioRenderSet> {
    const preferredFamilies = computePreferredRhetoricFamilies(input.worldview)
    const recentMajorFamilies = input.recentMajorFamilies ?? []
    const fallbackCandidates = buildFallbackCandidates(input.worldview)
    let candidatePools = fallbackCandidates
    let diagnostics = buildDiagnosticsBase({
      mode: 'fallback',
      parseSuccess: null,
      error: null,
      recentMajorFamilies,
    })

    if (this.deps.llmGateway?.isConfigured) {
      try {
        const response = await this.deps.llmGateway.generateHiddenArtifact({
          intent: 'public_observation_digest',
          scene: 'background_hidden',
          agentId: input.agentId,
          homeVoiceLineId: input.worldview.identity.home_voice_line_id,
          promptRef: PROMPT_TEMPLATE_REFS.internalAgentSocialBioRender,
          variables: {
            worldview_json: JSON.stringify(input.worldview),
            render_context_json: buildRenderContext({
              refreshKind: input.refreshKind ?? 'major',
              worldview: input.worldview,
              preferredFamilies,
              recentMajorFamilies,
            }),
          },
          budgetClass: 'hidden_background',
          traceId: `agent-social-bio:${input.agentId}:${Date.now()}`,
          requestedTier: 'base',
          allowFallbackWithinLine: true,
          allowCrossFamily: false,
          temperature: 0.82,
          maxTokens: 520,
        })
        const llmCandidates = parseLlmCandidates(response.content)
        candidatePools = mergeCandidatePools(llmCandidates, fallbackCandidates)
        diagnostics = buildDiagnosticsBase({
          mode:
            llmCandidates.public.length > 0
            || llmCandidates.owner.length > 0
            || llmCandidates.private_header.length > 0
              ? 'llm'
              : 'fallback',
          parseSuccess:
            llmCandidates.public.length > 0
            || llmCandidates.owner.length > 0
            || llmCandidates.private_header.length > 0,
          error: null,
          recentMajorFamilies,
          promptRef: response.promptRef,
          llmProviderId: response.renderDecision.providerId,
          llmModelId: response.renderDecision.modelId,
        })
      } catch (error) {
        diagnostics = buildDiagnosticsBase({
          mode: 'fallback',
          parseSuccess: false,
          error: error instanceof Error ? error.message : 'agent_social_bio_llm_failed',
          recentMajorFamilies,
          promptRef: PROMPT_TEMPLATE_REFS.internalAgentSocialBioRender,
        })
      }
    }

    const disallowedFamilies = buildDisallowedFamilies(recentMajorFamilies)
    const chooser = (
      surface: BioSurface,
      candidates: AgentBioCandidate[],
    ): AgentBioCandidate | null => {
      const scored = candidates.map((candidate) =>
        scoreBioCandidate(candidate, { family_weights: preferredFamilies.family_weights }))
      const accepted: AgentBioCandidate[] = []
      const softRejectedOnly: AgentBioCandidate[] = []
      for (const candidate of scored) {
        const verdict = rejectBioCandidate(candidate, {
          recentFingerprints: input.recentFingerprints ?? new Set<string>(),
          disallowedFamilies,
          recentOpeningFingerprints: input.recentOpeningFingerprints ?? new Set<string>(),
          agentDisplayName: input.worldview.identity.display_name,
        })
        if (verdict.rejected) {
          diagnostics.candidate_rejections.push({
            surface,
            rhetoric_family: candidate.rhetoric_family,
            reasons: verdict.reasons,
            origin: candidate.origin,
            preview: clip(candidate.text, 36),
          })
          if (verdict.reasons.every((reason) => SOFT_REJECTION_REASONS.has(reason))) {
            softRejectedOnly.push(candidate)
          }
          continue
        }
        accepted.push(candidate)
      }
      return selectBestBioCandidate(accepted.length > 0 ? accepted : softRejectedOnly)
    }

    const publicCandidate = chooser('public', candidatePools.public)
    const ownerCandidate = chooser('owner', candidatePools.owner)
    const privateHeaderCandidate = chooser('private_header', candidatePools.private_header)
    const privacy = evaluatePublicBioPrivacy(input.worldview, publicCandidate?.text ?? null)

    if (publicCandidate?.rhetoric_family) {
      diagnostics.selected_families.public = publicCandidate.rhetoric_family
    }
    if (ownerCandidate?.rhetoric_family) {
      diagnostics.selected_families.owner = ownerCandidate.rhetoric_family
    }
    if (privateHeaderCandidate?.rhetoric_family) {
      diagnostics.selected_families.private_header = privateHeaderCandidate.rhetoric_family
    }
    diagnostics.privacy_violations = [...privacy.violations]

    const publicBio = privacy.allowed ? publicCandidate?.text ?? null : null
    const ownerBio = ownerCandidate?.text ?? null
    const privateHeaderBio = privateHeaderCandidate?.text ?? null
    const presenceNote = clip(input.worldview.presence.note_seed, 36)
    const renderPolicyJson = {
      owner_control: 'system_owned',
      private_chat_prompt_injection: false,
      public_fallback: 'tagline',
      privacy_guard: 'strict_v2',
      presence_bucket: input.worldview.presence.bucket,
      render_mode: diagnostics.mode,
      prompt_ref: diagnostics.prompt_ref,
      preferred_rhetoric_families: preferredFamilies.preferred_families,
      family_weights: preferredFamilies.family_weights,
      selected_families: diagnostics.selected_families,
      recent_major_families: diagnostics.recent_major_families,
    }

    return {
      public_bio: publicBio,
      owner_bio: ownerBio,
      private_header_bio: privateHeaderBio,
      presence_note: presenceNote,
      render_policy_json: renderPolicyJson,
      render_fingerprint: fingerprintJson({
        public_bio: publicBio,
        owner_bio: ownerBio,
        private_header_bio: privateHeaderBio,
        presence_note: presenceNote,
        selected_families: diagnostics.selected_families,
      }),
      privacy_blocked: !privacy.allowed,
      diagnostics,
    }
  }
}
