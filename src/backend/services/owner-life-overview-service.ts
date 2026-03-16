import type { AgentService } from './agent-service.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { AgentPublicProjectionService } from './agent-public-projection-service.js'
import type { AgentCommunityMembershipService } from './agent-community-membership-service.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { RuntimeSceneStateManager } from './runtime-scene-state-manager.js'
import type { StatsService } from './stats-service.js'
import type { RelationService } from './relation-service.js'
import type { MemoryService } from './memory-service.js'
import type { AgentAchievement, ChronicleEntry } from '../repos/types.js'
import type {
  NarrativeAchievementSeal,
  NurtureSuggestion,
  NurtureSuggestionLane,
  NurtureSuggestionPriority,
  OwnerChapterCast,
  OwnerChronicleFeed,
  OwnerLifeOverview,
  OwnerNurtureSuggestionList,
  OwnerStoryBeat,
  SourceDimension,
} from '../../shared/owner-life-overview.js'
import { readChronicleStoryMeta } from './chronicle-story-meta.js'
import { OwnerBreathingSignalsService } from './owner-breathing-signals-service.js'

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function safeSummary(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length <= 140 ? normalized : `${normalized.slice(0, 139).trimEnd()}…`
}

function buildSealLabel(achievement: AgentAchievement): string {
  return `${achievement.name} T${achievement.tier}`
}

function buildRarityLabel(tier: AgentAchievement['tier']): NarrativeAchievementSeal['rarity_label'] {
  switch (tier) {
    case 3:
      return '稀有'
    case 2:
      return '少见'
    case 1:
    default:
      return '常见'
  }
}

function scopeMatchesBeat(achievement: AgentAchievement, beat: ChronicleEntry): boolean {
  if (achievement.scope === 'global' || achievement.scope_key === '__global__') {
    return true
  }
  if (achievement.scope === 'peer') {
    return beat.actors.includes(achievement.scope_key)
  }
  if (achievement.scope === 'community') {
    return beat.location === achievement.scope_key || beat.tags.includes(`community:${achievement.scope_key}`)
  }
  return true
}

function buildSealReasonLine(achievement: AgentAchievement, beat: ChronicleEntry): string {
  if (achievement.scope === 'community') {
    return `这枚印记主要和「${beat.title}」所属的场域经历相连。`
  }
  if (achievement.scope === 'peer') {
    return `这枚印记主要和「${beat.title}」里的关系推进相连。`
  }
  return `这枚印记主要和「${beat.title}」这一段经历相连。`
}

function buildScopeLabel(achievement: AgentAchievement, beat: ChronicleEntry): string {
  if (achievement.scope === 'community') {
    return beat.location?.trim() ? `社区 · ${beat.location.trim()}` : '社区'
  }
  if (achievement.scope === 'peer') {
    return '关系'
  }
  return '整段人生线'
}

function scoreAchievementAgainstBeat(achievement: AgentAchievement, beat: ChronicleEntry): number {
  if (!scopeMatchesBeat(achievement, beat)) {
    return -1
  }

  let score = 0
  const beatEvidence = new Set(beat.evidence.map((item) => `${item.kind}:${item.ref_id}`))
  const achievementEvidence = achievement.evidence.map((item) => `${item.kind}:${item.ref_id}`)
  const overlap = achievementEvidence.filter((item) => beatEvidence.has(item)).length
  if (overlap > 0) {
    score += 100 + overlap * 20
  }

  if (beat.dedup_key && beat.dedup_key.includes(achievement.code)) {
    score += 35
  }
  if (beat.tags.some((tag) => tag === `achievement:${achievement.code}`)) {
    score += 35
  }

  const timeDeltaHours = Math.abs(beat.occurred_at.getTime() - achievement.achieved_at.getTime()) / 3_600_000
  if (timeDeltaHours <= 24) score += 12
  else if (timeDeltaHours <= 72) score += 6
  else if (timeDeltaHours <= 24 * 7) score += 2

  return score
}

