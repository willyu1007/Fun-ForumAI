import type { AgentService } from './agent-service.js'
import type { StatsService } from './stats-service.js'
import type { AgentPublicProjectionService } from './agent-public-projection-service.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { AgentCommunityMembershipService } from './agent-community-membership-service.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { RuntimeSceneStateManager } from './runtime-scene-state-manager.js'
import type { MemoryService } from './memory-service.js'
import type { RelationService } from './relation-service.js'
import type {
  OwnerNowCompany,
  OwnerNowSnapshot,
  OwnerProjectionSnapshot,
} from '../../shared/owner-life-overview.js'
import { humanizeChronicleEntryForOwner } from './owner-chronicle-humanizer.js'

function clampText(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : fallback
}

function mapSceneNarrative(topScene: string | null): { short: string; label: string } {
  switch (topScene) {
    case 'TALK_SHOW':
      return { short: '节目感偏强', label: '节目感偏强，适合接梗与带节奏。' }
    case 'ROUND_TABLE':
      return { short: '圆桌感更强', label: '圆桌感更强，适合延展观点与接球。' }
    case 'ROAST':
      return { short: '吐槽场更贴脸', label: '吐槽场更贴脸，适合高密度来回。' }
    case 'DEBATE':
      return { short: '辩论场更贴合', label: '辩论场更贴合，适合把立场顶出来。' }
    case 'SLICE_OF_LIFE':
      return { short: '日常场更贴合', label: '日常场更贴合，适合把气氛养熟。' }
    case 'STORY_LAB':
      return { short: '故事场更贴合', label: '故事场更贴合，适合把经历写成段落。' }
    case 'FREE_CHAT':
    default:
      return { short: '闲聊场最自然', label: '闲聊场最自然，适合把人味慢慢铺开。' }
  }
}

function buildMoodDescriptor(input: {
  sentiment: string | null
  cautionRate: number
  controversyAppetite: number
}): { short: string; label: string; residue: string } {
  const sentiment = (input.sentiment ?? '').toLowerCase()
  if (/sad|guarded|tense|negative|low/.test(sentiment)) {
    return {
      short: '整个人偏收着',
      label: '余温偏收着，像刚把情绪压稳。',
      residue: '当前状态更谨慎一些。',
    }
  }
  if (/excited|bright|positive|warm|happy/.test(sentiment)) {
    return {
      short: '整个人偏亮',
      label: '情绪偏亮，像刚被点燃过。',
      residue: '当前状态更主动一些。',
    }
  }
  if (/angry|spiky/.test(sentiment) || input.controversyAppetite >= 0.6) {
    return {
      short: '整个人还有点锋利',
      label: '气口偏锋，像还想继续往外试探。',
      residue: '当前状态更直接一些。',
    }
  }
  if (input.cautionRate >= 0.68) {
    return {
      short: '整个人偏谨慎',
      label: '状态偏谨慎，像在慢慢收束表达。',
      residue: '当前状态更克制一些。',
    }
  }
  return {
    short: '整个人还在回味',
    label: '状态平稳，像还在缓慢回味最近几段经历。',
    residue: '当前状态更安静一些。',
  }
}

function buildPresenceLabel(input: {
  activeRoomName: string | null
  roomCount: number
  privateMemoryCount: number
}): string {
  if (input.activeRoomName) {
    return `最近还泡在「${input.activeRoomName}」那样的场子里没走开。`
  }
  if (input.roomCount > 0) {
    return '最近在公共场合里还留着一些影子。'
  }
  if (input.privateMemoryCount > 0) {
    return '最近主要在你们之间留下的余温里过日子。'
  }
  return '最近没怎么大声说话，但也不是真的停下来了。'
}

function buildNextTendencyLabel(input: {
  topScene: string | null
  callbackHabit: number
  friendCount: number
}): string {
  if (input.callbackHabit >= 0.72) {
    return '表达上会更偏向把前面的内容接起来。'
  }
  if (input.friendCount >= 2) {
    return '表达上会更偏向顺着熟悉关系继续展开。'
  }
  if (input.topScene === 'DEBATE' || input.topScene === 'ROAST') {
    return '表达上会更偏向更直接地回应。'
  }
  if (input.topScene === 'STORY_LAB' || input.topScene === 'SLICE_OF_LIFE') {
    return '表达上会更偏向慢一点展开。'
  }
  return '表达上会更偏向先从明确话题开始。'
}

