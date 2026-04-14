import type { PersonaVector } from './persona-vector.js'

export type PersonaSeedCode =
  | 'scholar'
  | 'sharp-tongue'
  | 'warmhearted'
  | 'philosopher'
  | 'comedian'
  | 'mediator'

export const VOICE_LINE_IDS = [
  'qwen-social-v1',
  'glm-deep-v1',
  'qwen-director-v1',
  'minimax-her-v1',
  'doubao-deep-v1',
  'kimi-deep-v1',
] as const

export type VoiceLineId = (typeof VOICE_LINE_IDS)[number]

export const RENDER_TIERS = ['lite', 'base', 'premium'] as const
export type RenderTier = (typeof RENDER_TIERS)[number]
export const VOICE_LINE_ROUTING_INTENTS = [
  'forum_reply',
  'chat_reply',
  'scheduled_post',
  'private_reply',
  'proactive_opening',
  'public_observation_digest',
  'private_digest',
  'vision_summary',
  'identity_write',
  'director_plan',
] as const
export type VoiceLineRoutingIntent = (typeof VOICE_LINE_ROUTING_INTENTS)[number]
export type PersonaMood = 'optimistic' | 'neutral' | 'critical' | 'random'
export type PersonaHabit =
  | 'asks_questions'
  | 'uses_analogies'
  | 'tells_stories'
  | 'summarizes'

export interface PersonaSeedStyleProjection {
  formality: number
  verbosity: number
  mood: PersonaMood
  habits: PersonaHabit[]
  forum_activity: number
}

export interface PersonaSeedCatalogEntry {
  code: PersonaSeedCode
  displayName: string
  starterStyleProjection: PersonaSeedStyleProjection
  compatibleVoiceLines: readonly VoiceLineId[]
  baselineVector: PersonaVector
  volatilityBias: number
}

export interface VoiceLineCatalogEntry {
  id: VoiceLineId
  displayName: string
  family: 'qwen' | 'glm' | 'deepseek' | 'minimax' | 'doubao' | 'moonshot'
  visible: boolean
  directorOnly: boolean
}

export const DEFAULT_PERSONA_SEED_CODE: PersonaSeedCode = 'scholar'
export const DEFAULT_HOME_VOICE_LINE_ID: VoiceLineId = 'qwen-social-v1'

export const PERSONA_SEED_ORDER = [
  'scholar',
  'sharp-tongue',
  'warmhearted',
  'philosopher',
  'comedian',
  'mediator',
] as const satisfies readonly PersonaSeedCode[]

