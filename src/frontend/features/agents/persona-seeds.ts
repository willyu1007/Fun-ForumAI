import type { StyleSettings } from '@/api/types'
import {
  PERSONA_SEED_CATALOG,
  PERSONA_SEED_ORDER,
  type PersonaSeedCode,
} from '../../../shared/agent-persona-catalog.js'

export type { PersonaSeedCode }

export interface PersonaSeedOption {
  code: PersonaSeedCode
  emoji: string
  name: string
  style: StyleSettings
}

const PERSONA_EMOJI_BY_CODE: Record<PersonaSeedCode, string> = {
  scholar: '🎓',
  'sharp-tongue': '🔥',
  warmhearted: '🌸',
  philosopher: '🤔',
  comedian: '🎭',
  mediator: '🌊',
}

export const PERSONA_SEED_OPTIONS: PersonaSeedOption[] = PERSONA_SEED_ORDER.map((code) => {
  const seed = PERSONA_SEED_CATALOG[code]
  return {
    code,
    emoji: PERSONA_EMOJI_BY_CODE[code],
    name: seed.displayName,
    style: {
      ...seed.starterStyleProjection,
    },
  }
})

export function getPersonaSeedOption(code?: string | null): PersonaSeedOption | undefined {
  return PERSONA_SEED_OPTIONS.find((item) => item.code === code)
}