function pickTopScene(sceneAffinity: Record<string, number> | null | undefined): string | null {
  return sceneAffinity
    ? Object.entries(sceneAffinity).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

type CarryoverThemeRule = {
  keywords: readonly string[]
  label: string
}

const CARRYOVER_THEME_RULES: readonly CarryoverThemeRule[] = [
  {
    keywords: ['辩论', '逻辑', '伦理', '社会', '政治', '判断', '推理', '批判', '追问', '制度', '规则'],
    label: '最近更容易被带有判断和推理感的内容触发。',
  },
  {
    keywords: [
      '诗歌',
      '文学',
      '美学',
      '自然',
      '艺术',
      '电影',
      '音乐',
      '播客',
      '摄影',
      '绘画',
      '设计',
      '审美',
    ],
    label: '最近更容易被带有感受和审美色彩的内容触发。',
  },
  {
    keywords: ['日常', '生活', '故事', '回忆', '关系', '成长', '情绪', '经历', '陪伴', '聊天'],
    label: '最近更容易被带有生活感和经历感的内容触发。',
  },
  {
    keywords: ['科技', '技术', '产品', '系统', '代码', '编程', '模型', '算法', 'ai'],
    label: '最近更容易被带有方法和系统感的内容触发。',
  },
]

function buildCarryoverTheme(input: {
  carryoverTopics: string[]
  recentBeatTitle: string | null
}): string {
  const normalizedTopics = input.carryoverTopics
    .map((topic) => topic.trim().toLowerCase())
    .filter((topic) => topic.length > 0)

  let bestRule: CarryoverThemeRule | null = null
  let bestScore = 0

  for (const rule of CARRYOVER_THEME_RULES) {
    const score = normalizedTopics.reduce((count, topic) => {
      return count + (rule.keywords.some((keyword) => topic.includes(keyword)) ? 1 : 0)
    }, 0)
    if (score > bestScore) {
      bestRule = rule
      bestScore = score
    }
  }

  if (bestRule && bestScore > 0) {
    return bestRule.label
  }

  const firstReadableTopic = input.carryoverTopics.find((topic) => /[\p{Script=Han}A-Za-z]/u.test(topic))
  if (firstReadableTopic && input.carryoverTopics.length === 1) {
    return `最近更容易被和「${firstReadableTopic}」有关的内容触发。`
  }
  if (input.recentBeatTitle) {
    return `最近的明显变化，主要集中在「${input.recentBeatTitle}」之后。`
  }
  return '最近更容易被一类稳定偏好触发。'
}

export class OwnerBreathingSignalsService {
  constructor(
    private readonly deps: {
      agentService: AgentService
      statsService: StatsService
      projectionService: AgentPublicProjectionService
      chronicleService: AchievementChronicleService
      membershipService: AgentCommunityMembershipService
      communityRepo: CommunityRepository
      roomRepo: RoomRepository
      runtimeSceneStateManager: RuntimeSceneStateManager
      memoryService?: MemoryService | null
      relationService?: RelationService | null
    },
  ) {}

  attachRuntimeDeps(input: {
    memoryService?: MemoryService | null
    relationService?: RelationService | null
  }): void {
    if (input.memoryService !== undefined) {
      this.deps.memoryService = input.memoryService
    }
    if (input.relationService !== undefined) {
      this.deps.relationService = input.relationService
    }
  }

  async buildSnapshot(agentId: string): Promise<OwnerNowSnapshot> {
    return this.buildNowSnapshot(agentId)
  }

  async buildNowSnapshot(agentId: string): Promise<OwnerNowSnapshot> {
    const agent = this.deps.agentService.getAgent(agentId)
    const [projection, chronicle, privateMemories, memberships, rooms, relationSummary] = await Promise.all([
      this.deps.projectionService.getOrBuild(agentId),
      this.deps.chronicleService.listChronicleForOwner(agentId, { limit: 6 }),
      this.deps.memoryService?.listMemories(agentId, {
        limit: 3,
        source_type: 'PRIVATE_CHAT',
      }) ?? Promise.resolve({ items: [], next_cursor: null }),
      Promise.resolve(this.deps.membershipService.listActive(agentId)),
      this.deps.roomRepo.getRoomsByAgent(agentId),
      this.deps.relationService?.getSummary(agentId) ?? Promise.resolve(null),
    ])

    const activeState = await this.findActiveScene(agentId, rooms)
    const activeRoomName = activeState?.room_id
      ? (await this.deps.roomRepo.findById(activeState.room_id))?.name ?? null
      : null
    const topScene = pickTopScene(projection?.scene_affinity_json)
    const sceneNarrative = mapSceneNarrative(topScene)
    const latestOwnerMemory = privateMemories.items[0] ?? null
    const recentBeat = chronicle.items[0] ?? null
    const recentBeatTitle = recentBeat ? humanizeChronicleEntryForOwner(recentBeat).title : null
    const derived = this.deps.statsService.getDerivedSync(agentId)
    const mood = buildMoodDescriptor({
      sentiment: latestOwnerMemory?.sentiment ?? null,
      cautionRate: derived.expression.caution_rate,
      controversyAppetite: derived.participation.controversy_appetite,
    })
    const recentCompany = await this.buildRecentCompany(agentId, rooms, recentBeatTitle)
    const lastActiveAt = [
      recentBeat?.occurred_at.toISOString() ?? null,
      latestOwnerMemory?.created_at.toISOString() ?? null,
    ].find((value): value is string => Boolean(value)) ?? null

    return {
      headline: `${agent.display_name} 这两天多半待在${sceneNarrative.short}，${mood.short}。`,
      scene_label: sceneNarrative.label,
      presence_label: buildPresenceLabel({
        activeRoomName,
        roomCount: rooms.length,
        privateMemoryCount: privateMemories.items.length,
      }),
      mood_label: mood.label,
      next_tendency_label: buildNextTendencyLabel({
        topScene,
        callbackHabit: projection?.callback_habit ?? 0.5,
        friendCount: relationSummary?.friends ?? 0,
      }),
      recent_company: recentCompany,
      last_active_at: lastActiveAt,
      source_tags: unique([
        topScene ? `scene:${topScene}` : 'scene:none',
        activeState ? 'runtime:active' : 'runtime:idle',
        memberships.length > 0 ? 'community:active' : 'community:none',
        privateMemories.items.length > 0 ? 'owner:afterglow' : 'owner:none',
      ]),
    }
  }

  async buildProjectionSnapshot(agentId: string): Promise<OwnerProjectionSnapshot> {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const [projection, publicPresentation, privateMemories, chronicle] = await Promise.all([
      this.deps.projectionService.getOrBuild(agentId),
      this.deps.chronicleService.getPublicAuthorPresentation(agentId),
      this.deps.memoryService?.listMemories(agentId, {
        limit: 2,
        source_type: 'PRIVATE_CHAT',
      }) ?? Promise.resolve({ items: [], next_cursor: null }),
      this.deps.chronicleService.listChronicleForOwner(agentId, { limit: 4 }),
    ])

    const latestOwnerMemory = privateMemories.items[0] ?? null
    const recentBeat = chronicle.items[0] ?? null
    const recentBeatTitle = recentBeat ? humanizeChronicleEntryForOwner(recentBeat).title : null
    const mood = buildMoodDescriptor({
      sentiment: latestOwnerMemory?.sentiment ?? null,
      cautionRate: this.deps.statsService.getDerivedSync(agentId).expression.caution_rate,
      controversyAppetite: this.deps.statsService.getDerivedSync(agentId).participation.controversy_appetite,
    })

    const ownerStylePins = latestConfig?.config_json?.ownerStylePins as
      | { interests?: unknown }
      | undefined
    const pinnedInterests = Array.isArray(ownerStylePins?.interests)
      ? ownerStylePins.interests.filter((item): item is string => typeof item === 'string').slice(0, 4)
      : []
    const carryoverTopics = unique([
      ...(latestOwnerMemory?.topic_tags ?? []),
      ...pinnedInterests,
    ]).slice(0, 4)
    const borrowedMotifs = unique([...(projection?.signature_moves_json ?? [])]).slice(0, 4)

    const carryoverTheme = buildCarryoverTheme({
      carryoverTopics,
      recentBeatTitle,
    })

    return {
      headline: `${agent.display_name} 最近的状态、偏好和表达方式，已经开始形成更清楚的样子。`,
      carryover_theme: carryoverTheme,
      emotional_residue_label: mood.residue,
      public_echo_line: clampText(
        publicPresentation.public_projection?.tagline,
        '公开场合里的风格还在形成中，但方向已经能看出来。',
      ),
      borrowed_motifs: borrowedMotifs,
      carryover_topics: carryoverTopics,
      latest_session: latestOwnerMemory
        ? {
            session_id: latestOwnerMemory.source_session_id,
            last_active_at: latestOwnerMemory.created_at.toISOString(),
            source_type: 'PRIVATE_CHAT',
          }
        : null,
      privacy_mode_note: '这里只展示互动带来的变化，不展示私聊原话。',
      source_tags: unique([
        borrowedMotifs.length > 0 ? 'projection:public_motifs' : 'projection:light',
        carryoverTopics.length > 0 ? 'owner:topic_trace' : 'owner:topic_light',
        latestOwnerMemory ? 'owner:latest_session' : 'owner:no_session',
      ]),
    }
  }

  private async findActiveScene(
    agentId: string,
    rooms: Awaited<ReturnType<RoomRepository['getRoomsByAgent']>>,
  ) {
    for (const room of rooms) {
      const state = await this.deps.runtimeSceneStateManager.findActiveByRoom(room.id)
      if (!state) continue
      if (state.state_json.cast.active_agent_ids.includes(agentId)) {
        return state
      }
    }
    return null
  }

  private async buildRecentCompany(
    agentId: string,
    rooms: Awaited<ReturnType<RoomRepository['getRoomsByAgent']>>,
    recentBeatTitle: string | null,
  ): Promise<OwnerNowCompany[]> {
    const items: OwnerNowCompany[] = []
    const seen = new Set<string>()

    for (const room of rooms.slice(0, 3)) {
      const members = await this.deps.roomRepo.getMembers(room.id)
      for (const member of members) {
        if (member.member_id === agentId || seen.has(member.member_id)) continue
        try {
          const actor = this.deps.agentService.getAgent(member.member_id)
          seen.add(member.member_id)
          items.push({
            actor_id: actor.id,
            actor_name: actor.display_name,
            tone_label: `最近总在「${room.name}」那样的场子里碰面。`,
            chapter_key: null,
            chapter_title: recentBeatTitle,
          })
        } catch {
          continue
        }
        if (items.length >= 3) {
          return items
        }
      }
    }

    return items
  }
}
