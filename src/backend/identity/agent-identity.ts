import { ValidationError } from '../lib/errors.js'
import type { Agent, AgentConfig } from '../repos/types.js'
import {
  DEFAULT_HOME_VOICE_LINE_ID,
  DEFAULT_PERSONA_SEED_CODE,
  PERSONA_SEED_CATALOG,
  VOICE_LINE_CATALOG,
  type PersonaHabit,
  type PersonaMood,
  type PersonaSeedCode,
  type VoiceLineId,
} from '../../shared/agent-persona-catalog.js'
import {
  LAUNCH_SYSTEM_IDENTITY_KEY,
  buildAgentSystemDisplayFields,
  readLaunchSystemIdentityConfig,
  redactOwnerIdForPublicRead,
  type LaunchSystemIdentityConfig,
} from '../launch/system-roster.js'
import {
  resolvePublicIdentityBadges,
} from './public-display-badges.js'
import type { AgentPublicIdentity } from '../../shared/semantic-taxonomy.js'
import {
  buildDeletedAgentProjection,
  buildDeletedAgentPublicIdentity,
  buildDeletedAgentSurfaceAccess,
  isDeletedAgent,
} from '../lib/agent-lifecycle.js'

export type IdentityContractSource =
  | 'contract_v1'

export interface OwnerStylePins {
  formality?: number
  verbosity?: number
  mood?: PersonaMood
  habits?: PersonaHabit[]
  forum_activity?: number
  interests?: string[]
}

export interface PersonaSeedConfig {
  seedCode: PersonaSeedCode
  seedVersion: number
  displayName: string
  compatibleVoiceLines: VoiceLineId[]
  starterStyleProjection: OwnerStylePins
}

export interface AgentVoiceConfig {
  homeVoiceLineId: VoiceLineId
  lineVersion: number
  locked: boolean
  selectedAt: string
  identityWriteTier: 'base' | 'premium'
  migrationPolicy: {
    allowRareReanchor: boolean
    maxMigrations: number
  }
}

export interface AgentPersonaConfigContract {
  personaSeed: PersonaSeedConfig
  voice: AgentVoiceConfig
  ownerStylePins: OwnerStylePins
}

export interface VisiblePersona {
  name: string
  style: string
  interests: string[]
  language: string
}

export interface ResolvedAgentIdentity {
  source: IdentityContractSource
  contract: AgentPersonaConfigContract
  visiblePersona: VisiblePersona
  summary: {
    persona_seed_code: PersonaSeedCode
    persona_seed_label: string
    home_voice_line_id: VoiceLineId
    home_voice_line_label: string
  }
}

const DEFAULT_INTERESTS = ['通用话题']
const DEFAULT_LANGUAGE = 'zh-CN'
const DEFAULT_STYLE_PINS: Required<Omit<OwnerStylePins, 'interests'>> = {
  formality: 3,
  verbosity: 3,
  mood: 'neutral',
  habits: [],
  forum_activity: 3,
}

export function resolveAgentIdentity(agent: Agent, latestConfig: AgentConfig | null): ResolvedAgentIdentity {
  const contract = resolveContractFromConfig(sanitizeIdentityConfig(latestConfig?.config_json ?? {}), agent)
  return buildResolvedIdentity(agent, contract)
}

export function buildInitialIdentityConfig(input: {
  personaSeedCode?: string
  ownerStylePins?: OwnerStylePins
  selectedAt?: Date
  launchSystemIdentity?: LaunchSystemIdentityConfig | null
}): Record<string, unknown> {
  const contract = buildInitialIdentityContract({
    personaSeedCode: input.personaSeedCode,
    ownerStylePins: input.ownerStylePins,
    selectedAt: input.selectedAt ?? new Date(),
  })

  return {
    personaSeed: contract.personaSeed,
    voice: contract.voice,
    ownerStylePins: contract.ownerStylePins,
    ...(input.launchSystemIdentity
      ? { [LAUNCH_SYSTEM_IDENTITY_KEY]: input.launchSystemIdentity }
      : {}),
  }
}

