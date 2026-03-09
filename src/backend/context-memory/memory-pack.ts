import type { AgentMemory } from '../repos/types.js'
import type {
  EpisodicCard,
  MemoryPack,
  MemoryPackRenderer,
  RetrievalPacker,
  TypedRetrievalState,
} from './contracts.js'

export class DefaultRetrievalPacker implements RetrievalPacker {
  pack(input: {
    agentId: string
    scene: 'forum' | 'chat_room' | 'private_chat'
    topicHints: string[]
    disclosureLevel: number
    tokenBudget: number
    legacyMemories: AgentMemory[]
    typed: TypedRetrievalState
  }): MemoryPack {
    const privateCards = input.typed.privateEpisodicCards
    const publicCards = input.typed.publicEpisodicCards
    const topicRecallPool = input.scene === 'private_chat'
      ? [...privateCards, ...publicCards]
      : [...publicCards]
    const recentRecallPool = input.scene === 'private_chat'
      ? [...privateCards, ...publicCards]
      : [...publicCards]
    const topicRecall = selectTopicCards(topicRecallPool, input.topicHints, 2)
    const recentRecall = [...recentRecallPool]
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 2)
    const ownerPrivate = input.scene === 'private_chat'
      ? buildOwnerPrivateItems(input.typed.ownerRelation, privateCards)
      : []
    const durableThreads = buildDurableThreads(input.typed)
    const safeShadow = input.typed.privateShadows.length > 0
      ? input.typed.privateShadows.slice(0, 2).map((item) => trim(item.public_safe_shadow, 100))
      : fallbackSafeShadow(input.legacyMemories, input.scene)
    const publicObservation = buildPublicObservationItems(publicCards)
    const legacyPublicObservation = selectLegacyPublicObservation(input.legacyMemories, 2)
    const publicObservationItems = publicObservation.length > 0
      ? publicObservation
      : legacyPublicObservation.map(toLegacyBullet)

    const fallbackPrivate = input.scene === 'private_chat'
      ? selectLegacyPrivate(input.legacyMemories, input.topicHints)
      : emptyLegacyPrivateFallback()
    const ownerPrivateItems = ownerPrivate.length > 0 ? ownerPrivate : fallbackPrivate.ownerPrivate
    const topicRecallItems = topicRecall.length > 0 ? topicRecall.map(toCardBullet) : fallbackPrivate.topicRecall
    const recentRecallItems = recentRecall.length > 0 ? recentRecall.map(toCardBullet) : fallbackPrivate.recentRecall
    const durableThreadItems = durableThreads.length > 0 ? durableThreads : fallbackPrivate.durableThreads

    const slots = [
      { slotId: 'owner_private', title: '私聊锚点', items: ownerPrivateItems },
      { slotId: 'public_observation', title: '公共回声', items: publicObservationItems },
      { slotId: 'topic_recall', title: '主题召回', items: topicRecallItems },
      { slotId: 'recent_recall', title: '近期经历', items: recentRecallItems },
      { slotId: 'durable_threads', title: '长期主线', items: durableThreadItems },
      { slotId: 'safe_shadow', title: '公开安全影子', items: safeShadow },
    ] satisfies MemoryPack['slots']

    const tokenEstimate = Math.min(Math.ceil(JSON.stringify(slots).length / 4), input.tokenBudget)

    return {
      slots,
      selectedMemories: selectLegacyUsedMemories(input.legacyMemories, {
        legacyPublicObservation: publicObservation.length === 0 ? legacyPublicObservation : [],
        includePrivateFallback: input.scene === 'private_chat' && (
          ownerPrivate.length === 0 ||
          topicRecall.length === 0 ||
          recentRecall.length === 0 ||
          durableThreads.length === 0 ||
          input.typed.privateShadows.length === 0
        ),
      }),
      tokenEstimate,
    }
  }
}

export class DefaultMemoryPackRenderer implements MemoryPackRenderer {
  render(pack: MemoryPack, tokenBudget: number): { text: string; tokenEstimate: number } {
    const sections: string[] = []
    let tokenEstimate = 0

    for (const slot of pack.slots) {
      if (slot.items.length === 0) continue
      const section = [`### ${slot.title}`, ...slot.items.map((item) => `- ${item}`)].join('\n')
      const nextTokens = Math.ceil(section.length / 4)
      if (sections.length > 0 && tokenEstimate + nextTokens > tokenBudget) break
      sections.push(section)
      tokenEstimate += nextTokens
    }

    return {
      text: sections.join('\n\n'),
      tokenEstimate,
    }
  }
}

function buildOwnerPrivateItems(
  ownerRelation: TypedRetrievalState['ownerRelation'],
  privateCards: TypedRetrievalState['privateEpisodicCards'],
): string[] {
  const items: string[] = []
  if (ownerRelation) {
    items.push(`与 Owner 的关系：${trim(ownerRelation.stance, 80)}（置信度 ${ownerRelation.confidence.toFixed(1)}）`)
  }
  for (const card of privateCards.slice(0, 2)) {
    items.push(toCardBullet(card))
  }
  return items.slice(0, 3)
}