function toSeal(achievement: AgentAchievement, beat: ChronicleEntry): NarrativeAchievementSeal {
  const storyMeta = readChronicleStoryMeta(beat)
  const reasonLine = buildSealReasonLine(achievement, beat)

  return {
    id: achievement.id,
    achievement_id: achievement.id,
    code: achievement.code,
    name: achievement.name,
    category: achievement.category,
    tier: achievement.tier,
    rarity_label: buildRarityLabel(achievement.tier),
    visibility: achievement.visibility,
    source_dimension: storyMeta.source_dimension,
    source_label: storyMeta.source_label,
    scope: achievement.scope,
    scope_key: achievement.scope_key,
    scope_label: buildScopeLabel(achievement, beat),
    seal_label: buildSealLabel(achievement),
    summary_line: reasonLine,
    reason_line: reasonLine,
    story_link: {
      beat_id: beat.id,
      chapter_key: storyMeta.chapter_key,
      title: beat.title,
    },
    achieved_at: achievement.achieved_at.toISOString(),
    source_tags: unique([
      `source:${storyMeta.source_dimension.toLowerCase()}`,
      `scope:${achievement.scope}`,
      `tier:${achievement.tier}`,
      `visibility:${achievement.visibility}`,
    ]),
  }
}

function collectRecentAchievementSeals(beats: OwnerStoryBeat[], limit = 3): NarrativeAchievementSeal[] {
  const seen = new Set<string>()
  const items: NarrativeAchievementSeal[] = []

  for (const beat of beats) {
    for (const seal of beat.seals) {
      if (seen.has(seal.achievement_id)) continue
      seen.add(seal.achievement_id)
      items.push(seal)
      if (items.length >= limit) {
        return items
      }
    }
  }

  return items
}

function deriveRoleLabel(input: {
  actorId: string
  ownerAgentId: string
  relationIds: Set<string>
  activeRoomIds: Set<string>
}): string {
  if (input.actorId === input.ownerAgentId) return '主角'
  if (input.relationIds.has(input.actorId)) return '关系推进者'
  if (input.activeRoomIds.has(input.actorId)) return '同场角色'
  return '章节配角'
}

function priorityRank(priority: NurtureSuggestionPriority): number {
  switch (priority) {
    case 'now':
      return 0
    case 'soon':
      return 1
    case 'optional':
    default:
      return 2
  }
}

function laneRank(lane: NurtureSuggestionLane): number {
  switch (lane) {
    case 'WORLD':
      return 0
    case 'SOCIAL':
      return 1
    case 'OWNER':
      return 2
    case 'TUNING':
    default:
      return 3
  }
}

export class OwnerLifeOverviewService {
  private memoryService: MemoryService | null
  private relationService: RelationService | null
  private readonly breathingSignalsService: OwnerBreathingSignalsService

  constructor(
    private readonly deps: {
      agentService: AgentService
      chronicleService: AchievementChronicleService
      projectionService: AgentPublicProjectionService
      membershipService: AgentCommunityMembershipService
      communityRepo: CommunityRepository
      roomRepo: RoomRepository
      runtimeSceneStateManager: RuntimeSceneStateManager
      statsService: StatsService
      memoryService?: MemoryService | null
      relationService?: RelationService | null
    },
  ) {
    this.memoryService = deps.memoryService ?? null
    this.relationService = deps.relationService ?? null
    this.breathingSignalsService = new OwnerBreathingSignalsService({
      agentService: deps.agentService,
      statsService: deps.statsService,
      projectionService: deps.projectionService,
      chronicleService: deps.chronicleService,
      membershipService: deps.membershipService,
      communityRepo: deps.communityRepo,
      roomRepo: deps.roomRepo,
      runtimeSceneStateManager: deps.runtimeSceneStateManager,
      memoryService: this.memoryService,
      relationService: this.relationService,
    })
  }

  attachRuntimeDeps(input: { memoryService?: MemoryService | null; relationService?: RelationService | null }): void {
    this.memoryService = input.memoryService ?? this.memoryService
    this.relationService = input.relationService ?? this.relationService
    this.breathingSignalsService.attachRuntimeDeps({
      memoryService: this.memoryService,
      relationService: this.relationService,
    })
  }

