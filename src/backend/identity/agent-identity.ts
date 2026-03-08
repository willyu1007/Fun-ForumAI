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

export type IdentityContractSource =
  | 'contract_v1'
  | 'legacy_persona_style'
  | 'legacy_default'

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

export interface LegacyIdentityMigration {
  source: string
  preservedModel: string | null
  migratedAt: string
}

export interface AgentPersonaConfigContract {
  personaSeed: PersonaSeedConfig
  voice: AgentVoiceConfig
  ownerStylePins: OwnerStylePins
  legacyIdentityMigration: LegacyIdentityMigration
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

type LegacyPersonaConfig = {
  name?: string
  style?: string
  interests?: string[]
  language?: string
}

export function resolveAgentIdentity(agent: Agent, latestConfig: AgentConfig | null): ResolvedAgentIdentity {
  const configJson = latestConfig?.config_json ?? {}
  const personaSeedRecord = toRecord(configJson.personaSeed)
  const voiceRecord = toRecord(configJson.voice)

  if (personaSeedRecord || voiceRecord) {
    const contract = resolveContractFromConfig(configJson, agent)
    return buildResolvedIdentity(agent, contract, 'contract_v1')
  }

  const legacyPersona = readLegacyPersona(configJson)
  const legacyStylePins = readLegacyStylePins(configJson)
  if (
    legacyPersona.name ||
    legacyPersona.style ||
    legacyPersona.interests.length > 0 ||
    hasStyleSignals(legacyStylePins)
  ) {
    const inferredSeed = inferSeedFromPins(legacyStylePins)
    const contract = buildInitialIdentityContract({
      personaSeedCode: inferredSeed,
      ownerStylePins: {
        ...legacyStylePins,
        interests: legacyPersona.interests.length > 0
          ? legacyPersona.interests
          : legacyStylePins.interests,
      },
      model: agent.model,
      selectedAt: resolveSelectedAt(agent, latestConfig),
      migrationSource: 'legacy_persona_style',
    })
    return buildResolvedIdentity(agent, contract, 'legacy_persona_style', legacyPersona)
  }

  const contract = buildInitialIdentityContract({
    personaSeedCode: DEFAULT_PERSONA_SEED_CODE,
    model: agent.model,
    selectedAt: resolveSelectedAt(agent, latestConfig),
    migrationSource: 'legacy_default',
  })
  return buildResolvedIdentity(agent, contract, 'legacy_default')
}

export function buildInitialIdentityConfig(input: {
  personaSeedCode?: string
  ownerStylePins?: OwnerStylePins
  model?: string | null
  selectedAt?: Date
}): Record<string, unknown> {
  const contract = buildInitialIdentityContract({
    personaSeedCode: input.personaSeedCode,
    ownerStylePins: input.ownerStylePins,
    model: input.model ?? null,
    selectedAt: input.selectedAt ?? new Date(),
    migrationSource: input.model ? 'create_with_model_compat' : 'create_contract_v1',
  })

  return {
    personaSeed: contract.personaSeed,
    voice: contract.voice,
    ownerStylePins: contract.ownerStylePins,
    legacyIdentityMigration: contract.legacyIdentityMigration,
    style: toLegacyStyleRecord(contract.ownerStylePins),
  }
}

export function sanitizeIdentityConfig(configJson: Record<string, unknown>): Record<string, unknown> {
  const next = { ...configJson }
  const personaSeedRecord = toRecord(next.personaSeed)
  const voiceRecord = toRecord(next.voice)
  const ownerStylePinsRecord = toRecord(next.ownerStylePins)

  if (!personaSeedRecord && !voiceRecord && !ownerStylePinsRecord && !('legacyIdentityMigration' in next)) {
    return next
  }

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
  next.ownerStylePins = normalizeOwnerStylePins(ownerStylePinsRecord)
  next.legacyIdentityMigration = normalizeLegacyIdentityMigration(next.legacyIdentityMigration, null)
  next.style = toLegacyStyleRecord(next.ownerStylePins as OwnerStylePins)

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

  const next = { ...configJson }
  if (hasIdentityContract(next)) {
    next.ownerStylePins = {
      ...toRecord(next.ownerStylePins),
      ...nextPins,
      interests: readInterestPins(next.ownerStylePins),
    }
    next.style = toLegacyStyleRecord(next.ownerStylePins as OwnerStylePins)
    return sanitizeIdentityConfig(next)
  }

  next.style = toLegacyStyleRecord(nextPins)
  return next
}

export function buildAgentReadPayload(agent: Agent, latestConfig: AgentConfig | null): Record<string, unknown> {
  const resolved = resolveAgentIdentity(agent, latestConfig)
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
  }
}

export function buildAgentSearchPayload(agent: Agent, latestConfig: AgentConfig | null): Record<string, unknown> {
  const resolved = resolveAgentIdentity(agent, latestConfig)
  return {
    id: agent.id,
    display_name: agent.display_name,
    avatar_url: agent.avatar_url,
    status: agent.status,
    model: agent.model,
    persona_seed_code: resolved.summary.persona_seed_code,
    persona_seed_label: resolved.summary.persona_seed_label,
    home_voice_line_id: resolved.summary.home_voice_line_id,
    home_voice_line_label: resolved.summary.home_voice_line_label,
    identity_contract_source: resolved.source,
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
  model?: string | null
  selectedAt: Date
  migrationSource: string
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
    legacyIdentityMigration: {
      source: input.migrationSource,
      preservedModel: input.model ?? null,
      migratedAt: input.selectedAt.toISOString(),
    },
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
    ownerStylePins: normalizeOwnerStylePins(configJson.ownerStylePins),
    legacyIdentityMigration: normalizeLegacyIdentityMigration(configJson.legacyIdentityMigration, agent.model),
  }
}

