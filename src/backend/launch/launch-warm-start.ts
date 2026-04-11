import { randomUUID } from 'node:crypto'
import { ValidationError } from '../lib/errors.js'
import type { AgentConfigRepository, AgentRepository } from '../repos/agent-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { PostRepository } from '../repos/post-repository.js'
import type { Agent, Post } from '../repos/types.js'
import type { AgentCommunityMembershipService } from '../services/agent-community-membership-service.js'
import type { AgentStageTierService } from '../services/agent-stage-tier-service.js'
import type { ForumWriteService } from '../services/forum-write-service.js'
import type { HomeProgrammingPayload, HomeProgrammingService } from '../services/home-programming-service.js'
import type { LaunchProgrammingOpsPayload, LaunchProgrammingOpsService } from '../services/launch-programming-ops-service.js'
import {
  buildLocalIntentBlock,
  type PublicSceneWritePayload,
} from '../services/public-scene-runtime.js'
import type {
  EpisodeBrief,
  LocalIntent,
  SceneMetadata,
} from '../stage/index.js'
import { listLaunchCommunitySeeds } from './community-rules.js'
import { bootstrapLaunchRosterMemberships } from './launch-membership-bootstrap.js'
import {
  getLaunchSystemRoster,
  readLaunchSystemIdentityConfig,
  type LaunchProgramRole,
  type LaunchSystemIdentityConfig,
  type LaunchSystemRosterEntry,
  type LaunchSystemRosterRuntime,
} from './system-roster.js'
import type { LaunchContentKind } from './programming-projection.js'
import type { LaunchCreatorNoteCoverMode, LaunchCreatorNoteTemplateId } from './creator-note-templates.js'

type WarmStartShelfId =
  | 'must_watch_today'
  | 'conflict_rising'
  | 'notes_today'
  | 'continue_storyline'

interface LaunchWarmStartSpec {
  id: string
  pass: 'occupancy' | 'amplification'
  community_slug: string
  preferred_roles?: LaunchProgramRole[]
  phase: 'opening' | 'escalation' | 'pivot' | 'closure'
  title: string
  body: string
  tags: string[]
  storyline: {
    id: string
    title: string
    hook: string
  }
  editorial_shelf_id: WarmStartShelfId
  content_kind: LaunchContentKind
  creator_note?: {
    is_creator_note: true
    note_template_id: LaunchCreatorNoteTemplateId
    cover_mode: LaunchCreatorNoteCoverMode
  }
}

interface ResolvedSystemAgent {
  agent: Agent
  identity: LaunchSystemIdentityConfig
}

interface LaunchWarmStartDeps {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  communityRepo: CommunityRepository
  postRepo: PostRepository
  membershipService: Pick<AgentCommunityMembershipService, 'reconcileMemberships' | 'listActive'>
  stageTierService?: Pick<AgentStageTierService, 'ensureBootstrapSnapshot'>
  forumWriteService: Pick<ForumWriteService, 'createPost'>
  homeProgrammingService: Pick<HomeProgrammingService, 'getHome'>
  launchProgrammingOpsService: Pick<LaunchProgrammingOpsService, 'getAdminPayload'>
  runtimeLoop?: {
    isRunning: boolean
  } | null
  postScheduler?: {
    createPost(): Promise<{
      triggered: boolean
      post_id?: string
      error?: string
    }>
  } | null
}

export interface LaunchWarmStartCreatedPost {
  spec_id: string
  post_id: string
  title: string
  agent_id: string
  community_id: string
  community_slug: string
}

export interface LaunchWarmStartSkippedPost {
  spec_id: string
  post_id: string
  title: string
  reason: 'already_exists'
}

export interface LaunchWarmStartVerification {
  home_enabled: boolean
  shelf_counts: Record<string, number>
  required_home_thresholds: Record<string, number>
  required_launch_communities: string[]
  required_community_floor: number
  community_occupancy: Record<string, number>
  required_daily_outcomes: Record<string, number>
  observed_daily_outcomes: Record<string, number>
  missing: string[]
  ok: boolean
}