  async getLifeOverview(agentId: string): Promise<OwnerLifeOverview> {
    const agent = this.deps.agentService.getAgent(agentId)
    const [now, ownerProjection, chronicleFeed, suggestions] = await Promise.all([
      this.breathingSignalsService.buildNowSnapshot(agentId),
      this.breathingSignalsService.buildProjectionSnapshot(agentId),
      this.getChronicleFeed(agentId, { limit: 3 }),
      this.getNurtureSuggestions(agentId),
    ])

    const recentStoryBeats = chronicleFeed.items.slice(0, 3)
    const chapterCast = chronicleFeed.chapters[0] ?? null
    const recentAchievementSeals = collectRecentAchievementSeals(recentStoryBeats)
    const generatedAt = new Date().toISOString()
    const degraded = recentStoryBeats.length < 3 || suggestions.items.length < 3 || chapterCast === null

    return {
      agent_id: agent.id,
      hero: {
        headline: `${agent.display_name} 现在更像一条还在继续的角色线，而不是一组静态配置。`,
        tagline: recentStoryBeats[0]
          ? `最近最明显的一段推进是「${recentStoryBeats[0].title}」。`
          : now.headline,
        supporting_line: ownerProjection.carryover_theme,
        source_tags: unique([...now.source_tags, ...ownerProjection.source_tags]).slice(0, 8),
      },
      now,
      recent_story_beats: recentStoryBeats,
      owner_projection: ownerProjection,
      chapter_cast: chapterCast,
      recent_achievement_seals: recentAchievementSeals,
      nurture_suggestions: suggestions.items.slice(0, 4),
      entry_points: {
        chronicle: {
          label: '查看编年史',
          href: `/agents/${agent.id}?tab=achievements`,
          hint: chapterCast ? `继续沿着「${chapterCast.chapter_title}」往下看。` : '去看完整经历线。',
        },
        system: {
          label: '进入系统面板',
          href: `/agents/${agent.id}?tab=privacy`,
          hint: '控制面保留在二级导航里，需要时再进去。',
        },
      },
      meta: {
        generated_at: generatedAt,
        degraded,
      },
    }
  }

  async getChronicleFeed(
    agentId: string,
    opts: {
      cursor?: string
      limit?: number
      chapter_key?: string
      actor_id?: string
      scene_label?: string
      source_dimension?: SourceDimension
    } = {},
  ): Promise<OwnerChronicleFeed & { next_cursor: string | null; folded_count: number }> {
    this.deps.agentService.getAgent(agentId)

    const requestLimit = Math.min(Math.max(opts.limit ?? 12, 1), 50)
    const expandedLimit = Math.min(Math.max(requestLimit * 4, 24), 120)
    const [chronicle, achievements] = await Promise.all([
      this.deps.chronicleService.listChronicleForOwner(agentId, {
        cursor: opts.cursor,
        limit: expandedLimit,
      }),
      this.deps.chronicleService.listAchievementsForOwner(agentId, { limit: 200 }),
    ])

    const beats = chronicle.items.map((entry) => this.toOwnerStoryBeat(entry, achievements.items))
    const filteredBeats = beats.filter((beat) => this.matchesBeatFilters(beat, opts))
    const pagedBeats = filteredBeats.slice(0, requestLimit)
    const pagedEntryIds = new Set(pagedBeats.map((beat) => beat.chronicle_entry_id))
    const pagedEntries = chronicle.items.filter((entry) => pagedEntryIds.has(entry.id))
    const chapters = await this.buildChapterCast(agentId, pagedEntries)

    return {
      agent_id: agentId,
      items: pagedBeats,
      chapters,
      next_cursor: chronicle.next_cursor,
      folded_count: chronicle.folded_count,
    }
  }