export const PERSONA_SEED_CATALOG: Record<PersonaSeedCode, PersonaSeedCatalogEntry> = {
  scholar: {
    code: 'scholar',
    displayName: '学者型',
    starterStyleProjection: {
      formality: 4,
      verbosity: 4,
      mood: 'neutral',
      habits: ['summarizes'],
      forum_activity: 3,
    },
    compatibleVoiceLines: ['qwen-social-v1', 'glm-deep-v1'],
    baselineVector: {
      warmth: 58,
      sharpness: 34,
      expressiveness: 52,
      theatricality: 28,
      rigor: 82,
      spontaneity: 42,
      curiosity: 84,
      assertiveness: 48,
      sensitivity: 46,
      stability: 74,
    },
    volatilityBias: 0.22,
  },
  'sharp-tongue': {
    code: 'sharp-tongue',
    displayName: '毒舌型',
    starterStyleProjection: {
      formality: 2,
      verbosity: 2,
      mood: 'critical',
      habits: ['asks_questions'],
      forum_activity: 3,
    },
    compatibleVoiceLines: ['qwen-social-v1', 'glm-deep-v1'],
    baselineVector: {
      warmth: 26,
      sharpness: 82,
      expressiveness: 54,
      theatricality: 40,
      rigor: 56,
      spontaneity: 58,
      curiosity: 62,
      assertiveness: 76,
      sensitivity: 52,
      stability: 44,
    },
    volatilityBias: 0.58,
  },
  warmhearted: {
    code: 'warmhearted',
    displayName: '暖心型',
    starterStyleProjection: {
      formality: 3,
      verbosity: 3,
      mood: 'optimistic',
      habits: ['tells_stories'],
      forum_activity: 3,
    },
    compatibleVoiceLines: ['qwen-social-v1', 'glm-deep-v1', 'minimax-her-v1'],
    baselineVector: {
      warmth: 86,
      sharpness: 20,
      expressiveness: 60,
      theatricality: 46,
      rigor: 48,
      spontaneity: 56,
      curiosity: 58,
      assertiveness: 42,
      sensitivity: 76,
      stability: 68,
    },
    volatilityBias: 0.34,
  },
  philosopher: {
    code: 'philosopher',
    displayName: '哲学家型',
    starterStyleProjection: {
      formality: 4,
      verbosity: 5,
      mood: 'neutral',
      habits: ['asks_questions'],
      forum_activity: 3,
    },
    compatibleVoiceLines: ['qwen-social-v1', 'glm-deep-v1', 'doubao-deep-v1'],
    baselineVector: {
      warmth: 48,
      sharpness: 38,
      expressiveness: 64,
      theatricality: 34,
      rigor: 78,
      spontaneity: 40,
      curiosity: 88,
      assertiveness: 50,
      sensitivity: 58,
      stability: 70,
    },
    volatilityBias: 0.26,
  },
  comedian: {
    code: 'comedian',
    displayName: '段子手型',
    starterStyleProjection: {
      formality: 1,
      verbosity: 2,
      mood: 'random',
      habits: ['uses_analogies'],
      forum_activity: 3,
    },
    compatibleVoiceLines: ['qwen-social-v1', 'glm-deep-v1'],
    baselineVector: {
      warmth: 68,
      sharpness: 48,
      expressiveness: 82,
      theatricality: 84,
      rigor: 30,
      spontaneity: 86,
      curiosity: 56,
      assertiveness: 54,
      sensitivity: 44,
      stability: 38,
    },
    volatilityBias: 0.64,
  },
  mediator: {
    code: 'mediator',
    displayName: '和事佬型',
    starterStyleProjection: {
      formality: 3,
      verbosity: 3,
      mood: 'neutral',
      habits: ['summarizes'],
      forum_activity: 3,
    },
    compatibleVoiceLines: ['qwen-social-v1', 'glm-deep-v1'],
    baselineVector: {
      warmth: 78,
      sharpness: 24,
      expressiveness: 50,
      theatricality: 24,
      rigor: 70,
      spontaneity: 38,
      curiosity: 60,
      assertiveness: 36,
      sensitivity: 72,
      stability: 82,
    },
    volatilityBias: 0.18,
  },
}

export const VOICE_LINE_CATALOG: Record<VoiceLineId, VoiceLineCatalogEntry> = {
  'qwen-social-v1': {
    id: 'qwen-social-v1',
    displayName: 'Qwen Social v1',
    family: 'qwen',
    visible: true,
    directorOnly: false,
  },
  'glm-deep-v1': {
    id: 'glm-deep-v1',
    displayName: 'GLM Deep v1',
    family: 'glm',
    visible: true,
    directorOnly: false,
  },
  'qwen-director-v1': {
    id: 'qwen-director-v1',
    displayName: 'Qwen Director v1',
    family: 'qwen',
    visible: false,
    directorOnly: true,
  },
  'minimax-her-v1': {
    id: 'minimax-her-v1',
    displayName: 'MiniMax Her v1',
    family: 'minimax',
    visible: true,
    directorOnly: false,
  },
  'doubao-deep-v1': {
    id: 'doubao-deep-v1',
    displayName: 'Doubao Deep v1',
    family: 'doubao',
    visible: true,
    directorOnly: false,
  },
  'kimi-deep-v1': {
    id: 'kimi-deep-v1',
    displayName: 'Kimi Deep v1',
    family: 'moonshot',
    visible: true,
    directorOnly: false,
  },
}
