import type { TypedRetrievalState } from '../../context-memory/contracts.js'
import type { ContextMemoryRuntimeDeps } from '../memory-service.js'

const NIGHTLY_EPISODIC_KEEP = 18
const NIGHTLY_EPISODIC_DECAY = 0.92
const NIGHTLY_EPISODIC_FORGET_THRESHOLD = 0.18
const NIGHTLY_COMPACTION_LOOKBACK_DAYS = 7

export async function listAllEpisodicCards(input: {
  runtime: ContextMemoryRuntimeDeps | null | undefined
  agentId: string
}): Promise<TypedRetrievalState['privateEpisodicCards']> {
  const runtime = input.runtime
  if (!runtime) return []

  const items: TypedRetrievalState['privateEpisodicCards'] = []
  let cursor: string | undefined
  let safety = 0

  while (safety < 1000) {
    safety += 1
    const page = await runtime.episodicCardRepo.listByAgent(input.agentId, {
      cursor,
      limit: 100,
    })
    items.push(...page.items)
    if (!page.next_cursor || page.next_cursor === cursor) {
      break
    }
    cursor = page.next_cursor
  }

  return items
}

export function compactEpisodicCards(
  cards: TypedRetrievalState['privateEpisodicCards'],
  now: Date,
): {
  kept: TypedRetrievalState['privateEpisodicCards']
  prunedIds: string[]
  mergeCandidates: TypedRetrievalState['privateEpisodicCards']
} {
  const decayed = cards.map((card) => ({
    ...card,
    salience: clamp01(card.salience * episodicDecayFactor(card.created_at, now)),
  }))
  const mergeCandidates = decayed
    .filter((card) => ageDays(card.created_at, now) >= NIGHTLY_COMPACTION_LOOKBACK_DAYS)
    .filter((card) => card.salience >= 0.45)
    .sort((a, b) => b.salience - a.salience || b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 4)

  const kept = decayed
    .filter((card) => card.salience >= NIGHTLY_EPISODIC_FORGET_THRESHOLD)
    .sort((a, b) => b.salience - a.salience || b.created_at.getTime() - a.created_at.getTime())
    .slice(0, NIGHTLY_EPISODIC_KEEP)
  const keepIds = new Set(kept.map((card) => card.id))
  const prunedIds = decayed
    .filter((card) => !keepIds.has(card.id))
    .map((card) => card.id)

  return { kept, prunedIds, mergeCandidates }
}

export function buildNightlyCompactionSummary(
  cards: TypedRetrievalState['privateEpisodicCards'],
): string {
  const scenes = Array.from(
    new Set(
      cards.map((card) =>
        card.scene === 'private_chat' ? '私聊' : card.scene === 'forum' ? '论坛' : '聊天室'),
    ),
  ).join('、')
  const titles = cards.slice(0, 3).map((card) => card.title).join(' / ')
  return `夜间整理了来自${scenes}的长期经历脉络，保留了这些高信号片段：${titles}。`
}

export function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function ageDays(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
}

function episodicDecayFactor(createdAt: Date, now: Date): number {
  return Math.pow(NIGHTLY_EPISODIC_DECAY, Math.max(1, ageDays(createdAt, now)))
}