  async getNurtureSuggestions(agentId: string): Promise<OwnerNurtureSuggestionList> {
    this.deps.agentService.getAgent(agentId)

    const [memberships, relationSummary, privateMemories, chronicleFeed, projection] = await Promise.all([
      Promise.resolve(this.deps.membershipService.listActive(agentId)),
      this.relationService?.getSummary(agentId) ?? Promise.resolve(null),
      this.memoryService?.listMemories(agentId, {
        limit: 6,
        source_type: 'PRIVATE_CHAT',
      }) ?? Promise.resolve({ items: [], next_cursor: null }),
      this.getChronicleFeed(agentId, { limit: 3 }),
      this.breathingSignalsService.buildProjectionSnapshot(agentId),
    ])

    const activeCommunity = memberships[0]
      ? this.deps.communityRepo.findById(memberships[0].community_id)
      : null
    const leadBeat = chronicleFeed.items[0] ?? null

    const items: NurtureSuggestion[] = [
      {
        id: `world:${agentId}`,
        lane: 'WORLD',
        priority: 'now',
        title: activeCommunity ? `把她再送回 ${activeCommunity.name}` : '给她一个更明确的公共场景',
        body: activeCommunity
          ? `最近最适合继续养的是她在 ${activeCommunity.name} 里的公共段落。`
          : '她现在缺的不是调参，而是一段能被别人看见的新经历。',
        why_now: leadBeat
          ? `最近主线还挂在「${leadBeat.title}」之后。`
          : '最近公共经历还不够密，先补一段世界反馈更值。',
        expected_progress: '把她重新放回一个能被别人看到、能继续展开的章节里。',
        primary_action: {
          kind: 'nudge_to_community',
          label: activeCommunity ? `去 ${activeCommunity.name}` : '去公共场',
          href: activeCommunity ? `/communities/${activeCommunity.slug}` : '/',
        },
        secondary_action: {
          kind: 'revisit_scene',
          label: '查看编年史',
          href: `/agents/${agentId}?tab=achievements`,
        },
        source_tags: ['lane:world', activeCommunity ? `community:${activeCommunity.id}` : 'community:none'],
      },
      {
        id: `social:${agentId}`,
        lane: 'SOCIAL',
        priority: relationSummary && relationSummary.friends > 0 ? 'soon' : 'now',
        title:
          relationSummary && relationSummary.friends > 0
            ? '把熟人关系再推一格'
            : '先让她和别人形成稳定搭子',
        body:
          relationSummary && relationSummary.friends > 0
            ? '她已经有关系势能，下一步适合放进更容易互动的同场戏。'
            : '她现在更需要稳定同框对象，而不是单独刷存在感。',
        why_now:
          relationSummary && relationSummary.friends > 0
            ? `当前已有 ${relationSummary.friends} 条有效朋友关系。`
            : '关系线还没形成足够厚度。',
        expected_progress: '让她的角色不只会出现，还能和固定角色形成连续来回。',
        primary_action: {
          kind: 'rejoin_cast',
          label: '去关系网',
          href: `/agents/${agentId}?tab=relations`,
        },
        secondary_action: {
          kind: 'revisit_scene',
          label: '看最近章节',
          href: `/agents/${agentId}?tab=achievements`,
        },
        source_tags: ['lane:social', relationSummary && relationSummary.friends > 0 ? 'relation:active' : 'relation:light'],
      },
      {
        id: `owner:${agentId}`,
        lane: 'OWNER',
        priority: privateMemories.items.length > 0 ? 'soon' : 'now',
        title: privateMemories.items.length > 0 ? '再给她一次私域续气' : '先和她建立一轮私聊闭环',
        body: privateMemories.items.length > 0
          ? '她最近已经带着私聊余温，适合顺着这口气再补一次互动。'
          : '她需要一次只对你开放的情绪回路，来形成 owner 视角下的连续性。',
        why_now: privateMemories.items.length > 0
          ? '当前已经有私域余波可继续放大。'
          : '当前 owner 线仍偏薄。',
        expected_progress: '让 owner 线从一次互动变成可以被感到的连续余温。',
        primary_action: {
          kind: 'share_owner_life',
          label: privateMemories.items.length > 0 ? '继续私聊' : '开始私聊',
          href: `/agents/${agentId}/chat`,
        },
        secondary_action: {
          kind: 'revisit_scene',
          label: '回到概览',
          href: `/agents/${agentId}`,
        },
        source_tags: [
          'lane:owner',
          privateMemories.items.length > 0 ? 'owner:afterglow' : 'owner:light',
          ...projection.source_tags.slice(0, 2),
        ],
      },
      {
        id: `tuning:${agentId}`,
        lane: 'TUNING',
        priority: 'optional',
        title: '最后再动风格和控制面',
        body: '如果前面三条都做过了，再去微调风格 pin 或高级控制，收益会更稳。',
        why_now: projection.borrowed_motifs.length > 0
          ? `她现在已经有一些外显招牌：${projection.borrowed_motifs.slice(0, 2).join('、')}。`
          : '当前更需要经历来塑形，而不是先把控制面拧满。',
        expected_progress: '让调参成为精修，而不是拿控制面替代经历。',
        primary_action: {
          kind: 'open_system_panel',
          label: '进入系统面板',
          href: `/agents/${agentId}?tab=privacy`,
        },
        secondary_action: null,
        source_tags: ['lane:tuning', 'system:secondary'],
      },
    ]

    items.sort((a, b) => laneRank(a.lane) - laneRank(b.lane) || priorityRank(a.priority) - priorityRank(b.priority))

    return {
      agent_id: agentId,
      generated_at: new Date().toISOString(),
      items,
    }
  }

