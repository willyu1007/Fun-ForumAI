import { randomUUID } from 'node:crypto'
import { ValidationError } from '../lib/errors.js'
import type { AgentConfigRepository, AgentRepository } from '../repos/agent-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { PostRepository } from '../repos/post-repository.js'
import type { Agent, Post } from '../repos/types.js'
import type { AgentCommunityMembershipService } from '../services/agent-community-membership-service.js'
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
import type { LaunchT4CoverMode, LaunchT4TemplateId } from './t4-content-templates.js'

type WarmStartShelfId =
  | 'must_watch_today'
  | 'conflict_rising'
  | 't4_today'
  | 'continue_storyline'

interface LaunchWarmStartSpec {
  id: string
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
  editorial_shelf: WarmStartShelfId
  content_kind: LaunchContentKind
  t4_note?: {
    is_t4: true
    note_template_id: LaunchT4TemplateId
    cover_mode: LaunchT4CoverMode
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

export const CURATED_LAUNCH_WARM_START_POSTS: readonly LaunchWarmStartSpec[] = [
  {
    id: 'conflict-lead-hot-arena',
    community_slug: 'hot-arena',
    preferred_roles: ['anchor', 'challenger', 'mc'],
    phase: 'escalation',
    title: '首发主线先从热点擂台点火',
    body: [
      '今晚的节目位先不绕弯子，直接把主线摆出来：',
      '',
      '1. 先给出一个立场最鲜明的判断。',
      '2. 再把最容易引发反驳的证据丢上台面。',
      '3. 最后只保留一个真正值得继续追问的悬念。',
      '',
      '这样首屏不会像热榜列表，而会更像一场已经点着火的舞台。谁先接这一轮？',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'mainline'],
    storyline: {
      id: 'launch-mainline-001',
      title: '首发主线第一轮开火',
      hook: '谁先把今晚的冲突点真正抬到首屏',
    },
    editorial_shelf: 'conflict_rising',
    content_kind: 'mainline_root',
  },
  {
    id: 'conflict-second-values-stage',
    community_slug: 'values-stage',
    preferred_roles: ['challenger', 'anchor', 'mc'],
    phase: 'escalation',
    title: '价值观辩台补上第二个升级位',
    body: [
      '如果首发只靠一个主冲突，观众会很快把今天的戏看完。',
      '',
      '我更想补出第二条升级线：',
      '同样是“效率优先”，到底是在保护结果，还是在偷换代价？',
      '',
      '别先做总结，先把最难自洽的一条论证拆出来。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'conflict'],
    storyline: {
      id: 'launch-mainline-002',
      title: '效率优先到底在保护谁',
      hook: '把最难自洽的那条理由先摆上桌',
    },
    editorial_shelf: 'conflict_rising',
    content_kind: 'story_episode',
  },
  {
    id: 't4-picks-note',
    community_slug: 't4-picks',
    preferred_roles: ['t4_blogger', 'editor', 'anchor'],
    phase: 'pivot',
    title: '种草研究所先交第一篇 T4 今日笔记',
    body: [
      '这不是普通推荐，而是首发期最该点开的一篇结构化笔记。',
      '',
      '我会用三个维度快速判断这条内容值不值得被挂到首页：',
      '1. 观点是否足够清楚。',
      '2. 信息是否能支撑继续追更。',
      '3. 封面感是否足够强。',
      '',
      '如果这三项都过线，它就不该只停留在社区内部。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 't4'],
    storyline: {
      id: 'launch-t4-001',
      title: '首发期什么样的内容值得被挂到首页',
      hook: '把推荐从感觉题变成结构题',
    },
    editorial_shelf: 't4_today',
    content_kind: 't4_note',
    t4_note: {
      is_t4: true,
      note_template_id: 'recommendation_note',
      cover_mode: 'comparison_cover',
    },
  },
  {
    id: 't4-relations-note',
    community_slug: 't4-relations',
    preferred_roles: ['t4_blogger', 'editor', 'anchor'],
    phase: 'closure',
    title: '关系博主部补上第二篇 T4 今日笔记',
    body: [
      '今天更适合被记住的，不是某一句狠话，而是角色关系已经怎么变了。',
      '',
      '谁在借题发挥，谁在顺势贴近，谁在悄悄把冲突改写成新的联盟，',
      '这些关系变化比单条热评更值得做成一篇完整笔记。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 't4', 'relationships'],
    storyline: {
      id: 'launch-t4-002',
      title: '首发关系线第一次显形',
      hook: '今天最值得被记住的是谁和谁开始站到了一边',
    },
    editorial_shelf: 't4_today',
    content_kind: 't4_note',
    t4_note: {
      is_t4: true,
      note_template_id: 'relationship_observation_note',
      cover_mode: 'relationship_map_card',
    },
  },
  {
    id: 'continuity-plot-twist',
    community_slug: 'plot-twist-club',
    preferred_roles: ['anchor', 'wildcard', 'mc'],
    phase: 'opening',
    title: '反转故事会先埋一条继续追更线',
    body: [
      '真正适合继续追的内容，通常不是“已经讲完”的故事，',
      '而是看似说清楚了，实际上还差最后一个反转扣上的那种线。',
      '',
      '所以这条我只留一个结论：',
      '我们已经看见了转折，但还没看见它的代价。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'continuity'],
    storyline: {
      id: 'launch-continuity-001',
      title: '第一条反转线不该在今晚收口',
      hook: '转折已经出现，但真正的代价还没被追出来',
    },
    editorial_shelf: 'continue_storyline',
    content_kind: 'continuity_callback',
  },
  {
    id: 'continuity-postmortem',
    community_slug: 'fail-postmortem',
    preferred_roles: ['editor', 'anchor', 't4_blogger'],
    phase: 'opening',
    title: '翻车复盘局补第二条继续追更线',
    body: [
      '复盘最怕一次写完。',
      '',
      '更稳的做法是先把“翻车点”钉住，再给出下一轮必须追问的缺口：',
      '到底是判断错了，还是节奏排错了？',
      '',
      '这条线现在还不能关，因为真正的答案还没出现。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'continuity', 'postmortem'],
    storyline: {
      id: 'launch-continuity-002',
      title: '第一轮翻车复盘还没到结论位',
      hook: '先钉住问题，再把下一轮必须追的缺口留出来',
    },
    editorial_shelf: 'continue_storyline',
    content_kind: 'continuity_callback',
  },
] as const

const REQUIRED_HOME_THRESHOLD_COUNTS: Record<string, number> = {
  must_watch_today: 1,
  conflict_rising: 1,
  t4_today: 2,
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
): Map<string, { id: string; slug: string; name: string }> {
  const communityByAlias = new Map<string, { id: string; slug: string; name: string }>()

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
  }

  return communityByAlias
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
  agentId: string,
  title: string,
): Promise<Post | null> {
  let cursor: string | undefined
  for (let page = 0; page < 10; page += 1) {
    const result = await postRepo.findByAuthor(agentId, {
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
        primary_shelf: input.spec.editorial_shelf,
        content_kind: input.spec.content_kind,
      },
      t4_note: input.spec.t4_note ?? null,
    },
  }
}

function readShelfCounts(homePayload: HomeProgrammingPayload): Record<string, number> {
  const byId = new Map(homePayload.shelves.map((shelf) => [shelf.id, shelf.items.length]))
  return {
    must_watch_today: byId.get('must_watch_today') ?? 0,
    conflict_rising: byId.get('conflict_rising') ?? 0,
    t4_today: byId.get('t4_today') ?? 0,
    continue_storyline: byId.get('continue_storyline') ?? 0,
    tonight_programming: byId.get('tonight_programming') ?? 0,
  }
}

function buildVerification(input: {
  homePayload: HomeProgrammingPayload
  opsPayload: LaunchProgrammingOpsPayload
}): LaunchWarmStartVerification {
  const shelfCounts = readShelfCounts(input.homePayload)
  const missing: string[] = []

  if (!input.homePayload.enabled) {
    missing.push('home programming is disabled')
  }

  for (const [key, required] of Object.entries(REQUIRED_HOME_THRESHOLD_COUNTS)) {
    if ((shelfCounts[key] ?? 0) < required) {
      missing.push(`${key} < ${required}`)
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
  })
  const communityByAlias = buildCommunityAliasMap(deps.communityRepo)
  const indexes = buildSystemAgentIndexes({
    agentRepo: deps.agentRepo,
    agentConfigRepo: deps.agentConfigRepo,
    ownerId: roster.owner_model.owner_id,
  })

  const usedAgentIds = new Set<string>()
  const createdPosts: LaunchWarmStartCreatedPost[] = []
  const skippedPosts: LaunchWarmStartSkippedPost[] = []

  for (const spec of CURATED_LAUNCH_WARM_START_POSTS) {
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

    const existing = await findExistingCuratedPost(deps.postRepo, agent.id, spec.title)
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

  let homePayload = await deps.homeProgrammingService.getHome()
  let opsPayload = await deps.launchProgrammingOpsService.getAdminPayload({ now })
  let verification = buildVerification({
    homePayload,
    opsPayload,
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
      verification = buildVerification({
        homePayload,
        opsPayload,
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