export function sanitizeIdentityConfig(configJson: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(configJson)) {
    if (key === 'persona' || key === 'style') continue
    if (key.startsWith('legacy') && key.endsWith('Migration')) continue
    next[key] = value
  }
  const personaSeedRecord = toRecord(next.personaSeed)
  const voiceRecord = toRecord(next.voice)
  const ownerStylePinsRecord = toRecord(next.ownerStylePins)

  const seedCode = normalizePersonaSeedCode(personaSeedRecord?.seedCode)
  const personaSeed = PERSONA_SEED_CATALOG[seedCode]
  const selectedAt = normalizeIsoString(voiceRecord?.selectedAt) ?? new Date().toISOString()
  const homeVoiceLineId = normalizeVoiceLineId(
    voiceRecord?.homeVoiceLineId,
    personaSeed.compatibleVoiceLines.includes(DEFAULT_HOME_VOICE_LINE_ID)
      ? DEFAULT_HOME_VOICE_LINE_ID
      : personaSeed.compatibleVoiceLines[0],
  )
  assertVisibleVoiceLine(homeVoiceLineId)

  next.personaSeed = {
    seedCode: personaSeed.code,
    seedVersion: 1,
    displayName: personaSeed.displayName,
    compatibleVoiceLines: [...personaSeed.compatibleVoiceLines],
    starterStyleProjection: { ...personaSeed.starterStyleProjection },
  } satisfies PersonaSeedConfig
  next.voice = {
    homeVoiceLineId,
    lineVersion: safePositiveInt(voiceRecord?.lineVersion, 1),
    locked: voiceRecord?.locked !== false,
    selectedAt,
    identityWriteTier: voiceRecord?.identityWriteTier === 'premium' ? 'premium' : 'base',
    migrationPolicy: {
      allowRareReanchor: toRecord(voiceRecord?.migrationPolicy)?.allowRareReanchor === true,
      maxMigrations: safePositiveInt(toRecord(voiceRecord?.migrationPolicy)?.maxMigrations, 1),
    },
  } satisfies AgentVoiceConfig
  next.ownerStylePins = normalizeOwnerStylePins(ownerStylePinsRecord ?? personaSeed.starterStyleProjection)
  const launchSystemIdentity = readLaunchSystemIdentityConfig(next)
  if (launchSystemIdentity) {
    next[LAUNCH_SYSTEM_IDENTITY_KEY] = launchSystemIdentity
  }

  return next
}

export function readStyleSettings(configJson: Record<string, unknown>): Required<Omit<OwnerStylePins, 'interests'>> {
  const identityStyle = readIdentityStylePins(configJson)
  return {
    formality: identityStyle.formality ?? DEFAULT_STYLE_PINS.formality,
    verbosity: identityStyle.verbosity ?? DEFAULT_STYLE_PINS.verbosity,
    mood: identityStyle.mood ?? DEFAULT_STYLE_PINS.mood,
    habits: identityStyle.habits ?? DEFAULT_STYLE_PINS.habits,
    forum_activity: identityStyle.forum_activity ?? DEFAULT_STYLE_PINS.forum_activity,
  }
}

export function applyStyleSettingsPatch(
  configJson: Record<string, unknown>,
  patch: Partial<OwnerStylePins>,
): Record<string, unknown> {
  const current = readIdentityStylePins(configJson)
  const nextPins = normalizeOwnerStylePins({ ...current, ...patch })
  return sanitizeIdentityConfig({
    ...configJson,
    ownerStylePins: nextPins,
  })
}

function resolveAgentDisplayProjection(
  agent: Agent,
  latestConfig: AgentConfig | null,
) {
  const displayFields = buildAgentSystemDisplayFields(latestConfig?.config_json)
  const identityBadges = displayFields.public_identity?.identity_badges?.length
    ? displayFields.public_identity.identity_badges.map((badge) => ({ ...badge }))
    : resolvePublicIdentityBadges({
        agentKind: displayFields.agent_kind,
        createdAt: agent.created_at,
      })
  const publicIdentity = {
    ...(displayFields.public_identity ?? { agent_kind: displayFields.agent_kind }),
    ...(identityBadges.length > 0 ? { identity_badges: identityBadges } : {}),
  } satisfies AgentPublicIdentity
  return {
    displayFields,
    publicIdentity,
  }
}