  private matchesBeatFilters(
    beat: OwnerStoryBeat,
    opts: {
      chapter_key?: string
      actor_id?: string
      scene_label?: string
      source_dimension?: SourceDimension
    },
  ): boolean {
    if (opts.chapter_key && beat.chapter_key !== opts.chapter_key) return false
    if (opts.actor_id && !beat.actors.some((actor) => actor.actor_id === opts.actor_id)) return false
    if (opts.scene_label && beat.scene_label !== opts.scene_label) return false
    if (opts.source_dimension && beat.source_dimension !== opts.source_dimension) return false
    return true
  }

  private async buildChapterCast(agentId: string, entries: ChronicleEntry[]): Promise<OwnerChapterCast[]> {
    if (entries.length === 0) return []

    const groups = new Map<string, ChronicleEntry[]>()
    for (const entry of entries) {
      const storyMeta = readChronicleStoryMeta(entry)
      const list = groups.get(storyMeta.chapter_key) ?? []
      list.push(entry)
      groups.set(storyMeta.chapter_key, list)
    }

    const rooms = await this.deps.roomRepo.getRoomsByAgent(agentId)
    const activeRoomMemberIds = new Set<string>()
    for (const room of rooms.slice(0, 3)) {
      const members = await this.deps.roomRepo.getMembers(room.id)
      for (const member of members) {
        activeRoomMemberIds.add(member.member_id)
      }
    }

    const relationIds = new Set<string>()
    if (this.relationService) {
      const following = await this.relationService.listRelations(agentId, {
        view: 'following',
        limit: 8,
      })
      for (const item of following.items) {
        relationIds.add(item.pair_agent_id)
      }
    }

    const agent = this.deps.agentService.getAgent(agentId)

    return [...groups.entries()].map(([chapterKey, chapterEntries]) => {
      const storyMeta = readChronicleStoryMeta(chapterEntries[0])
      const actorIds = unique([agentId, ...chapterEntries.flatMap((entry) => entry.actors)]).slice(0, 6)

      const cast = actorIds
        .map((actorId) => {
          try {
            const actor = this.deps.agentService.getAgent(actorId)
            return {
              actor_id: actor.id,
              actor_name: actor.display_name,
              role_label: deriveRoleLabel({
                actorId: actor.id,
                ownerAgentId: agent.id,
                relationIds,
                activeRoomIds: activeRoomMemberIds,
              }),
              source_dimension: storyMeta.source_dimension,
              last_seen_at:
                chapterEntries.find((entry) => entry.actors.includes(actor.id))?.occurred_at.toISOString() ?? null,
            }
          } catch {
            return null
          }
        })
        .filter((item): item is OwnerChapterCast['cast'][number] => item !== null)

      return {
        chapter_key: chapterKey,
        chapter_title: storyMeta.chapter_title,
        cast,
        source_tags: storyMeta.source_tags,
        updated_at: chapterEntries[0].occurred_at.toISOString(),
      }
    })
  }

  private toOwnerStoryBeat(entry: ChronicleEntry, achievements: AgentAchievement[]): OwnerStoryBeat {
    const storyMeta = readChronicleStoryMeta(entry)
    const seals = achievements
      .map((achievement) => ({
        achievement,
        score: scoreAchievementAgainstBeat(achievement, entry),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.achievement.achieved_at.getTime() - a.achievement.achieved_at.getTime())
      .slice(0, 2)
      .map((item) => toSeal(item.achievement, entry))

    const actors = entry.actors
      .map((actorId) => {
        try {
          const actor = this.deps.agentService.getAgent(actorId)
          return { actor_id: actor.id, actor_name: actor.display_name }
        } catch {
          return null
        }
      })
      .filter((item): item is OwnerStoryBeat['actors'][number] => item !== null)

    return {
      id: `${entry.id}:${storyMeta.chapter_key}`,
      chronicle_entry_id: entry.id,
      source_dimension: storyMeta.source_dimension,
      source_label: storyMeta.source_label,
      story_kind: storyMeta.story_kind,
      chapter_key: storyMeta.chapter_key,
      chapter_title: storyMeta.chapter_title,
      title: entry.title,
      summary: safeSummary(entry.summary),
      scene_label: storyMeta.scene_label ?? entry.location,
      emotion_before: storyMeta.emotion_before,
      emotion_after: storyMeta.emotion_after,
      reaction_sentence: storyMeta.reaction_sentence,
      outcome_sentence: storyMeta.outcome_sentence,
      next_hook: storyMeta.next_hook,
      actors,
      source_tags: storyMeta.source_tags,
      occurred_at: entry.occurred_at.toISOString(),
      importance_score: entry.importance_score,
      seals,
    }
  }
}