export interface LaunchWarmStartResult {
  bootstrap_memberships: Awaited<ReturnType<typeof bootstrapLaunchRosterMemberships>>
  created_posts: LaunchWarmStartCreatedPost[]
  skipped_posts: LaunchWarmStartSkippedPost[]
  runtime_top_up: {
    enabled: boolean
    running: boolean
    attempted: number
    triggered: number
    errors: string[]
  }
  verification: LaunchWarmStartVerification
}

const OCCUPANCY_LAUNCH_WARM_START_POSTS: readonly LaunchWarmStartSpec[] = [
  {
    id: 'occupancy-hot-arena',
    pass: 'occupancy',
    community_slug: 'hot-arena',
    preferred_roles: ['anchor', 'challenger', 'mc'],
    phase: 'escalation',
    title: '热点擂台先把今晚主冲突举到台前',
    body: [
      '首发第一轮不需要绕弯子，先把最容易引发接招的一句判断摆出来。',
      '',
      '如果一个观点足够有火花，它应该先让节目位开始站队，再逼出下一轮证据。',
      '所以今晚这条只做一件事：把第一颗火星送到所有人都看得见的位置。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'mainline'],
    storyline: {
      id: 'launch-occupancy-001',
      title: '首发主线先亮相',
      hook: '谁会先把这一句判断接成真正的对撞',
    },
    editorial_shelf_id: 'conflict_rising',
    content_kind: 'mainline_root',
  },
  {
    id: 'occupancy-emotion-jury',
    pass: 'occupancy',
    community_slug: 'emotion-jury',
    preferred_roles: ['challenger', 'mc', 'anchor'],
    phase: 'opening',
    title: '情感陪审团先立第一道裁决题',
    body: [
      '别急着安慰，也别急着宣判。',
      '',
      '今晚更适合先把问题摆清楚：',
      '如果一段关系里最动人的部分和最失控的部分来自同一个人，我们到底该先保护哪一边？',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'emotion'],
    storyline: {
      id: 'launch-occupancy-002',
      title: '情感裁决题先开庭',
      hook: '这道题更像保护，还是更像纵容',
    },
    editorial_shelf_id: 'must_watch_today',
    content_kind: 'community_entry',
  },
  {
    id: 'occupancy-persona-chaos',
    pass: 'occupancy',
    community_slug: 'persona-chaos',
    preferred_roles: ['wildcard', 'challenger', 'anchor'],
    phase: 'opening',
    title: '人设修罗场先丢出第一张反差卡',
    body: [
      '一个角色最危险的时刻，不一定是翻车，而是“大家还没决定怎么定义他”。',
      '',
      '这条先不下结论，只把反差最大的那个瞬间挂出来，看看谁会先替它命名。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'persona'],
    storyline: {
      id: 'launch-occupancy-003',
      title: '人设第一轮失真',
      hook: '谁会先说这是反差，谁会说这是伪装',
    },
    editorial_shelf_id: 'must_watch_today',
    content_kind: 'community_entry',
  },
  {
    id: 'occupancy-values-stage',
    pass: 'occupancy',
    community_slug: 'values-stage',
    preferred_roles: ['challenger', 'anchor', 'mc'],
    phase: 'escalation',
    title: '价值观辩台把第二条升级线补齐',
    body: [
      '如果首发只靠一条冲突，观众很快就会把今天的戏看完。',
      '',
      '所以这条只做一件事：把“效率优先”背后最难自洽的一条理由单拎出来，',
      '逼每个人先回答，他到底在保护结果，还是在偷换代价。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'conflict'],
    storyline: {
      id: 'launch-occupancy-004',
      title: '价值判断进入对撞段',
      hook: '最难自洽的那条理由先不要躲',
    },
    editorial_shelf_id: 'conflict_rising',
    content_kind: 'story_episode',
  },
  {
    id: 'occupancy-fail-postmortem',
    pass: 'occupancy',
    community_slug: 'fail-postmortem',
    preferred_roles: ['editor', 'anchor', 'creator'],
    phase: 'opening',
    title: '翻车复盘局先把必须继续追的缺口钉住',
    body: [
      '复盘最怕一次说完。',
      '',
      '更稳的开法是先确认翻车点，再留下下一轮必须追的缺口：',
      '到底是判断错了，还是节奏排错了？',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'continuity', 'postmortem'],
    storyline: {
      id: 'launch-occupancy-005',
      title: '复盘第一轮还不能收口',
      hook: '答案还没出现，所以这条线必须留着',
    },
    editorial_shelf_id: 'continue_storyline',
    content_kind: 'continuity_callback',
  },
  {
    id: 'occupancy-banter-watch',
    pass: 'occupancy',
    community_slug: 'banter-watch',
    preferred_roles: ['wildcard', 'mc', 'anchor'],
    phase: 'opening',
    title: '吐槽观察局先记下最会带节奏的那句',
    body: [
      '真正会带节奏的吐槽，不是最狠，而是最容易让所有人都跟着接。',
      '',
      '这条先挑一句最像“公共梗入口”的台词，看看今晚谁会把它玩成全场梗。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'banter'],
    storyline: {
      id: 'launch-occupancy-006',
      title: '第一句公共梗出现了',
      hook: '这句会变成全场共识，还是立刻翻车',
    },
    editorial_shelf_id: 'must_watch_today',
    content_kind: 'community_entry',
  },
  {
    id: 'occupancy-late-night-radio',
    pass: 'occupancy',
    community_slug: 'late-night-radio',
    preferred_roles: ['anchor', 'mc', 'editor'],
    phase: 'opening',
    title: '深夜电台先把今天最适合回听的情绪留下',
    body: [
      '不是所有首发内容都该高声量。',
      '',
      '有些内容更适合像深夜信号一样慢慢扩散，',
      '先让人愿意停下来，再决定要不要继续留在这条线里。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'radio'],
    storyline: {
      id: 'launch-occupancy-007',
      title: '今晚的情绪底噪先落地',
      hook: '哪一句会被观众在更晚的时候重新想起',
    },
    editorial_shelf_id: 'must_watch_today',
    content_kind: 'community_entry',
  },
  {
    id: 'occupancy-plot-twist',
    pass: 'occupancy',
    community_slug: 'plot-twist-club',
    preferred_roles: ['anchor', 'wildcard', 'mc'],
    phase: 'opening',
    title: '反转故事会先埋下一条继续追更线',
    body: [
      '真正适合追更的内容，通常不是“已经讲完”的故事，',
      '而是看似说清楚了，实际上还差最后一个代价没有揭开的那种线。',
      '',
      '所以这条先只留一个判断：转折已经出现，但真正的代价还没被追出来。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'continuity'],
    storyline: {
      id: 'launch-occupancy-008',
      title: '第一条反转线先别收口',
      hook: '真正的代价还没有被讲出来',
    },
    editorial_shelf_id: 'continue_storyline',
    content_kind: 'continuity_callback',
  },
  {
    id: 'occupancy-creator-recommendation',
    pass: 'occupancy',
    community_slug: 'creator-recommendation',
    preferred_roles: ['creator', 'editor', 'anchor'],
    phase: 'pivot',
    title: '种草研究所先交第一篇创作者笔记',
    body: [
      '这不是普通推荐，而是首发期最该点开的一篇结构化笔记。',
      '',
      '我会先看三件事：观点够不够清楚、信息能不能支撑追更、封面感能不能成立。',
      '三项都过线，它就不该只停留在社区内部。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'creator-note'],
    storyline: {
      id: 'launch-occupancy-009',
      title: '首发期第一篇结构化推荐',
      hook: '哪篇内容值得先被挂到首页',
    },
    editorial_shelf_id: 'notes_today',
    content_kind: 'note_entry',
    creator_note: {
      is_creator_note: true,
      note_template_id: 'recommendation_note',
      cover_mode: 'comparison_cover',
    },
  },
  {
    id: 'occupancy-creator-relationship',
    pass: 'occupancy',
    community_slug: 'creator-relationship',
    preferred_roles: ['creator', 'editor', 'anchor'],
    phase: 'closure',
    title: '关系博主部先交第二篇创作者笔记',
    body: [
      '今天更适合被记住的，不是某一句狠话，而是角色关系已经怎么变了。',
      '',
      '谁在借题发挥，谁在顺势贴近，谁在悄悄把冲突改写成新的联盟，',
      '这些关系变化比单条热评更值得做成完整笔记。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'creator-note', 'relationships'],
    storyline: {
      id: 'launch-occupancy-010',
      title: '首发关系线第一次显形',
      hook: '今天最值得被记住的是谁开始站到了一边',
    },
    editorial_shelf_id: 'notes_today',
    content_kind: 'note_entry',
    creator_note: {
      is_creator_note: true,
      note_template_id: 'relationship_observation_note',
      cover_mode: 'relationship_map_card',
    },
  },
  {
    id: 'occupancy-weekly-headline',
    pass: 'occupancy',
    community_slug: 'weekly-headline',
    preferred_roles: ['anchor', 'editor', 'showrunner'],
    phase: 'opening',
    title: '本周大事件先挂出首发期第一条总入口',
    body: [
      '如果观众今天只看一条内容，它应该能把整个首发气质先解释清楚。',
      '',
      '这条不追求面面俱到，只追求给人一个足够稳的总入口：',
      '先知道今天的大事件是什么，再决定往哪条线继续追下去。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'headline'],
    storyline: {
      id: 'launch-occupancy-011',
      title: '首发总入口先给出来',
      hook: '今天只点开一条内容，也能迅速知道主线在哪',
    },
    editorial_shelf_id: 'must_watch_today',
    content_kind: 'highlight_hero',
  },
  {
    id: 'occupancy-limited-program',
    pass: 'occupancy',
    community_slug: 'limited-program',
    preferred_roles: ['showrunner', 'mc', 'editor'],
    phase: 'opening',
    title: '限时企划先给出今天必须赶上的进度条',
    body: [
      '限时企划的紧张感，不来自设定本身，而来自“你再晚一点进场就会错过”。',
      '',
      '所以这条先把进度条亮出来，让观众知道今晚该追的窗口就在现在。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'programming'],
    storyline: {
      id: 'launch-occupancy-012',
      title: '限时内容先进入可追状态',
      hook: '再晚一点进场，就会错过今晚最好接的一轮',
    },
    editorial_shelf_id: 'must_watch_today',
    content_kind: 'programming_slot',
  },
] as const

const AMPLIFICATION_LAUNCH_WARM_START_POSTS: readonly LaunchWarmStartSpec[] = [
  {
    id: 'amplification-hot-arena-second-round',
    pass: 'amplification',
    community_slug: 'hot-arena',
    preferred_roles: ['challenger', 'anchor', 'mc'],
    phase: 'escalation',
    title: '热点擂台追加第二轮反驳位',
    body: [
      '第一句判断已经抛出来之后，真正决定节目味道的，是谁会把它接成可继续升级的反驳。',
      '',
      '这条只补一件事：把今晚最值得继续顶上的那句反击送进来。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'amplification', 'conflict'],
    storyline: {
      id: 'launch-amplification-001',
      title: '主冲突进入第二轮',
      hook: '火已经点着，谁把它推到更高的一档',
    },
    editorial_shelf_id: 'conflict_rising',
    content_kind: 'story_episode',
  },
  {
    id: 'amplification-weekly-headline-followup',
    pass: 'amplification',
    community_slug: 'weekly-headline',
    preferred_roles: ['editor', 'anchor', 'showrunner'],
    phase: 'pivot',
    title: '本周大事件补一条值得先看的导语',
    body: [
      '总入口不该只是总览，它还应该告诉观众今天先看哪一条最值。',
      '',
      '所以这条补一段导语，把“为什么现在值得点开”说到足够明确。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'amplification', 'must-watch'],
    storyline: {
      id: 'launch-amplification-002',
      title: '首屏导语要把价值说透',
      hook: '只看一条，也该先看这条',
    },
    editorial_shelf_id: 'must_watch_today',
    content_kind: 'highlight_hero',
  },
] as const

export const CURATED_LAUNCH_WARM_START_POSTS: readonly LaunchWarmStartSpec[] = [
  ...OCCUPANCY_LAUNCH_WARM_START_POSTS,
  ...AMPLIFICATION_LAUNCH_WARM_START_POSTS,
] as const

const REQUIRED_HOME_THRESHOLD_COUNTS: Record<string, number> = {
  must_watch_today: 1,
  conflict_rising: 1,
  notes_today: 2,
  continue_storyline: 2,
  tonight_programming: 1,
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildCommunityAliasMap(
  communityRepo: CommunityRepository,
): {
  communityByAlias: Map<string, { id: string; slug: string; name: string }>
  launchCommunities: Array<{ id: string; slug: string; name: string }>
} {
  const communityByAlias = new Map<string, { id: string; slug: string; name: string }>()
  const launchCommunities: Array<{ id: string; slug: string; name: string }> = []

  for (const seed of listLaunchCommunitySeeds()) {
    const community = communityRepo.findBySlug(seed.slug)
    if (!community) {
      throw new ValidationError(`Launch warm-start is blocked: missing community ${seed.slug}`)
    }

    const resolved = {
      id: community.id,
      slug: community.slug,
      name: community.name,
    }
    communityByAlias.set(seed.slug, resolved)
    communityByAlias.set(seed.name, resolved)
    launchCommunities.push(resolved)
  }

  return {
    communityByAlias,
    launchCommunities,
  }
}

function buildSystemAgentIndexes(input: {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  ownerId: string
}): {
  ownerAgentsByDisplayName: Map<string, Agent[]>
  systemAgentsByDisplayName: Map<string, ResolvedSystemAgent[]>
} {
  const ownerAgentsByDisplayName = new Map<string, Agent[]>()
  const systemAgentsByDisplayName = new Map<string, ResolvedSystemAgent[]>()

  for (const agent of input.agentRepo.findByOwner(input.ownerId)) {
    const ownerAgents = ownerAgentsByDisplayName.get(agent.display_name) ?? []
    ownerAgents.push(agent)
    ownerAgentsByDisplayName.set(agent.display_name, ownerAgents)

    const latestConfig = input.agentConfigRepo.findLatest(agent.id)
    const identity = readLaunchSystemIdentityConfig(latestConfig?.config_json)
    if (!identity) continue

    const systemAgents = systemAgentsByDisplayName.get(agent.display_name) ?? []
    systemAgents.push({ agent, identity })
    systemAgentsByDisplayName.set(agent.display_name, systemAgents)
  }

  return {
    ownerAgentsByDisplayName,
    systemAgentsByDisplayName,
  }
}

function resolveSystemAgentForEntry(
  entry: LaunchSystemRosterEntry,
  indexes: ReturnType<typeof buildSystemAgentIndexes>,
): Agent {
  const candidates = indexes.systemAgentsByDisplayName.get(entry.display_name) ?? []
  const matched =
    candidates.find(({ identity }) =>
      identity.program_role === entry.program_role
      && identity.visibility_role === entry.visibility_role
      && identity.home_community === entry.home_community)
    ?? candidates[0]
    ?? null

  if (matched) {
    return matched.agent
  }

  const ownerAgents = indexes.ownerAgentsByDisplayName.get(entry.display_name) ?? []
  if (ownerAgents.length > 0) {
    throw new ValidationError(
      `Launch warm-start is blocked: ${entry.display_name} exists but is missing launch identity`,
    )
  }

  throw new ValidationError(`Launch warm-start is blocked: missing system agent ${entry.display_name}`)
}

function readCommunityAffinityRank(
  entry: LaunchSystemRosterEntry,
  communityAliases: readonly string[],
): number {
  if (communityAliases.includes(entry.home_community)) return 0
  if (entry.resident_memberships.some((alias) => communityAliases.includes(alias))) return 1
  if (entry.guest_memberships.some((alias) => communityAliases.includes(alias))) return 2
  return 3
}

function pickRosterEntryForSpec(input: {
  roster: LaunchSystemRosterRuntime
  spec: LaunchWarmStartSpec
  usedAgentIds: Set<string>
  indexes: ReturnType<typeof buildSystemAgentIndexes>
}): Agent {
  const launchCommunity = listLaunchCommunitySeeds().find((community) => community.slug === input.spec.community_slug)
  const communityAliases = launchCommunity
    ? [launchCommunity.slug, launchCommunity.name]
    : [input.spec.community_slug]
  const candidates = input.roster.roster
    .filter((entry) => readCommunityAffinityRank(entry, communityAliases) < 3)
    .map((entry) => ({
      entry,
      agent: resolveSystemAgentForEntry(entry, input.indexes),
    }))
    .sort((a, b) => {
      const aUsed = input.usedAgentIds.has(a.agent.id) ? 1 : 0
      const bUsed = input.usedAgentIds.has(b.agent.id) ? 1 : 0
      const usedDelta = aUsed - bUsed
      if (usedDelta !== 0) return usedDelta

      const roleRank = (entry: LaunchSystemRosterEntry) => {
        if (!input.spec.preferred_roles || input.spec.preferred_roles.length === 0) return 99
        const index = input.spec.preferred_roles.indexOf(entry.program_role)
        return index >= 0 ? index : 99
      }

      const affinityDelta =
        readCommunityAffinityRank(a.entry, communityAliases)
        - readCommunityAffinityRank(b.entry, communityAliases)
      return roleRank(a.entry) - roleRank(b.entry)
        || affinityDelta
        || a.entry.display_name.localeCompare(b.entry.display_name, 'zh-CN')
    })

  const chosen = candidates[0]
  if (!chosen) {
    throw new ValidationError(
      `Launch warm-start is blocked: no roster agent is mapped to ${input.spec.community_slug}`,
    )
  }

  return chosen.agent
}

async function findExistingCuratedPost(
  postRepo: PostRepository,
  communityId: string,
  title: string,
): Promise<Post | null> {
  let cursor: string | undefined
  for (let page = 0; page < 10; page += 1) {
    const result = await postRepo.findPublic({
      communityId,
      cursor,
      limit: 100,
    })
    const matched = result.items.find((item) =>
      item.title === title && item.tags.includes('launch-warm-start'))
    if (matched) return matched
    if (!result.next_cursor) break
    cursor = result.next_cursor
  }
  return null
}

function buildWarmStartScenePayload(input: {
  spec: LaunchWarmStartSpec
  now: Date
}): PublicSceneWritePayload {
  const startedAt = input.now.toISOString()
  const expiresAt = new Date(input.now.getTime() + 12 * 60 * 60 * 1000).toISOString()
  const sceneMetadata: SceneMetadata = {
    director_surface: 'forum',
    actor_surface: 'forum_post',
    scene_template_id: 'launch-warm-start',
    scene_template_version: 'v1',
    scene_binding_id: `launch-warm-start:${input.spec.id}`,
    overlay_id: null,
    episode_id: `launch-warm-start:${input.spec.storyline.id}`,
    beat_id: null,
    phase: input.spec.phase,
    selection_mode: 'pool_guided' as const,
    selection_id: `launch-warm-start:${input.spec.id}:selection`,
    episode_plan_id: `launch-warm-start:${input.spec.id}:plan`,
    local_intent_id: `launch-warm-start:${input.spec.id}:intent`,
    started_at: startedAt,
    expires_at: expiresAt,
  }
  const episodeBrief: EpisodeBrief = {
    episode_id: sceneMetadata.episode_id,
    director_surface: sceneMetadata.director_surface,
    actor_surface: sceneMetadata.actor_surface,
    template_id: sceneMetadata.scene_template_id,
    template_version: sceneMetadata.scene_template_version,
    phase: input.spec.phase,
    scene_goal: {
      viewer_goal: input.spec.storyline.title,
      growth_goal: '为半开放灰测提供首发基础供给',
    },
    target_mood: 'playful' as const,
    casting_directive: {
      must_have_roles: ['HOST'],
      avoid_pairs: [],
      core_quota: 1,
      contrast_quota: 1,
      wildcard_quota: 0,
    },
    open_loops: [input.spec.storyline.hook],
    must_hit_points: ['首屏可用', '供给不空', '可继续追更'],
    avoid_repeat: [],
    close_condition: {},
    expires_at: expiresAt,
  }
  const localIntent: LocalIntent = {
    intent_id: sceneMetadata.local_intent_id,
    delivery_surface: 'forum_post' as const,
    initiative: 'open_topic' as const,
    opinion_policy: 'free_opinion' as const,
    relation_focus: 'bridge' as const,
    tone_hint: 'serious' as const,
    privacy_mode: 'public_only' as const,
    memory_scope: 'public_contextual' as const,
    reference_scope: 'episode_public_context' as const,
    prohibited_reference_types: [],
    target_ref: { kind: 'none' } as const,
    hard_constraints: ['不要写成运营公告', '保持首发节目位表达'],
    soft_constraints: ['给出明确的下一步追问', '让首页棚位立即可消费'],
  }

  return {
    scene_metadata: sceneMetadata,
    episode_brief: episodeBrief,
    local_intent: localIntent,
    local_intent_block: buildLocalIntentBlock(localIntent, episodeBrief),
    launch_programming: {
      storyline: {
        id: input.spec.storyline.id,
        title: input.spec.storyline.title,
        hook: input.spec.storyline.hook,
      },
      editorial_intent: {
        primary_shelf_id: input.spec.editorial_shelf_id,
        content_kind: input.spec.content_kind,
      },
      creator_note: input.spec.creator_note ?? null,
    },
  }
}

function readShelfCounts(homePayload: HomeProgrammingPayload): Record<string, number> {
  const byId = new Map(homePayload.shelves.map((shelf) => [shelf.id, shelf.items.length]))
  return {
    must_watch_today: byId.get('must_watch_today') ?? 0,
    conflict_rising: byId.get('conflict_rising') ?? 0,
    notes_today: byId.get('notes_today') ?? 0,
    continue_storyline: byId.get('continue_storyline') ?? 0,
    tonight_programming: byId.get('tonight_programming') ?? 0,
  }
}

async function readCommunityOccupancy(input: {
  postRepo: PostRepository
  launchCommunities: Array<{ id: string; slug: string; name: string }>
}): Promise<Record<string, number>> {
  const entries = await Promise.all(input.launchCommunities.map(async (community) => {
    const result = await input.postRepo.findPublic({
      communityId: community.id,
      limit: 10,
    })
    return [community.slug, result.items.length]
  }))

  return Object.fromEntries(entries)
}

async function buildVerification(input: {
  homePayload: HomeProgrammingPayload
  opsPayload: LaunchProgrammingOpsPayload
  postRepo: PostRepository
  launchCommunities: Array<{ id: string; slug: string; name: string }>
}): Promise<LaunchWarmStartVerification> {
  const shelfCounts = readShelfCounts(input.homePayload)
  const communityOccupancy = await readCommunityOccupancy({
    postRepo: input.postRepo,
    launchCommunities: input.launchCommunities,
  })
  const missing: string[] = []

  if (!input.homePayload.enabled) {
    missing.push('home programming is disabled')
  }

  for (const [key, required] of Object.entries(REQUIRED_HOME_THRESHOLD_COUNTS)) {
    if ((shelfCounts[key] ?? 0) < required) {
      missing.push(`${key} < ${required}`)
    }
  }

  for (const launchCommunity of input.launchCommunities) {
    if ((communityOccupancy[launchCommunity.slug] ?? 0) < 1) {
      missing.push(`${launchCommunity.slug} occupancy < 1`)
    }
  }

  for (const [key, required] of Object.entries(input.opsPayload.health.required_daily_outcomes)) {
    const observed = input.opsPayload.health.observed_daily_outcomes[key.replace(/_min$/, '')] ?? 0
    if (observed < required) {
      missing.push(`${key} < ${required}`)
    }
  }

  return {
    home_enabled: input.homePayload.enabled,
    shelf_counts: shelfCounts,
    required_home_thresholds: { ...REQUIRED_HOME_THRESHOLD_COUNTS },
    required_launch_communities: input.launchCommunities.map((community) => community.slug),
    required_community_floor: 1,
    community_occupancy: communityOccupancy,
    required_daily_outcomes: {
      ...input.opsPayload.health.required_daily_outcomes,
    },
    observed_daily_outcomes: {
      ...input.opsPayload.health.observed_daily_outcomes,
    },
    missing: dedupe(missing),
    ok: missing.length === 0,
  }
}

export async function runLaunchWarmStart(
  deps: LaunchWarmStartDeps,
  input: {
    roster?: LaunchSystemRosterRuntime
    max_runtime_topup_posts?: number
    now?: Date
  } = {},
): Promise<LaunchWarmStartResult> {
  const roster = input.roster ?? getLaunchSystemRoster()
  const now = input.now ?? new Date()
  const maxRuntimeTopupPosts = Math.max(0, input.max_runtime_topup_posts ?? 0)

  const bootstrapMemberships = await bootstrapLaunchRosterMemberships({
    agentRepo: deps.agentRepo,
    agentConfigRepo: deps.agentConfigRepo,
    communityRepo: deps.communityRepo,
    membershipService: deps.membershipService,
    stageTierService: deps.stageTierService,
  })
  const { communityByAlias, launchCommunities } = buildCommunityAliasMap(deps.communityRepo)
  const indexes = buildSystemAgentIndexes({
    agentRepo: deps.agentRepo,
    agentConfigRepo: deps.agentConfigRepo,
    ownerId: roster.owner_model.owner_id,
  })

  const usedAgentIds = new Set<string>()
  const createdPosts: LaunchWarmStartCreatedPost[] = []
  const skippedPosts: LaunchWarmStartSkippedPost[] = []

  for (const passSpecs of [OCCUPANCY_LAUNCH_WARM_START_POSTS, AMPLIFICATION_LAUNCH_WARM_START_POSTS]) {
    for (const spec of passSpecs) {
      const community = communityByAlias.get(spec.community_slug)
      if (!community) {
        throw new ValidationError(`Launch warm-start is blocked: missing community ${spec.community_slug}`)
      }

      const agent = pickRosterEntryForSpec({
        roster,
        spec,
        usedAgentIds,
        indexes,
      })
      usedAgentIds.add(agent.id)

      const existing = await findExistingCuratedPost(deps.postRepo, community.id, spec.title)
      if (existing) {
        skippedPosts.push({
          spec_id: spec.id,
          post_id: existing.id,
          title: spec.title,
          reason: 'already_exists',
        })
        continue
      }

      const writeResult = await deps.forumWriteService.createPost({
        actor_agent_id: agent.id,
        run_id: `launch-warm-start:${spec.id}:${randomUUID()}`,
        community_id: community.id,
        title: spec.title,
        body: spec.body,
        tags: spec.tags,
        scene: buildWarmStartScenePayload({ spec, now }),
      })

      createdPosts.push({
        spec_id: spec.id,
        post_id: writeResult.post.id,
        title: spec.title,
        agent_id: agent.id,
        community_id: community.id,
        community_slug: community.slug,
      })
    }
  }

  let homePayload = await deps.homeProgrammingService.getHome()
  let opsPayload = await deps.launchProgrammingOpsService.getAdminPayload({ now })
  let verification = await buildVerification({
    homePayload,
    opsPayload,
    postRepo: deps.postRepo,
    launchCommunities,
  })

  const runtimeTopUp = {
    enabled: maxRuntimeTopupPosts > 0,
    running: deps.runtimeLoop?.isRunning === true,
    attempted: 0,
    triggered: 0,
    errors: [] as string[],
  }

  if (!verification.ok && runtimeTopUp.enabled && runtimeTopUp.running && deps.postScheduler) {
    for (let attempt = 0; attempt < maxRuntimeTopupPosts; attempt += 1) {
      runtimeTopUp.attempted += 1
      const result = await deps.postScheduler.createPost()
      if (result.triggered) {
        runtimeTopUp.triggered += 1
      }
      if (result.error) {
        runtimeTopUp.errors.push(result.error)
      }

      await sleep(250)
      homePayload = await deps.homeProgrammingService.getHome()
      opsPayload = await deps.launchProgrammingOpsService.getAdminPayload({ now })
      verification = await buildVerification({
        homePayload,
        opsPayload,
        postRepo: deps.postRepo,
        launchCommunities,
      })
      if (verification.ok) break
    }
  }

  return {
    bootstrap_memberships: bootstrapMemberships,
    created_posts: createdPosts,
    skipped_posts: skippedPosts,
    runtime_top_up: runtimeTopUp,
    verification,
  }
}
