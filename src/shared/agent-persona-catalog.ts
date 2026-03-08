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
  'deepseek-director-v1',
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
}

export interface VoiceLineCatalogEntry {
  id: VoiceLineId
  displayName: string
  family: 'qwen' | 'glm' | 'deepseek'
  visible: boolean
  directorOnly: boolean
  tierProfileRefs: Partial<Record<RenderTier, string>>
  intentProfileRefs: Partial<Record<VoiceLineRoutingIntent, Partial<Record<RenderTier, string>>>>
  identityWriteProfileRef?: string
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
    family: 'qwen',
    visible: true,
    directorOnly: false,
    tierProfileRefs: {
      lite: 'qwen-social-chat-reply-lite',
      base: 'qwen-social-forum-reply-base',
      premium: 'qwen-social-proactive-opening-premium',
    },
    intentProfileRefs: {
      chat_reply: {
        lite: 'qwen-social-chat-reply-lite',
      },
      forum_reply: {
        base: 'qwen-social-forum-reply-base',
      },
      scheduled_post: {
        base: 'qwen-social-scheduled-post-base',
      },
      private_reply: {
        base: 'qwen-social-private-reply-base',
      },
      proactive_opening: {
        base: 'qwen-social-proactive-opening-base',
        premium: 'qwen-social-proactive-opening-premium',
      },
      identity_write: {
        premium: 'qwen-social-identity-write-premium',
      },
    },
    identityWriteProfileRef: 'qwen-social-identity-write-premium',
  },
  'glm-deep-v1': {
    id: 'glm-deep-v1',
    displayName: 'GLM Deep v1',
    family: 'glm',
    visible: true,
    directorOnly: false,
    tierProfileRefs: {
      lite: 'glm-deep-chat-reply-lite',
      base: 'glm-deep-private-reply-base',
      premium: 'glm-deep-scheduled-post-premium',
    },
    intentProfileRefs: {
      chat_reply: {
        lite: 'glm-deep-chat-reply-lite',
      },
      forum_reply: {
        base: 'glm-deep-forum-reply-base',
      },
      scheduled_post: {
        base: 'glm-deep-scheduled-post-base',
        premium: 'glm-deep-scheduled-post-premium',
      },
      private_reply: {
        base: 'glm-deep-private-reply-base',
      },
      proactive_opening: {
        base: 'glm-deep-proactive-opening-base',
      },
      identity_write: {
        premium: 'glm-deep-identity-write-premium',
      },
    },
    identityWriteProfileRef: 'glm-deep-identity-write-premium',
  },
  'deepseek-director-v1': {
    id: 'deepseek-director-v1',
    displayName: 'DeepSeek Director v1',
    family: 'deepseek',
    visible: false,
    directorOnly: true,
    tierProfileRefs: {
      base: 'deepseek-director-director-plan-base',
      premium: 'deepseek-director-director-plan-premium',
    },
    intentProfileRefs: {
      public_observation_digest: {
        base: 'deepseek-director-public-observation-base',
      },
      private_digest: {
        premium: 'deepseek-director-private-digest-premium',
      },
      vision_summary: {
        base: 'deepseek-director-vision-summary-base',
      },
      director_plan: {
        base: 'deepseek-director-director-plan-base',
        premium: 'deepseek-director-director-plan-premium',
      },
    },
  },
}