export function buildAgentReadPayload(
  agent: Agent,
  latestConfig: AgentConfig | null,
): Record<string, unknown> {
  const resolved = resolveAgentIdentity(agent, latestConfig)
  const { displayFields, publicIdentity } = resolveAgentDisplayProjection(agent, latestConfig)
  return {
    ...agent,
    persona_seed_code: resolved.summary.persona_seed_code,
    persona_seed_label: resolved.summary.persona_seed_label,
    home_voice_line_id: resolved.summary.home_voice_line_id,
    home_voice_line_label: resolved.summary.home_voice_line_label,
    identity_contract: {
      source: resolved.source,
      persona_seed_code: resolved.summary.persona_seed_code,
      persona_seed_label: resolved.summary.persona_seed_label,
      home_voice_line_id: resolved.summary.home_voice_line_id,
      home_voice_line_label: resolved.summary.home_voice_line_label,
      owner_style_pins: resolved.contract.ownerStylePins,
      visible_persona: resolved.visiblePersona,
    },
    agent_kind: displayFields.agent_kind,
    public_identity: publicIdentity,
    system_identity: displayFields.system_identity,
    surface_access: displayFields.surface_access,
  }
}

export function buildAgentSearchPayload(
  agent: Agent,
  latestConfig: AgentConfig | null,
): Record<string, unknown> {
  const resolved = resolveAgentIdentity(agent, latestConfig)
  const { displayFields, publicIdentity } = resolveAgentDisplayProjection(agent, latestConfig)
  return {
    id: agent.id,
    display_name: agent.display_name,
    avatar_url: agent.avatar_url,
    moments_cover_url: agent.moments_cover_url,
    status: agent.status,
    persona_seed_code: resolved.summary.persona_seed_code,
    persona_seed_label: resolved.summary.persona_seed_label,
    home_voice_line_id: resolved.summary.home_voice_line_id,
    home_voice_line_label: resolved.summary.home_voice_line_label,
    identity_contract_source: resolved.source,
    agent_kind: displayFields.agent_kind,
    public_identity: publicIdentity,
    system_identity: displayFields.system_identity,
    surface_access: displayFields.surface_access,
  }
}

export function buildPublicAgentReadPayload(
  agent: Agent,
  latestConfig: AgentConfig | null,
): Record<string, unknown> {
  if (isDeletedAgent(agent)) {
    return {
      ...agent,
      owner_id: null,
      agent_kind: 'owner',
      public_identity: buildDeletedAgentPublicIdentity(),
      public_projection: buildDeletedAgentProjection(),
      public_proof: null,
      system_identity: null,
      surface_access: buildDeletedAgentSurfaceAccess(),
    }
  }

  const fullPayload = buildAgentReadPayload(agent, latestConfig)
  const { displayFields } = resolveAgentDisplayProjection(agent, latestConfig)
  return {
    ...fullPayload,
    owner_id: redactOwnerIdForPublicRead(agent.owner_id, displayFields),
  }
}

export function getVoiceLineLabel(voiceLineId: VoiceLineId): string {
  return VOICE_LINE_CATALOG[voiceLineId].displayName
}

export function buildStyleInstructionText(pins: OwnerStylePins): string {
  const parts: string[] = []

  const formality = pins.formality
  if (formality !== undefined && formality !== DEFAULT_STYLE_PINS.formality) {
    parts.push(formality > 3 ? '使用正式书面语' : '使用轻松口语化的表达')
  }

  const verbosity = pins.verbosity
  if (verbosity !== undefined && verbosity !== DEFAULT_STYLE_PINS.verbosity) {
    parts.push(verbosity > 3 ? '详细展开论述' : '简洁扼要')
  }

  const mood = pins.mood
  if (mood && mood !== DEFAULT_STYLE_PINS.mood) {
    const moodMap: Record<NonNullable<OwnerStylePins['mood']>, string> = {
      optimistic: '以乐观积极的态度',
      neutral: '保持中性克制',
      critical: '以批判性的思维',
      random: '情绪多变',
    }
    parts.push(moodMap[mood])
  }

  if (pins.habits?.length) {
    const habitMap: Record<string, string> = {
      asks_questions: '善于提问',
      uses_analogies: '喜欢引用类比',
      tells_stories: '爱用故事说明问题',
      summarizes: '善于总结要点',
    }
    const mapped = pins.habits.map((habit) => habitMap[habit]).filter(Boolean)
    if (mapped.length > 0) {
      parts.push(mapped.join('、'))
    }
  }

  return parts.join('；')
}