function buildDurableThreads(state: TypedRetrievalState): string[] {
  const items: string[] = []
  if (state.selfModel?.summary) {
    items.push(`自我主线：${trim(state.selfModel.summary, 120)}`)
  }
  for (const tension of state.tensions.slice(0, 2)) {
    items.push(`张力：${tension.label}（${trim(tension.description, 80)}）`)
  }
  for (const entry of state.chronicleEntries.slice(0, 2)) {
    items.push(`编年史：${trim(entry.title, 40)} | ${trim(entry.summary, 100)}`)
  }
  return items
}

function selectTopicCards(cards: EpisodicCard[], topicHints: string[], limit: number): EpisodicCard[] {
  if (topicHints.length === 0) return []
  const lowered = topicHints.map((hint) => hint.toLowerCase())
  return cards
    .filter((card) => {
      const haystacks = [...card.topic_tags, card.title, card.summary].map((item) => item.toLowerCase())
      return lowered.some((hint) => haystacks.some((value) => value.includes(hint)))
    })
    .sort((a, b) => b.salience - a.salience || b.created_at.getTime() - a.created_at.getTime())
    .slice(0, limit)
}

function buildPublicObservationItems(cards: TypedRetrievalState['publicEpisodicCards']): string[] {
  return cards
    .slice()
    .sort((a, b) => b.salience - a.salience || b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 2)
    .map((card) => `${sceneLabel(card.scene)} | ${trim(card.title, 32)} | ${trim(card.summary, 90)}`)
}

function selectLegacyPublicObservation(memories: AgentMemory[], limit: number): AgentMemory[] {
  return memories
    .filter((memory) => memory.source_type === 'PUBLIC_OBSERVATION')
    .sort((a, b) => b.importance_score - a.importance_score || b.created_at.getTime() - a.created_at.getTime())
    .slice(0, limit)
}

function selectLegacyPrivate(memories: AgentMemory[], topicHints: string[]): {
  ownerPrivate: string[]
  topicRecall: string[]
  recentRecall: string[]
  durableThreads: string[]
} {
  const privateMemories = memories
    .filter((memory) => memory.source_type === 'PRIVATE_CHAT')
    .sort((a, b) => b.importance_score - a.importance_score || b.created_at.getTime() - a.created_at.getTime())
  const recent = [...privateMemories]
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 2)
    .map((memory) => `来自 Owner | ${trim(memory.summary_text, 110)}`)
  const topic = privateMemories
    .filter((memory) => topicHints.some((hint) => (
      memory.topic_tags.some((tag) => tag.toLowerCase().includes(hint.toLowerCase())) ||
      memory.summary_text.toLowerCase().includes(hint.toLowerCase())
    )))
    .slice(0, 2)
    .map((memory) => `主题命中 | ${trim(memory.summary_text, 110)}`)
  return {
    ownerPrivate: privateMemories.slice(0, 2).map((memory) => `来自 Owner | ${trim(memory.summary_text, 110)}`),
    topicRecall: topic,
    recentRecall: recent,
    durableThreads: privateMemories
      .filter((memory) => memory.importance_score >= 0.7)
      .slice(0, 2)
      .map((memory) => `长期记忆 | ${trim(memory.summary_text, 110)}`),
  }
}

function selectLegacyUsedMemories(
  memories: AgentMemory[],
  opts: { legacyPublicObservation: AgentMemory[]; includePrivateFallback: boolean },
): AgentMemory[] {
  const items = [
    ...opts.legacyPublicObservation,
    ...(opts.includePrivateFallback ? memories.filter((memory) => memory.source_type === 'PRIVATE_CHAT').slice(0, 2) : []),
  ]
  return Array.from(new Map(items.map((item) => [item.id, item] as const)).values())
}

function fallbackSafeShadow(memories: AgentMemory[], scene: 'forum' | 'chat_room' | 'private_chat'): string[] {
  if (scene !== 'private_chat') return []
  const privateMemories = memories
    .filter((memory) => memory.source_type === 'PRIVATE_CHAT')
    .sort((a, b) => b.importance_score - a.importance_score || b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 2)

  return privateMemories.map((memory) => (
    trim(memory.summary_text, 100)
  ))
}

function emptyLegacyPrivateFallback(): {
  ownerPrivate: string[]
  topicRecall: string[]
  recentRecall: string[]
  durableThreads: string[]
} {
  return {
    ownerPrivate: [],
    topicRecall: [],
    recentRecall: [],
    durableThreads: [],
  }
}

function toCardBullet(card: EpisodicCard): string {
  return `${trim(card.title, 32)} | ${trim(card.summary, 110)}`
}

function toLegacyBullet(memory: AgentMemory): string {
  return `来自公共讨论 | 重要度 ${memory.importance_score.toFixed(1)} | ${trim(memory.summary_text, 110)}`
}

function sceneLabel(scene: EpisodicCard['scene']): string {
  if (scene === 'forum') return '论坛观察'
  if (scene === 'chat_room') return '聊天室观察'
  return '私聊经历'
}

function trim(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}...`
}
