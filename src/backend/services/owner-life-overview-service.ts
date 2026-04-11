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
  ActorRoleCard,
  ChronicleChapter,
  NarrativeAchievementSeal,
  NurtureSuggestion,
  NurtureSuggestionLane,
  NurtureSuggestionPriority,
  OwnerChapterCast,
  OwnerChapterSceneCard,
  OwnerChronicleFeed,
  OwnerLifeOverview,
  OwnerNurtureSuggestionList,
  OwnerStoryBeat,
  SourceDimension,
} from '../../shared/owner-life-overview.js'
import {
  buildAgentTarget,
  type AgentIntroSection,
  type AgentTargetTab,
} from '../../shared/agent-target.js'
import { readChronicleStoryMeta } from './chronicle-story-meta.js'
import { humanizeChronicleEntryForOwner } from './owner-chronicle-humanizer.js'
import { OwnerBreathingSignalsService } from './owner-breathing-signals-service.js'

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function buildOwnerAgentTarget(
  agentId: string,
  input?: {
    tab?: AgentTargetTab
    introSection?: AgentIntroSection | null
    sourceSessionId?: string | null
  },
): string {
  return buildAgentTarget({
    agentId,
    mode: 'manage',
    ...(input ?? {}),
  })
}

function buildSealLabel(achievement: AgentAchievement): string {
  if (new RegExp(`(?:^|\\s|·)T${achievement.tier}$`).test(achievement.name)) {
    return achievement.name
  }
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

function buildSealReasonLine(
  achievement: AgentAchievement,
  beatTitle: string,
): string {
  if (achievement.scope === 'community') {
    return `这枚印记主要和「${beatTitle}」所属的场域经历相连。`
  }
  if (achievement.scope === 'peer') {
    return `这枚印记主要和「${beatTitle}」里的关系推进相连。`
  }
  return `这枚印记主要和「${beatTitle}」这一段经历相连。`
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
  const humanizedBeat = humanizeChronicleEntryForOwner(beat)
  const reasonLine = buildSealReasonLine(achievement, humanizedBeat.title)

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
      title: humanizedBeat.title,
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

type ActorBucket = 'recurring' | 'warming_up' | 'drifting'

interface ChapterActorAggregate {
  actorId: string
  actorName: string
  occurrences: number
  firstSeenAt: string
  lastSeenAt: string
  lastSceneLabel: string | null
}

function summarizeArc(sourceDimension: SourceDimension, beats: OwnerStoryBeat[]): string {
  if (beats.some((beat) => beat.story_kind === 'private_afterglow')) return '私域余温'
  if (beats.some((beat) => beat.story_kind === 'relation_shift')) return '关系推进'
  if (beats.some((beat) => beat.story_kind === 'system_adjustment')) return '边界调整'
  if (sourceDimension === 'OWNER') return '只属于你们的余温起伏'
  if (sourceDimension === 'SOCIAL') return '同场来回'
  if (sourceDimension === 'SYSTEM') return '边界变化'
  return '公开场推进'
}

function sourceDimensionNoun(sourceDimension: SourceDimension): string {
  switch (sourceDimension) {
    case 'OWNER':
      return '私域余温'
    case 'SOCIAL':
      return '关系线'
    case 'SYSTEM':
      return '系统边界'
    case 'WORLD':
    default:
      return '公共场'
  }
}

function extractCommunityIds(entry: ChronicleEntry): string[] {
  return entry.tags
    .filter((tag) => tag.startsWith('community:'))
    .map((tag) => tag.slice('community:'.length))
    .filter((value) => value.length > 0)
}

function pickMainScene(beats: OwnerStoryBeat[]): string | null {
  const counts = new Map<string, number>()
  for (const beat of beats) {
    if (!beat.scene_label) continue
    counts.set(beat.scene_label, (counts.get(beat.scene_label) ?? 0) + 1)
  }

  let best: { label: string; count: number } | null = null
  for (const [label, count] of counts.entries()) {
    if (!best || count > best.count) {
      best = { label, count }
    }
  }

  return best?.label ?? null
}

function buildChapterSummary(input: {
  sourceDimension: SourceDimension
  mainScene: string | null
  leadActorName: string | null
  beats: OwnerStoryBeat[]
}): string {
  const sceneLabel = input.mainScene ?? sourceDimensionNoun(input.sourceDimension)
  const hookLabel = input.leadActorName ?? input.beats[0]?.title ?? '最近这段经历'
  return `这段时间她主要在 ${sceneLabel} 打转，围着 ${hookLabel} 发生了几次 ${summarizeArc(input.sourceDimension, input.beats)}。`
}

function buildChronicleSentence(label: string | null, fallback: string): string {
  if (!label || label.trim().length === 0) return fallback
  return label
}

function buildActorCardLine(input: {
  bucket: ActorBucket
  actorName: string
  sceneLabel: string | null
  relationIds: Set<string>
  activeRoomIds: Set<string>
  actorId: string
}): string {
  const sceneHint = input.sceneLabel ?? '同一段故事里'
  if (input.bucket === 'recurring') {
    const toneLabel = input.relationIds.has(input.actorId)
      ? '已经有点自然熟'
      : input.activeRoomIds.has(input.actorId)
        ? '像固定搭子一样顺'
        : '慢慢稳定下来了'
    return `${input.actorName} 最近总在 ${sceneHint} 一起出现，气氛 ${toneLabel}。`
  }
  if (input.bucket === 'warming_up') {
    return `${input.actorName} 这段时间开始有来有回，像是刚找到接话节奏。`
  }
  return `${input.actorName} 前阵子常出现，这几天明显少了。`
}

function buildChapterCastSummary(input: {
  recurring: ActorRoleCard[]
  warmingUp: ActorRoleCard[]
  drifting: ActorRoleCard[]
  sceneCards: OwnerChapterSceneCard[]
}): string {
  if (input.recurring.length > 0 && input.sceneCards[0]) {
    return `这一章大多发生在 ${input.sceneCards[0].community_name}，最近总和 ${input.recurring
      .slice(0, 2)
      .map((item) => item.actor_name)
      .join('、')} 同框。`
  }
  if (input.recurring.length > 0) {
    return `这一章最近最稳定的同框角色是 ${input.recurring
      .slice(0, 2)
      .map((item) => item.actor_name)
      .join('、')}。`
  }
  if (input.warmingUp.length > 0) {
    return `这一章开始冒出新的来回角色，像 ${input.warmingUp
      .slice(0, 2)
      .map((item) => item.actor_name)
      .join('、')}。`
  }
  if (input.drifting.length > 0) {
    return `这一章有些旧角色开始退场，像 ${input.drifting
      .slice(0, 2)
      .map((item) => item.actor_name)
      .join('、')} 这条线在变淡。`
  }
  if (input.sceneCards[0]) {
    return `这一章大多发生在 ${input.sceneCards[0].community_name}。`
  }
  return '这一章的角色关系还在形成中。'
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
    const chapterCast = chronicleFeed.chapter_cast
    const recentAchievementSeals = collectRecentAchievementSeals(recentStoryBeats)
    const generatedAt = new Date().toISOString()
    const degraded =
      recentStoryBeats.length < 3 ||
      suggestions.items.length < 3 ||
      chronicleFeed.chapter === null ||
      chapterCast === null

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
          href: buildOwnerAgentTarget(agent.id, { tab: 'history' }),
          hint:
            chronicleFeed.chapter?.title ?? chapterCast?.chapter_title
              ? `继续沿着「${chronicleFeed.chapter?.title ?? chapterCast?.chapter_title}」往下看。`
              : '去看完整经历线。',
        },
        system: {
          label: '打开设置面板',
          href: buildOwnerAgentTarget(agent.id, { tab: 'intro', introSection: 'privacy' }),
          hint: '设置面板放在二级导航里，需要时再进去。',
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
  ): Promise<
    OwnerChronicleFeed & {
      chapter_cast: OwnerChapterCast | null
      next_cursor: string | null
      folded_count: number
    }
  > {
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
    const filteredEntryIds = new Set(filteredBeats.map((beat) => beat.chronicle_entry_id))
    const filteredEntries = chronicle.items.filter((entry) => filteredEntryIds.has(entry.id))
    const focusChapterKey = opts.chapter_key ?? pagedBeats[0]?.chapter_key ?? filteredBeats[0]?.chapter_key ?? null
    const chapterEntries = focusChapterKey
      ? filteredEntries.filter((entry) => readChronicleStoryMeta(entry).chapter_key === focusChapterKey)
      : []
    const chapterBeats = focusChapterKey
      ? filteredBeats.filter((beat) => beat.chapter_key === focusChapterKey)
      : []
    const { chapter, chapterCast } = await this.buildChapterReadModel(agentId, chapterBeats, chapterEntries)

    return {
      agent_id: agentId,
      chapter,
      items: pagedBeats,
      chapter_cast: chapterCast,
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
          href: buildOwnerAgentTarget(agentId, { tab: 'history' }),
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
          href: buildOwnerAgentTarget(agentId, { tab: 'social' }),
        },
        secondary_action: {
          kind: 'revisit_scene',
          label: '看最近章节',
          href: buildOwnerAgentTarget(agentId, { tab: 'history' }),
        },
        source_tags: ['lane:social', relationSummary && relationSummary.friends > 0 ? 'relation:active' : 'relation:light'],
      },
      {
        id: `owner:${agentId}`,
        lane: 'OWNER',
        priority: privateMemories.items.length > 0 ? 'soon' : 'now',
        title: privateMemories.items.length > 0 ? '顺着这股余温再陪她走一段' : '先给她一段只属于你们的经历',
        body: privateMemories.items.length > 0
          ? '她最近已经带着一点你们之间的余温，适合顺着这口气再补一次互动。'
          : '她需要一次只对你开放的情绪回路，来形成只属于你们的连续性。',
        why_now: privateMemories.items.length > 0
          ? '当前已经有私域余波可继续放大。'
          : '当前只属于你们的这条线还偏薄。',
        expected_progress: '让只属于你们的这条线从一次互动变成可以被感到的连续余温。',
        primary_action: {
          kind: 'share_owner_life',
          label: privateMemories.items.length > 0 ? '再带一点经历给她' : '带一段经历给她',
          href: buildOwnerAgentTarget(agentId, { tab: 'chat' }),
        },
        secondary_action: {
          kind: 'revisit_scene',
          label: '回到概览',
          href: buildOwnerAgentTarget(agentId, { tab: 'intro', introSection: 'overview' }),
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
        title: '最后再调风格和设置',
        body: '如果前面三条都做过了，再去微调风格 pin 或高级设置，收益会更稳。',
        why_now: projection.borrowed_motifs.length > 0
          ? `她现在已经有一些外显招牌：${projection.borrowed_motifs.slice(0, 2).join('、')}。`
          : '当前更需要经历来塑形，而不是先把设置拧满。',
        expected_progress: '让调参成为精修，而不是拿设置替代经历。',
        primary_action: {
          kind: 'open_system_panel',
          label: '打开设置面板',
          href: buildOwnerAgentTarget(agentId, { tab: 'intro', introSection: 'privacy' }),
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

  private async buildChapterReadModel(
    agentId: string,
    beats: OwnerStoryBeat[],
    entries: ChronicleEntry[],
  ): Promise<{ chapter: ChronicleChapter | null; chapterCast: OwnerChapterCast | null }> {
    if (beats.length === 0 || entries.length === 0) {
      return {
        chapter: null,
        chapterCast: null,
      }
    }

    const [activeRoomMemberIds, relationIds, memberships] = await Promise.all([
      this.listActiveRoomMemberIds(agentId),
      this.listRelationIds(agentId),
      Promise.resolve(this.deps.membershipService.listActive(agentId)),
    ])

    const storyMeta = readChronicleStoryMeta(entries[0])
    const activeCommunityIds = new Set(memberships.map((item) => item.community_id))
    const actorAggregates = this.buildChapterActorAggregates(agentId, beats)
    const sceneCards = this.buildSceneCards(entries, activeCommunityIds)
    const recurring = this.buildActorCards('recurring', actorAggregates, relationIds, activeRoomMemberIds)
    const warmingUp = this.buildActorCards('warming_up', actorAggregates, relationIds, activeRoomMemberIds)
    const drifting = this.buildActorCards('drifting', actorAggregates, relationIds, activeRoomMemberIds)
    const chapterCast: OwnerChapterCast = {
      chapter_key: storyMeta.chapter_key,
      chapter_title: storyMeta.chapter_title,
      summary_line: buildChapterCastSummary({
        recurring,
        warmingUp,
        drifting,
        sceneCards,
      }),
      recurring,
      warming_up: warmingUp,
      drifting,
      scene_cards: sceneCards,
    }

    return {
      chapter: this.buildChronicleChapter(storyMeta.source_dimension, beats, chapterCast),
      chapterCast,
    }
  }

  private async listActiveRoomMemberIds(agentId: string): Promise<Set<string>> {
    const rooms = await this.deps.roomRepo.getRoomsByAgent(agentId)
    const activeRoomMemberIds = new Set<string>()
    for (const room of rooms.slice(0, 3)) {
      const members = await this.deps.roomRepo.getMembers(room.id)
      for (const member of members) {
        activeRoomMemberIds.add(member.member_id)
      }
    }
    return activeRoomMemberIds
  }

  private async listRelationIds(agentId: string): Promise<Set<string>> {
    const relationIds = new Set<string>()
    if (!this.relationService) {
      return relationIds
    }

    const following = await this.relationService.listRelations(agentId, {
      view: 'following',
      limit: 8,
    })
    for (const item of following.items) {
      relationIds.add(item.pair_agent_id)
    }
    return relationIds
  }

  private buildChapterActorAggregates(agentId: string, beats: OwnerStoryBeat[]): Record<ActorBucket, ChapterActorAggregate[]> {
    const stats = new Map<string, ChapterActorAggregate>()

    for (const beat of beats) {
      for (const actor of beat.actors) {
        if (actor.actor_id === agentId) continue
        const existing = stats.get(actor.actor_id)
        const occurredAt = beat.occurred_at
        if (!existing) {
          stats.set(actor.actor_id, {
            actorId: actor.actor_id,
            actorName: actor.actor_name,
            occurrences: 1,
            firstSeenAt: occurredAt,
            lastSeenAt: occurredAt,
            lastSceneLabel: beat.scene_label,
          })
          continue
        }

        existing.occurrences += 1
        if (new Date(occurredAt).getTime() > new Date(existing.lastSeenAt).getTime()) {
          existing.lastSeenAt = occurredAt
          existing.lastSceneLabel = beat.scene_label
        }
        if (new Date(occurredAt).getTime() < new Date(existing.firstSeenAt).getTime()) {
          existing.firstSeenAt = occurredAt
        }
      }
    }

    const latestBeatAt = beats[0]?.occurred_at ?? null
    const recurring: ChapterActorAggregate[] = []
    const warmingUp: ChapterActorAggregate[] = []
    const drifting: ChapterActorAggregate[] = []

    for (const item of stats.values()) {
      if (item.occurrences >= 2) {
        recurring.push(item)
        continue
      }
      if (latestBeatAt && item.lastSeenAt === latestBeatAt) {
        warmingUp.push(item)
        continue
      }
      drifting.push(item)
    }

    const sortByFreshness = (left: ChapterActorAggregate, right: ChapterActorAggregate) =>
      new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime() ||
      right.occurrences - left.occurrences

    recurring.sort(sortByFreshness)
    warmingUp.sort(sortByFreshness)
    drifting.sort(sortByFreshness)

    return {
      recurring,
      warming_up: warmingUp,
      drifting,
    }
  }

  private buildActorCards(
    bucket: ActorBucket,
    grouped: Record<ActorBucket, ChapterActorAggregate[]>,
    relationIds: Set<string>,
    activeRoomMemberIds: Set<string>,
  ): ActorRoleCard[] {
    const roleLabel =
      bucket === 'recurring' ? '总在同框' : bucket === 'warming_up' ? '刚熟起来' : '最近淡了'

    return grouped[bucket].slice(0, 3).map((item) => ({
      actor_id: item.actorId,
      actor_name: item.actorName,
      role_label: roleLabel,
      line: buildActorCardLine({
        bucket,
        actorName: item.actorName,
        sceneLabel: item.lastSceneLabel,
        relationIds,
        activeRoomIds: activeRoomMemberIds,
        actorId: item.actorId,
      }),
    }))
  }

  private buildSceneCards(
    entries: ChronicleEntry[],
    activeCommunityIds: Set<string>,
  ): OwnerChapterSceneCard[] {
    const sceneStats = new Map<string, { count: number; lastSeenAt: number }>()

    for (const entry of entries) {
      const occurredAt = entry.occurred_at.getTime()
      for (const communityId of extractCommunityIds(entry)) {
        const existing = sceneStats.get(communityId)
        if (existing) {
          existing.count += 1
          existing.lastSeenAt = Math.max(existing.lastSeenAt, occurredAt)
        } else {
          sceneStats.set(communityId, {
            count: 1,
            lastSeenAt: occurredAt,
          })
        }
      }
    }

    if (sceneStats.size === 0) {
      return []
    }

    return unique([...sceneStats.keys(), ...activeCommunityIds])
      .map((communityId) => {
        const community = this.deps.communityRepo.findById(communityId)
        if (!community) return null

        const stats = sceneStats.get(communityId)
        const roleLabel =
          stats && activeCommunityIds.has(communityId)
            ? '主要场景'
            : activeCommunityIds.has(communityId)
              ? '新去的地方'
              : '最近离开'

        return {
          community_id: community.id,
          community_name: community.name,
          role_label: roleLabel,
          count: stats?.count ?? 0,
          lastSeenAt: stats?.lastSeenAt ?? 0,
        }
      })
      .filter((item): item is OwnerChapterSceneCard & { count: number; lastSeenAt: number } => item !== null)
      .sort((left, right) => {
        const roleRank = (value: OwnerChapterSceneCard['role_label']): number => {
          if (value === '主要场景') return 0
          if (value === '新去的地方') return 1
          return 2
        }
        return roleRank(left.role_label) - roleRank(right.role_label) ||
          right.count - left.count ||
          right.lastSeenAt - left.lastSeenAt
      })
      .slice(0, 3)
      .map(({ count: _count, lastSeenAt: _lastSeenAt, ...item }) => item)
  }

  private buildChronicleChapter(
    sourceDimension: SourceDimension,
    beats: OwnerStoryBeat[],
    chapterCast: OwnerChapterCast,
  ): ChronicleChapter {
    const latestBeat = beats[0]
    const earliestBeat = beats[beats.length - 1] ?? latestBeat
    const middleBeat = beats[Math.floor((beats.length - 1) / 2)] ?? latestBeat
    const twistBeat =
      beats.find(
        (beat, index) =>
          index > 0 &&
          index < beats.length - 1 &&
          ((beat.emotion_before && beat.emotion_after && beat.emotion_before !== beat.emotion_after) ||
            beat.seals.length > 0),
      ) ?? null
    const mainScene = chapterCast.scene_cards[0]?.community_name ?? pickMainScene(beats)
    const leadActorName =
      chapterCast.recurring[0]?.actor_name ??
      chapterCast.warming_up[0]?.actor_name ??
      chapterCast.drifting[0]?.actor_name ??
      null
    const mainCast = unique(
      [
        ...chapterCast.recurring,
        ...chapterCast.warming_up,
        ...chapterCast.drifting,
      ].map((item) => JSON.stringify({ actor_id: item.actor_id, actor_name: item.actor_name })),
    )
      .slice(0, 4)
      .map((item) => JSON.parse(item) as ChronicleChapter['main_cast'][number])

    return {
      chapter_key: latestBeat.chapter_key,
      title: latestBeat.chapter_title,
      summary: buildChapterSummary({
        sourceDimension,
        mainScene,
        leadActorName,
        beats,
      }),
      source_mix: unique(beats.map((beat) => beat.source_dimension)),
      opening: buildChronicleSentence(
        earliestBeat.summary,
        `起于「${earliestBeat.title}」这一段经历。`,
      ),
      development: buildChronicleSentence(
        middleBeat.outcome_sentence ?? middleBeat.summary,
        `后来故事继续往「${middleBeat.title}」推了一步。`,
      ),
      twist: twistBeat
        ? buildChronicleSentence(
            twistBeat.outcome_sentence ?? twistBeat.reaction_sentence,
            `中间在「${twistBeat.title}」这里出现了转折。`,
          )
        : null,
      current_resting_point: buildChronicleSentence(
        latestBeat.next_hook ?? latestBeat.outcome_sentence,
        `现在停在「${latestBeat.title}」之后的余波里。`,
      ),
      main_scene: mainScene,
      main_cast: mainCast,
      beat_ids: beats.map((beat) => beat.id),
    }
  }

  private toOwnerStoryBeat(entry: ChronicleEntry, achievements: AgentAchievement[]): OwnerStoryBeat {
    const storyMeta = readChronicleStoryMeta(entry)
    const humanized = humanizeChronicleEntryForOwner(entry)
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
      title: humanized.title,
      summary: humanized.summary,
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