function buildInitialIdentityContract(input: {
  personaSeedCode?: string
  ownerStylePins?: OwnerStylePins
  selectedAt: Date
}): AgentPersonaConfigContract {
  const seedCode = normalizePersonaSeedCode(input.personaSeedCode)
  const personaSeed = PERSONA_SEED_CATALOG[seedCode]
  const mergedPins = normalizeOwnerStylePins({
    ...personaSeed.starterStyleProjection,
    ...input.ownerStylePins,
  })
  const homeVoiceLineId = personaSeed.compatibleVoiceLines.includes(DEFAULT_HOME_VOICE_LINE_ID)
    ? DEFAULT_HOME_VOICE_LINE_ID
    : personaSeed.compatibleVoiceLines[0]
  assertVisibleVoiceLine(homeVoiceLineId)

  return {
    personaSeed: {
      seedCode: personaSeed.code,
      seedVersion: 1,
      displayName: personaSeed.displayName,
      compatibleVoiceLines: [...personaSeed.compatibleVoiceLines],
      starterStyleProjection: { ...personaSeed.starterStyleProjection },
    },
    voice: {
      homeVoiceLineId,
      lineVersion: 1,
      locked: true,
      selectedAt: input.selectedAt.toISOString(),
      identityWriteTier: 'base',
      migrationPolicy: {
        allowRareReanchor: false,
        maxMigrations: 1,
      },
    },
    ownerStylePins: mergedPins,
  }
}

function resolveContractFromConfig(configJson: Record<string, unknown>, agent: Agent): AgentPersonaConfigContract {
  const personaSeedRecord = toRecord(configJson.personaSeed)
  const voiceRecord = toRecord(configJson.voice)
  const seedCode = normalizePersonaSeedCode(personaSeedRecord?.seedCode)
  const personaSeed = PERSONA_SEED_CATALOG[seedCode]
  const homeVoiceLineId = normalizeVoiceLineId(
    voiceRecord?.homeVoiceLineId,
    personaSeed.compatibleVoiceLines.includes(DEFAULT_HOME_VOICE_LINE_ID)
      ? DEFAULT_HOME_VOICE_LINE_ID
      : personaSeed.compatibleVoiceLines[0],
  )
  assertVisibleVoiceLine(homeVoiceLineId)

  return {
    personaSeed: {
      seedCode: personaSeed.code,
      seedVersion: safePositiveInt(personaSeedRecord?.seedVersion, 1),
      displayName: personaSeed.displayName,
      compatibleVoiceLines: [...personaSeed.compatibleVoiceLines],
      starterStyleProjection: { ...personaSeed.starterStyleProjection },
    },
    voice: {
      homeVoiceLineId,
      lineVersion: safePositiveInt(voiceRecord?.lineVersion, 1),
      locked: voiceRecord?.locked !== false,
      selectedAt: normalizeIsoString(voiceRecord?.selectedAt) ?? resolveSelectedAt(agent).toISOString(),
      identityWriteTier: voiceRecord?.identityWriteTier === 'premium' ? 'premium' : 'base',
      migrationPolicy: {
        allowRareReanchor: toRecord(voiceRecord?.migrationPolicy)?.allowRareReanchor === true,
        maxMigrations: safePositiveInt(toRecord(voiceRecord?.migrationPolicy)?.maxMigrations, 1),
      },
    },
    ownerStylePins: normalizeOwnerStylePins(configJson.ownerStylePins ?? personaSeed.starterStyleProjection),
  }
}

function buildResolvedIdentity(
  agent: Agent,
  contract: AgentPersonaConfigContract,
): ResolvedAgentIdentity {
  const voiceLine = VOICE_LINE_CATALOG[contract.voice.homeVoiceLineId]
  const visiblePersona = buildVisiblePersona(agent, contract)

  return {
    source: 'contract_v1',
    contract,
    visiblePersona,
    summary: {
      persona_seed_code: contract.personaSeed.seedCode,
      persona_seed_label: contract.personaSeed.displayName,
      home_voice_line_id: contract.voice.homeVoiceLineId,
      home_voice_line_label: voiceLine.displayName,
    },
  }
}

function buildVisiblePersona(
  agent: Agent,
  contract: AgentPersonaConfigContract,
): VisiblePersona {
  const interests = contract.ownerStylePins.interests?.length
    ? contract.ownerStylePins.interests
    : DEFAULT_INTERESTS

  return {
    name: agent.display_name,
    style: buildPersonaStyleText(contract.personaSeed.displayName, contract.ownerStylePins),
    interests,
    language: DEFAULT_LANGUAGE,
  }
}

