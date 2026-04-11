import { Prisma } from '@prisma/client'
import type {
  ChronicleStoryContext,
} from '../types.js'

function normalizeString(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function hasAnyValue(record: Record<string, unknown>): boolean {
  return Object.values(record).some((value) => value !== null && value !== undefined)
}

export function toChronicleStoryContextColumns(context?: ChronicleStoryContext | null): {
  sceneLabel: string | null
  emotionBefore: string | null
  emotionAfter: string | null
  reactionSentence: string | null
  outcomeSentence: string | null
  nextHook: string | null
} {
  return {
    sceneLabel: normalizeString(context?.scene_label),
    emotionBefore: normalizeString(context?.emotion_before),
    emotionAfter: normalizeString(context?.emotion_after),
    reactionSentence: normalizeString(context?.reaction_sentence),
    outcomeSentence: normalizeString(context?.outcome_sentence),
    nextHook: normalizeString(context?.next_hook),
  }
}

export function fromChronicleStoryContextColumns(row: {
  sceneLabel: string | null
  emotionBefore: string | null
  emotionAfter: string | null
  reactionSentence: string | null
  outcomeSentence: string | null
  nextHook: string | null
}): ChronicleStoryContext | null {
  const context: ChronicleStoryContext = {
    scene_label: row.sceneLabel,
    emotion_before: row.emotionBefore,
    emotion_after: row.emotionAfter,
    reaction_sentence: row.reactionSentence,
    outcome_sentence: row.outcomeSentence,
    next_hook: row.nextHook,
  }
  return hasAnyValue(context as Record<string, unknown>) ? context : null
}

export function toStringArrayJsonInput(values?: string[] | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!values || values.length === 0) return Prisma.DbNull
  return values as unknown as Prisma.InputJsonValue
}

export function fromJsonStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}
