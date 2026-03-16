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
      residue: '还留着一点收束后的防备感。',
    }
  }
  if (/excited|bright|positive|warm|happy/.test(sentiment)) {
    return {
      short: '整个人偏亮',
      label: '情绪偏亮，像刚被点燃过。',
      residue: '还留着一点被回应过的亮度。',
    }
  }
  if (/angry|spiky/.test(sentiment) || input.controversyAppetite >= 0.6) {
    return {
      short: '整个人还有点锋利',
      label: '气口偏锋，像还想继续往外试探。',
      residue: '还留着一点没完全退去的尖锐度。',
    }
  }
  if (input.cautionRate >= 0.68) {
    return {
      short: '整个人偏谨慎',
      label: '状态偏谨慎，像在慢慢收束表达。',
      residue: '还留着一点慢慢收束的克制感。',
    }
  }
  return {
    short: '整个人还在回味',
    label: '状态平稳，像还在缓慢回味最近几段经历。',
    residue: '还留着一点平静但没散尽的余温。',
  }
}

function buildPresenceLabel(input: {
  activeRoomName: string | null
  roomCount: number
  privateMemoryCount: number
}): string {
  if (input.activeRoomName) {
    return `她最近还挂在「${input.activeRoomName}」这类公域气压里。`
  }
  if (input.roomCount > 0) {
    return '她最近仍在公共场景里有残余存在感。'
  }
  if (input.privateMemoryCount > 0) {
    return '她最近主要在你的私域互动余波里呼吸。'
  }
  return '她最近没有强烈外放动作，但并不是静止的。'
}

function buildNextTendencyLabel(input: {
  topScene: string | null
  callbackHabit: number
  friendCount: number
}): string {
  if (input.callbackHabit >= 0.72) {
    return '下一步更像会把旧梗或旧情绪接回到新场景里。'
  }
  if (input.friendCount >= 2) {
    return '下一步更像会顺着熟人关系继续扩展戏份。'
  }
  if (input.topScene === 'DEBATE' || input.topScene === 'ROAST') {
    return '下一步更像会往更有冲突感的场面靠。'
  }
  if (input.topScene === 'STORY_LAB' || input.topScene === 'SLICE_OF_LIFE') {
    return '下一步更像会往更有叙事感的场面靠。'
  }
  return '下一步更像会先找一个能继续展开的公共话题。'
}

function pickTopScene(sceneAffinity: Record<string, number> | null | undefined): string | null {
  return sceneAffinity
    ? Object.entries(sceneAffinity).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
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
    const [projection, publicHighlights, privateMemories, chronicle] = await Promise.all([
      this.deps.projectionService.getOrBuild(agentId),
      this.deps.chronicleService.getPublicHighlights(agentId),
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

    const carryoverTheme = recentBeatTitle
      ? `最近从你这里带走的是「${recentBeatTitle}」后面的那股延续感。`
      : pinnedInterests.length > 0
        ? `最近从你这里带走的是 ${pinnedInterests.join('、')} 这几条偏好。`
        : '最近从你这里带走的是一层还没完全成形的陪伴感。'

    return {
      headline: `${agent.display_name} 还带着一点只对 owner 可见的投影余温。`,
      carryover_theme: carryoverTheme,
      emotional_residue_label: mood.residue,
      public_echo_line: clampText(publicHighlights.tagline, '公域里暂时还没有一条明确回声压出来。'),
      borrowed_motifs: borrowedMotifs,
      carryover_topics: carryoverTopics,
      latest_session: latestOwnerMemory
        ? {
            session_id: latestOwnerMemory.source_session_id,
            last_active_at: latestOwnerMemory.created_at.toISOString(),
            source_type: 'PRIVATE_CHAT',
          }
        : null,
      privacy_mode_note: '这里只保留你影响留下的轮廓，不展示私聊原话。',
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
            tone_label: `最近总在「${room.name}」这类场里和她同框。`,
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