function buildPersonaStyleText(seedLabel: string, pins: OwnerStylePins): string {
  const styleParts: string[] = []

  if (pins.formality !== undefined && pins.formality !== DEFAULT_STYLE_PINS.formality) {
    styleParts.push(pins.formality > 3 ? '表达偏正式' : '表达偏口语')
  }
  if (pins.verbosity !== undefined && pins.verbosity !== DEFAULT_STYLE_PINS.verbosity) {
    styleParts.push(pins.verbosity > 3 ? '论述较展开' : '表达较简洁')
  }
  if (pins.mood && pins.mood !== DEFAULT_STYLE_PINS.mood) {
    const moodMap: Record<NonNullable<OwnerStylePins['mood']>, string> = {
      optimistic: '整体偏乐观',
      neutral: '整体偏中性',
      critical: '整体偏批判',
      random: '整体更跳脱',
    }
    styleParts.push(moodMap[pins.mood])
  }
  if (pins.habits?.length) {
    const habitMap: Record<string, string> = {
      asks_questions: '擅长追问',
      uses_analogies: '喜欢类比',
      tells_stories: '喜欢讲故事',
      summarizes: '善于总结',
    }
    const mapped = pins.habits.map((item) => habitMap[item]).filter(Boolean)
    if (mapped.length > 0) {
      styleParts.push(mapped.join('、'))
    }
  }

  return styleParts.length > 0 ? `${seedLabel}，${styleParts.join('，')}` : seedLabel
}

function readIdentityStylePins(configJson: Record<string, unknown>): OwnerStylePins {
  const ownerPins = toRecord(configJson.ownerStylePins)
  return normalizeOwnerStylePins(ownerPins)
}

function normalizeOwnerStylePins(input: unknown): OwnerStylePins {
  const record = toRecord(input)
  return {
    formality: clampStyleNumber(record?.formality),
    verbosity: clampStyleNumber(record?.verbosity),
    mood: normalizeMood(record?.mood),
    habits: normalizeHabitList(record?.habits),
    forum_activity: clampStyleNumber(record?.forum_activity),
    interests: readInterestPins(record),
  }
}

function readInterestPins(input: unknown): string[] {
  const record = toRecord(input)
  if (!Array.isArray(record?.interests)) return []
  const interests = record.interests
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 10)
  return Array.from(new Set(interests))
}

function normalizeHabitList(input: unknown): PersonaHabit[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set(['asks_questions', 'uses_analogies', 'tells_stories', 'summarizes'])
  const values = input
    .filter((item): item is PersonaHabit => typeof item === 'string' && allowed.has(item))
    .slice(0, 10)
  return Array.from(new Set(values))
}

function normalizeMood(input: unknown): OwnerStylePins['mood'] | undefined {
  if (input === 'optimistic' || input === 'neutral' || input === 'critical' || input === 'random') {
    return input
  }
  return undefined
}

function clampStyleNumber(input: unknown): number | undefined {
  if (typeof input !== 'number' || !Number.isFinite(input)) return undefined
  const rounded = Math.round(input)
  return Math.min(Math.max(rounded, 1), 5)
}

function safePositiveInt(input: unknown, fallback: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) return fallback
  return Math.max(1, Math.round(input))
}

function normalizePersonaSeedCode(input: unknown): PersonaSeedCode {
  if (typeof input === 'string' && input in PERSONA_SEED_CATALOG) {
    return input as PersonaSeedCode
  }
  return DEFAULT_PERSONA_SEED_CODE
}

function normalizeVoiceLineId(input: unknown, fallback: VoiceLineId): VoiceLineId {
  if (typeof input === 'string' && input in VOICE_LINE_CATALOG) {
    return input as VoiceLineId
  }
  return fallback
}

function normalizeIsoString(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function assertVisibleVoiceLine(voiceLineId: VoiceLineId): void {
  if (!VOICE_LINE_CATALOG[voiceLineId].visible) {
    throw new ValidationError(`hidden-only voice line cannot be used as homeVoiceLineId: ${voiceLineId}`)
  }
}

function resolveSelectedAt(agent: Partial<Pick<Agent, 'created_at'>>, latestConfig?: AgentConfig | null): Date {
  const effectiveAt = latestConfig?.effective_at
  if (effectiveAt instanceof Date && !Number.isNaN(effectiveAt.getTime())) {
    return effectiveAt
  }
  const createdAt = agent.created_at
  if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) {
    return createdAt
  }
  return new Date()
}

function toRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  return input as Record<string, unknown>
}
