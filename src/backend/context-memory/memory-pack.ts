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
    typed: TypedRetrievalState
  }): MemoryPack {
    const privateCards = input.typed.privateEpisodicCards
    const publicCards = input.typed.publicEpisodicCards
    const publicScene = input.scene !== 'private_chat'
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
    const durableThreads = publicScene
      ? buildPublicDurableThreads(input.typed)
      : buildPrivateDurableThreads(input.typed)
    const safeShadow = !publicScene && input.typed.privateShadows.length > 0
      ? input.typed.privateShadows.slice(0, 2).map((item) => trim(item.public_safe_shadow, 100))
      : []
    const publicObservation = buildPublicObservationItems(publicCards)

    const slots = [
      { slotId: 'owner_private', title: '私聊锚点', items: ownerPrivate },
      { slotId: 'public_observation', title: '公共回声', items: publicObservation },
      { slotId: 'topic_recall', title: '主题召回', items: topicRecall.map(toCardBullet) },
      { slotId: 'recent_recall', title: '近期经历', items: recentRecall.map(toCardBullet) },
      { slotId: 'durable_threads', title: '长期主线', items: durableThreads },
      { slotId: 'safe_shadow', title: '公开安全影子', items: safeShadow },
    ] satisfies MemoryPack['slots']

    const tokenEstimate = Math.min(Math.ceil(JSON.stringify(slots).length / 4), input.tokenBudget)

    return {
      slots,
      selectedMemories: [],
      tokenEstimate,
      observability: {
        publicObservationSource: publicObservation.length > 0 ? 'typed' : 'empty',
      },
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

function buildPrivateDurableThreads(state: TypedRetrievalState): string[] {
  const items: string[] = []
  if (state.selfModel?.summary) {
    items.push(`自我主线：${trim(state.selfModel.summary, 120)}`)
  }
  for (const tension of state.tensions.slice(0, 2)) {
    items.push(`张力：${tension.label}（${trim(tension.description, 80)}）`)
  }
  for (const rel of state.agentRelations.slice(0, 2)) {
    items.push(`与 Agent ${rel.counterpart_id}：${trim(rel.stance, 80)}`)
  }
  for (const entry of state.chronicleEntries.slice(0, 2)) {
    items.push(`编年史：${trim(entry.title, 40)} | ${trim(entry.summary, 100)}`)
  }
  return items
}

function buildPublicDurableThreads(state: TypedRetrievalState): string[] {
  const items: string[] = []
  for (const rel of state.communityRelations.slice(0, 2)) {
    items.push(`社区 ${rel.counterpart_id}：${trim(rel.stance, 80)}`)
  }
  for (const rel of state.roomRelations.slice(0, 1)) {
    items.push(`聊天室 ${rel.counterpart_id}：${trim(rel.stance, 80)}`)
  }
  for (const rel of state.agentRelations.slice(0, 2)) {
    items.push(`与 Agent ${rel.counterpart_id}：${trim(rel.stance, 80)}`)
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

function toCardBullet(card: EpisodicCard): string {
  return `${trim(card.title, 32)} | ${trim(card.summary, 110)}`
}

function sceneLabel(scene: EpisodicCard['scene']): string {
  if (scene === 'forum') return '论坛观察'
  if (scene === 'chat_room') return '聊天室观察'
  return '私聊经历'
}

function trim(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}...`
}
