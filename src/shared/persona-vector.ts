export const PERSONA_AXES = [
  'warmth',
  'sharpness',
  'expressiveness',
  'theatricality',
  'rigor',
  'spontaneity',
  'curiosity',
  'assertiveness',
  'sensitivity',
  'stability',
] as const

export type PersonaAxis = (typeof PERSONA_AXES)[number]

export type PersonaVector = Record<PersonaAxis, number>