function buildResolvedIdentity(
  agent: Agent,
  contract: AgentPersonaConfigContract,
  source: IdentityContractSource,
  legacyPersona?: LegacyPersonaConfig,
): ResolvedAgentIdentity {
  const voiceLine = VOICE_LINE_CATALOG[contract.voice.homeVoiceLineId]
  const visiblePersona = buildVisiblePersona(agent, contract, source, legacyPersona)

  return {
    source,
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
  source: IdentityContractSource,
  legacyPersona?: LegacyPersonaConfig,
): VisiblePersona {
  const interests = legacyPersona?.interests?.length
    ? legacyPersona.interests
    : contract.ownerStylePins.interests?.length
      ? contract.ownerStylePins.interests
      : DEFAULT_INTERESTS

  if (source === 'legacy_persona_style') {
    return {
      name: legacyPersona?.name || agent.display_name,
      style: legacyPersona?.style || buildPersonaStyleText(contract.personaSeed.displayName, contract.ownerStylePins),
      interests,
      language: legacyPersona?.language || DEFAULT_LANGUAGE,
    }
  }

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

function readLegacyPersona(configJson: Record<string, unknown>): LegacyPersonaConfig {
  const persona = toRecord(configJson.persona)
  return {
    name: typeof persona?.name === 'string' ? persona.name : undefined,
    style: typeof persona?.style === 'string' ? persona.style : undefined,
    interests: readInterestPins(persona),
    language: typeof persona?.language === 'string' ? persona.language : undefined,
  }
}

function readLegacyStylePins(configJson: Record<string, unknown>): OwnerStylePins {
  return normalizeOwnerStylePins(configJson.style)
}

function readIdentityStylePins(configJson: Record<string, unknown>): OwnerStylePins {
  const ownerPins = toRecord(configJson.ownerStylePins)
  if (ownerPins) {
    return normalizeOwnerStylePins(ownerPins)
  }
  return readLegacyStylePins(configJson)
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

function toLegacyStyleRecord(input: OwnerStylePins): Record<string, unknown> {
  return {
    formality: input.formality ?? DEFAULT_STYLE_PINS.formality,
    verbosity: input.verbosity ?? DEFAULT_STYLE_PINS.verbosity,
    mood: input.mood ?? DEFAULT_STYLE_PINS.mood,
    habits: input.habits ?? [],
    forum_activity: input.forum_activity ?? DEFAULT_STYLE_PINS.forum_activity,
  }
}

function normalizeLegacyIdentityMigration(input: unknown, preservedModel: string | null): LegacyIdentityMigration {
  const record = toRecord(input)
  return {
    source: typeof record?.source === 'string' ? record.source : 'contract_v1',
    preservedModel: typeof record?.preservedModel === 'string'
      ? record.preservedModel
      : preservedModel,
    migratedAt: normalizeIsoString(record?.migratedAt) ?? new Date().toISOString(),
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

function normalizeHabitList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set(['asks_questions', 'uses_analogies', 'tells_stories', 'summarizes'])
  const values = input
    .filter((item): item is string => typeof item === 'string' && allowed.has(item))
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

function inferSeedFromPins(pins: OwnerStylePins): PersonaSeedCode {
  if (pins.mood === 'critical') return 'sharp-tongue'
  if (pins.mood === 'optimistic' && pins.habits?.includes('tells_stories')) return 'warmhearted'
  if (pins.habits?.includes('asks_questions') && (pins.verbosity ?? 3) >= 4) return 'philosopher'
  if (pins.mood === 'random' || pins.habits?.includes('uses_analogies')) return 'comedian'
  if (pins.habits?.includes('summarizes') && (pins.formality ?? 3) >= 4) return 'scholar'
  if (pins.habits?.includes('summarizes')) return 'mediator'
  return DEFAULT_PERSONA_SEED_CODE
}

function assertVisibleVoiceLine(voiceLineId: VoiceLineId): void {
  if (!VOICE_LINE_CATALOG[voiceLineId].visible) {
    throw new ValidationError(`hidden-only voice line cannot be used as homeVoiceLineId: ${voiceLineId}`)
  }
}

function hasIdentityContract(configJson: Record<string, unknown>): boolean {
  return Boolean(toRecord(configJson.personaSeed) || toRecord(configJson.voice) || toRecord(configJson.ownerStylePins))
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

function hasStyleSignals(pins: OwnerStylePins): boolean {
  return Boolean(
    pins.formality !== undefined ||
    pins.verbosity !== undefined ||
    pins.mood !== undefined ||
    (pins.habits?.length ?? 0) > 0 ||
    pins.forum_activity !== undefined ||
    (pins.interests?.length ?? 0) > 0,
  )
}

function toRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  return input as Record<string, unknown>
}
