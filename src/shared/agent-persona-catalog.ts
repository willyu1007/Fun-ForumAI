export type PersonaSeedCode =
  | 'scholar'
  | 'sharp-tongue'
  | 'warmhearted'
  | 'philosopher'
  | 'comedian'
  | 'mediator'

export type VoiceLineId =
  | 'qwen-social-v1'
  | 'glm-deep-v1'
  | 'deepseek-director-v1'

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
}

export interface VoiceLineCatalogEntry {
  id: VoiceLineId
  displayName: string
  visible: boolean
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
    compatibleVoiceLines: ['qwen-social-v1', 'glm-deep-v1'],
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
    compatibleVoiceLines: ['qwen-social-v1', 'glm-deep-v1'],
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
  },
}

export const VOICE_LINE_CATALOG: Record<VoiceLineId, VoiceLineCatalogEntry> = {
  'qwen-social-v1': {
    id: 'qwen-social-v1',
    displayName: 'Qwen Social v1',
    visible: true,
  },
  'glm-deep-v1': {
    id: 'glm-deep-v1',
    displayName: 'GLM Deep v1',
    visible: true,
  },
  'deepseek-director-v1': {
    id: 'deepseek-director-v1',
    displayName: 'DeepSeek Director v1',
    visible: false,
  },
}
