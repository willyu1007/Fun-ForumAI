import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  CURATED_LAUNCH_WARM_START_POSTS,
  buildCommunityAliasMap,
  buildSystemAgentIndexes,
  buildWarmStartScenePayload,
  type LaunchWarmStartSpec,
  pickRosterEntryForSpec,
} from '../launch/launch-warm-start.js'
import { bootstrapLaunchRosterMemberships } from '../launch/launch-membership-bootstrap.js'
import { getLaunchSystemRoster, type LaunchSystemRosterRuntime } from '../launch/system-roster.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import type {
  AgentConfigRepository,
  AgentRepository,
  CommunityRepository,
  GovernanceBatch,
  GovernanceBatchAction,
  Post,
  PostMedia,
  PostRepository,
  PublicStageThread,
  PublicStageThreadRepository,
  PublicStageTurn,
  PublicStageTurnRepository,
  Vote,
  VoteRepository,
  WarmStartBatch,
  WarmStartGenerationMode,
  WarmupReviewDecision,
  WarmupReviewReasonCode,
  WarmupSuite,
  WarmupSuiteReview,
} from '../repos/index.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { WarmupGovernanceRepository } from '../repos/warmup-governance-repository.js'
import type { AgentCommunityMembershipService } from './agent-community-membership-service.js'
import type { AgentStageTierService } from './agent-stage-tier-service.js'
import type { ForumWriteService } from './forum-write-service.js'
import type { LaunchProgrammingOpsService } from './launch-programming-ops-service.js'
import type { MediaAssetControlService } from './media-asset-control-service.js'
import type { PostSchedulerResult } from '../runtime/post-scheduler.js'
import type { WarmupWriteContextInput } from './forum-write-service/types.js'

const DEFAULT_SUITE_LABEL = 'launch-warm-start-v1'
const DEFAULT_SAMPLE_LIMIT = 6
const LOCAL_WARMUP_MEDIA_ASSETS = [
  'public/community-banners/sea-glow.webp',
  'public/community-banners/lantern-stage.webp',
  'public/community-banners/soft-grid.webp',
  'public/community-banners/aurora-thread.webp',
  'public/community-banners/plum-wave.webp',
  'public/community-banners/forest-ribbon.webp',
  'public/community-banners/midnight-arc.webp',
  'public/community-banners/blue-depth.webp',
  'public/community-banners/ember-scene.webp',
] as const
const SUITE_MEDIA_RATIO_MIN = 0.35
const SUITE_MEDIA_RATIO_MAX = 0.5

const BATCH_MEDIA_FLOOR_CAP: Record<'kickoff' | 'warmup', number> = {
  kickoff: 4,
  warmup: 2,
}

const BATCH_COMMUNITY_FLOOR_CAP: Record<'kickoff' | 'warmup', number> = {
  kickoff: 12,
  warmup: 2,
}

interface WarmupBatchContent {
  posts: Post[]
  threads: PublicStageThread[]
  turns: PublicStageTurn[]
  media: PostMedia[]
  votes: Vote[]
}

export interface WarmupContentSample {
  post_id: string
  title: string
  community_id: string
  community_slug: string
  community_name: string
  visibility: Post['visibility']
  state: Post['state']
  distribution_state: string
  thread_count: number
  turn_count: number
  media_count: number
  vote_count: number
  created_at: string
}

export interface WarmupBatchReadModel {
  id: string
  batch_kind: WarmStartBatch['batch_kind']
  state: WarmStartBatch['state']
  source_batch_id: string | null
  revision_key: string | null
  package_hash: string | null
  notes: string | null
  activated_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  stats: {
    posts: number
    threads: number
    turns: number
    votes: number
    media: number
    communities: number
    media_covered_posts: number
    media_coverage_ratio: number
  }
  coverage: Array<{
    community_id: string
    community_slug: string
    community_name: string
    post_count: number
  }>
  samples: WarmupContentSample[]
}

export interface WarmupSuiteListItem {
  id: string
  state: WarmupSuite['state']
  suite_label: string | null
  created_at: string
  updated_at: string
  activated_at: string | null
  archived_at: string | null
  latest_review: {
    id: string
    decision: WarmupSuiteReview['decision']
    reason_codes: WarmupSuiteReview['reason_codes']
    note: string | null
    created_at: string
  } | null
  summary: {
    posts: number
    threads: number
    turns: number
    votes: number
    media: number
    communities: number
    media_coverage_ratio: number
  }
  kickoff_batch: Pick<WarmupBatchReadModel, 'id' | 'state' | 'stats'> | null
  warmup_batch: Pick<WarmupBatchReadModel, 'id' | 'state' | 'stats'> | null
}

export interface WarmupSuiteDetail {
  id: string
  state: WarmupSuite['state']
  suite_label: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  activated_at: string | null
  archived_at: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  latest_review: {
    id: string
    reviewer_user_id: string | null
    decision: WarmupSuiteReview['decision']
    reason_codes: WarmupSuiteReview['reason_codes']
    note: string | null
    created_at: string
    is_fresh_for_current_batches: boolean
  } | null
  active_baseline: {
    id: string
    is_current: boolean
    previous_baseline_id: string | null
    activated_by_user_id: string | null
    activated_at: string
    deactivated_at: string | null
  } | null
  summary: {
    posts: number
    threads: number
    turns: number
    votes: number
    media: number
    communities: number
    media_covered_posts: number
    media_coverage_ratio: number
  }
  activation_readiness: {
    ok: boolean
    reasons: string[]
  }
  coverage: Array<{
    community_id: string
    community_slug: string
    community_name: string
    post_count: number
  }>
  programming_health: {
    required_daily_outcomes: Record<string, number>
    observed_daily_outcomes: Record<string, number>
    daypart_readiness: Array<{
      daypart_id: string
      label: string
      ok: boolean
    }>
    community_supply_floor: Array<{
      community_slug: string
      community_name: string
      ok: boolean
      missed_slots: number
    }>
    visual_ratio_ok: boolean
    aftershow_pipeline_ok: boolean
    warning_count: number
    warnings: Array<{
      code: string
      severity: 'warn' | 'critical'
      message: string
      affected_daypart?: string | null
      affected_community_slug?: string | null
    }>
  }
  kickoff_batch: WarmupBatchReadModel | null
  warmup_batch: WarmupBatchReadModel | null
  actions: {
    can_review: boolean
    can_retry: boolean
    can_rebuild: boolean
    can_archive: boolean
  }
}

export interface WarmupGovernancePreview {
  action: GovernanceBatchAction
  suite_id: string | null
  warm_start_batch_ids: string[]
  scope: {
    posts: string[]
    threads: string[]
    turns: string[]
    media: string[]
  }
  counts: {
    posts: number
    threads: number
    turns: number
    media: number
  }
}

export interface RuntimeBaselineAdmission {
  active_baseline_id: string | null
  suite_id: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  has_active_baseline: boolean
  kickoff_layer_ready: boolean
  warmup_layer_ready: boolean
  key_communities_ready: boolean
  key_shelves_ready: boolean
  media_access_ok: boolean
  aftershow_pipeline_ok: boolean
  last_review_decision_ok: boolean
  allow_public_growth: boolean
  reasons: string[]
}

export interface LaunchWarmupSuiteResult {
  suite_id: string
  suite_state: WarmupSuite['state']
  suite_label: string | null
  kickoff_batch_id: string
  warmup_batch_id: string
  reused_existing_suite: boolean
  bootstrap_memberships: Awaited<
    ReturnType<typeof bootstrapLaunchRosterMemberships>
  >
  created_posts: Array<{
    spec_id: string
    post_id: string
    title: string
    agent_id: string
    community_id: string
    community_slug: string
    batch_id: string
    batch_kind: WarmStartBatch['batch_kind']
  }>
  skipped_posts: Array<never>
  runtime_top_up: {
    enabled: boolean
    running: boolean
    attempted: number
    triggered: number
    errors: string[]
  }
  verification: {
    ok: boolean
    missing: string[]
    suite_state: WarmupSuite['state']
    batch_states: Record<'kickoff' | 'warmup', WarmStartBatch['state']>
    total_candidate_posts: number
    total_candidate_threads: number
    total_candidate_turns: number
    total_candidate_votes: number
    total_candidate_media: number
    active_baseline: RuntimeBaselineAdmission
  }
}

interface WarmupGovernanceServiceDeps {
  warmupGovernanceRepo: WarmupGovernanceRepository
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
  postMediaRepo: PostMediaRepository
  voteRepo: VoteRepository
  communityRepo: CommunityRepository
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  membershipService: Pick<
    AgentCommunityMembershipService,
    'reconcileMemberships' | 'listActive'
  >
  stageTierService?: Pick<AgentStageTierService, 'ensureBootstrapSnapshot'> | null
  forumWriteService: Pick<
    ForumWriteService,
    'createPost' | 'createThread' | 'addThreadTurn' | 'upsertVote'
  >
  launchProgrammingOpsService: Pick<LaunchProgrammingOpsService, 'getAdminPayload'>
  mediaAssetControlService?: Pick<
    MediaAssetControlService,
    'createFromUpload' | 'promoteAsset' | 'attachPostMediaAndConsume'
  > | null
  postScheduler?: {
    createPost(
      input?: { warmup_context?: WarmupWriteContextInput },
    ): Promise<PostSchedulerResult>
  } | null
  runtimeLoop?: {
    isRunning: boolean
  } | null
  searchProjectionService?: {
    refreshPost(postId: string): Promise<void>
    refreshThread(threadId: string): Promise<void>
  } | null
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function readDistributionState(post: Pick<Post, 'moderation_metadata'>): string {
  return post.moderation_metadata?.distribution_state ?? 'NORMAL'
}

function ensureBatch(
  batches: WarmStartBatch[],
  kind: WarmStartBatch['batch_kind'],
): WarmStartBatch {
  const batch = batches.find((item) => item.batch_kind === kind) ?? null
  if (!batch) {
    throw new ValidationError(`warmup suite is missing its ${kind} batch`)
  }
  return batch
}

function buildReviewFreshness(
  review: WarmupSuiteReview | null,
  kickoffBatch: WarmStartBatch | null,
  warmupBatch: WarmStartBatch | null,
): boolean {
  if (!review) return false
  const latestBatchCreatedAt = Math.max(
    kickoffBatch?.created_at.getTime() ?? 0,
    warmupBatch?.created_at.getTime() ?? 0,
  )
  return review.created_at.getTime() >= latestBatchCreatedAt
}

function shouldAttachMedia(spec: LaunchWarmStartSpec): boolean {
  return spec.content_kind === 'note_entry'
    || spec.content_kind === 'highlight_hero'
    || spec.content_kind === 'programming_slot'
    || spec.id === 'amplification-hot-arena-second-round'
}

function pickLocalWarmupMediaAsset(spec: LaunchWarmStartSpec): string {
  let hash = 0
  for (const char of spec.community_slug) {
    hash = (hash * 31 + char.charCodeAt(0)) % LOCAL_WARMUP_MEDIA_ASSETS.length
  }
  return LOCAL_WARMUP_MEDIA_ASSETS[hash]!
}

async function readLocalWarmupMediaAsset(relativeAssetPath: string): Promise<{
  bytes: Buffer
  resolved_path: string
}> {
  const cwd = process.cwd()
  const trimmedRelativePath = relativeAssetPath.replace(/^public\//, '')
  const candidatePaths = [
    resolve(cwd, relativeAssetPath),
    resolve(cwd, 'dist/frontend', trimmedRelativePath),
  ]
  let lastError: unknown = null
  for (const candidatePath of candidatePaths) {
    try {
      return {
        bytes: await readFile(candidatePath),
        resolved_path: candidatePath,
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error(`warmup media asset not found: ${relativeAssetPath}`)
}

function buildWarmupThreadBody(input: {
  spec: LaunchWarmStartSpec
  ordinal: number
}): string {
  const prefix = input.ordinal === 0
    ? '我先接住这条主判断。'
    : '如果要把这条线继续顶上去，我会补这一层。'
  return [
    prefix,
    `${input.spec.storyline.hook} 不能只停在标题里，至少要把下一步最值得追的人和代价点出来。`,
    '这样这条内容才像是已经有人真的在场，而不是只放了一个首屏公告。',
  ].join('\n')
}

function buildWarmupTurnBody(input: {
  spec: LaunchWarmStartSpec
  ordinal: number
}): string {
  if (input.ordinal === 0) {
    return [
      `我同意先把追问压在“${input.spec.storyline.hook}”上。`,
      '如果这一层不补出来，后面的互动会只剩立场表态，连续性撑不住。',
    ].join('\n')
  }

  return [
    '再往前推一步的话，我更想看谁会因为这个判断改变站位。',
    '只要位置一变，后面的 thread 就会自然长出来，不需要靠口号硬撑。',
  ].join('\n')
}

function batchReadinessReasons(
  batch: WarmupBatchReadModel | null,
  kind: 'kickoff' | 'warmup',
): string[] {
  if (!batch) {
    return [`${kind}_batch_missing`]
  }

  const postFloor = Math.max(1, batch.stats.posts)
  const mediaFloor = Math.min(postFloor, BATCH_MEDIA_FLOOR_CAP[kind])
  const communityFloor = Math.min(postFloor, BATCH_COMMUNITY_FLOOR_CAP[kind])
  const reasons: string[] = []
  if (batch.stats.posts < 1) reasons.push(`${kind}_posts_below_floor`)
  if (batch.stats.threads < postFloor) reasons.push(`${kind}_threads_below_floor`)
  if (batch.stats.turns < postFloor) reasons.push(`${kind}_turns_below_floor`)
  if (batch.stats.votes < postFloor) reasons.push(`${kind}_votes_below_floor`)
  if (batch.stats.media < mediaFloor) reasons.push(`${kind}_media_below_floor`)
  if (batch.stats.communities < communityFloor) reasons.push(`${kind}_communities_below_floor`)
  return reasons
}

export class WarmupGovernanceService {
  private runtimeDeps: {
    postScheduler: WarmupGovernanceServiceDeps['postScheduler']
    runtimeLoop: WarmupGovernanceServiceDeps['runtimeLoop']
  }
  private projectionDeps: {
    searchProjectionService: WarmupGovernanceServiceDeps['searchProjectionService']
  }

  constructor(private readonly deps: WarmupGovernanceServiceDeps) {
    this.runtimeDeps = {
      postScheduler: deps.postScheduler ?? null,
      runtimeLoop: deps.runtimeLoop ?? null,
    }
    this.projectionDeps = {
      searchProjectionService: deps.searchProjectionService ?? null,
    }
  }

  attachRuntimeDeps(input: {
    postScheduler?: WarmupGovernanceServiceDeps['postScheduler']
    runtimeLoop?: WarmupGovernanceServiceDeps['runtimeLoop']
  }): void {
    this.runtimeDeps = {
      postScheduler: input.postScheduler ?? this.runtimeDeps.postScheduler,
      runtimeLoop: input.runtimeLoop ?? this.runtimeDeps.runtimeLoop,
    }
  }

  attachProjectionDeps(input: {
    searchProjectionService?: WarmupGovernanceServiceDeps['searchProjectionService']
  }): void {
    this.projectionDeps = {
      searchProjectionService:
        input.searchProjectionService ?? this.projectionDeps.searchProjectionService,
    }
  }

  async createLaunchSuite(input: {
    suite_label?: string | null
    max_runtime_topup_posts?: number
    roster?: LaunchSystemRosterRuntime
    created_by_user_id?: string | null
    now?: Date
  } = {}): Promise<LaunchWarmupSuiteResult> {
    const suiteLabel = input.suite_label?.trim() || DEFAULT_SUITE_LABEL
    const existingReviewReady = (await this.deps.warmupGovernanceRepo.listSuites()).find(
      (suite) => suite.state === 'review_ready',
    )
    if (existingReviewReady) {
      if (existingReviewReady.suite_label !== suiteLabel) {
        throw new ValidationError(
          'archive or activate the current review_ready warmup suite before creating another candidate suite',
        )
      }
      return this.buildLaunchSuiteResult(existingReviewReady, {
        bootstrap_memberships: {
          roster_agents: 0,
          processed_agents: 0,
          reconciled_agents: 0,
          active_memberships: 0,
          added_memberships: 0,
          role_changed_memberships: 0,
          removed_memberships: 0,
          blocked_memberships: 0,
          missing_agents: [],
          agents_missing_identity: [],
          missing_communities: [],
        },
        runtime_top_up: {
          enabled: false,
          running: this.runtimeDeps.runtimeLoop?.isRunning === true,
          attempted: 0,
          triggered: 0,
          errors: [],
        },
        reused_existing_suite: true,
      })
    }

    const roster = input.roster ?? getLaunchSystemRoster()
    const now = input.now ?? new Date()
    const bootstrapMemberships = await bootstrapLaunchRosterMemberships({
      agentRepo: this.deps.agentRepo,
      agentConfigRepo: this.deps.agentConfigRepo,
      communityRepo: this.deps.communityRepo,
      membershipService: this.deps.membershipService,
      stageTierService: this.deps.stageTierService ?? undefined,
    })
    const { communityByAlias } = buildCommunityAliasMap(this.deps.communityRepo)
    const indexes = buildSystemAgentIndexes({
      agentRepo: this.deps.agentRepo,
      agentConfigRepo: this.deps.agentConfigRepo,
      ownerId: roster.owner_model.owner_id,
    })
    const usedAgentIds = new Set<string>()

    const suite = await this.deps.warmupGovernanceRepo.createSuite({
      state: 'draft',
      suite_label: suiteLabel,
      created_by_user_id: input.created_by_user_id ?? null,
    })

    const kickoffBatch = await this.deps.warmupGovernanceRepo.createBatch({
      suite_id: suite.id,
      batch_kind: 'kickoff',
      state: 'generating',
      revision_key: 'kickoff:v1',
      package_hash: 'launch-warm-start:kickoff:v1',
    })

    const kickoffPosts = await this.generateBatch({
      batch: kickoffBatch,
      specs: CURATED_LAUNCH_WARM_START_POSTS.filter((item) => item.pass === 'occupancy'),
      roster,
      indexes,
      communityByAlias,
      usedAgentIds,
      now,
      generation_mode: 'warmup_candidate',
    }).catch(async (error) => {
      await this.deps.warmupGovernanceRepo.updateBatch(kickoffBatch.id, {
        state: 'failed',
        notes: error instanceof Error ? error.message : 'kickoff generation failed',
      })
      throw error
    })

    await this.deps.warmupGovernanceRepo.updateBatch(kickoffBatch.id, {
      state: 'review_ready',
      notes: `generated ${kickoffPosts.length} kickoff candidate posts`,
    })

    const warmupBatch = await this.deps.warmupGovernanceRepo.createBatch({
      suite_id: suite.id,
      batch_kind: 'warmup',
      state: 'generating',
      revision_key: 'warmup:v1',
      package_hash: 'launch-warm-start:warmup:v1',
    })

    const warmupPosts = await this.generateBatch({
      batch: warmupBatch,
      specs: CURATED_LAUNCH_WARM_START_POSTS.filter((item) => item.pass === 'amplification'),
      roster,
      indexes,
      communityByAlias,
      usedAgentIds,
      now,
      generation_mode: 'warmup_candidate',
    }).catch(async (error) => {
      await this.deps.warmupGovernanceRepo.updateBatch(warmupBatch.id, {
        state: 'failed',
        notes: error instanceof Error ? error.message : 'warmup generation failed',
      })
      throw error
    })

    const runtimeTopUp = await this.runWarmupTopUp({
      warmupBatchId: warmupBatch.id,
      max_runtime_topup_posts: input.max_runtime_topup_posts ?? 0,
    })

    await this.deps.warmupGovernanceRepo.updateBatch(warmupBatch.id, {
      state: 'review_ready',
      notes: `generated ${warmupPosts.length} warmup candidate posts`,
    })
    const readySuite = await this.deps.warmupGovernanceRepo.updateSuite(suite.id, {
      state: 'review_ready',
      kickoff_batch_id: kickoffBatch.id,
      warmup_batch_id: warmupBatch.id,
    })
    if (!readySuite) {
      throw new NotFoundError('warmup suite', suite.id)
    }

    return this.buildLaunchSuiteResult(readySuite, {
      bootstrap_memberships: bootstrapMemberships,
      runtime_top_up: runtimeTopUp,
      reused_existing_suite: false,
      created_posts: [...kickoffPosts, ...warmupPosts],
    })
  }

  async listSuites(): Promise<WarmupSuiteListItem[]> {
    const suites = await this.deps.warmupGovernanceRepo.listSuites()
    return Promise.all(
      suites.map(async (suite) => {
        const detail = await this.getSuiteDetail(suite.id)
        return {
          id: detail.id,
          state: detail.state,
          suite_label: detail.suite_label,
          created_at: detail.created_at,
          updated_at: detail.updated_at,
          activated_at: detail.activated_at,
          archived_at: detail.archived_at,
          latest_review: detail.latest_review
            ? {
                id: detail.latest_review.id,
                decision: detail.latest_review.decision,
                reason_codes: detail.latest_review.reason_codes,
                note: detail.latest_review.note,
                created_at: detail.latest_review.created_at,
              }
            : null,
          summary: detail.summary,
          kickoff_batch: detail.kickoff_batch
            ? {
                id: detail.kickoff_batch.id,
                state: detail.kickoff_batch.state,
                stats: detail.kickoff_batch.stats,
              }
            : null,
          warmup_batch: detail.warmup_batch
            ? {
                id: detail.warmup_batch.id,
                state: detail.warmup_batch.state,
                stats: detail.warmup_batch.stats,
              }
            : null,
        }
      }),
    )
  }

  async getSuiteDetail(suiteId: string): Promise<WarmupSuiteDetail> {
    const suite = await this.deps.warmupGovernanceRepo.findSuiteById(suiteId)
    if (!suite) throw new NotFoundError('warmup suite', suiteId)

    const batches = await this.deps.warmupGovernanceRepo.listBatchesBySuite(suite.id)
    const kickoffBatch = batches.find((item) => item.batch_kind === 'kickoff') ?? null
    const warmupBatch = batches.find((item) => item.batch_kind === 'warmup') ?? null
    const [kickoffReadModel, warmupReadModel] = await Promise.all([
      kickoffBatch ? this.buildBatchReadModel(kickoffBatch) : Promise.resolve(null),
      warmupBatch ? this.buildBatchReadModel(warmupBatch) : Promise.resolve(null),
    ])
    const reviews = await this.deps.warmupGovernanceRepo.listReviewsBySuite(suite.id)
    const latestReview = reviews[0] ?? null
    const reviewFresh = buildReviewFreshness(latestReview, kickoffBatch, warmupBatch)
    const baselines = await this.deps.warmupGovernanceRepo.listBaselines()
    const suiteBaseline = baselines.find(
      (item) => item.suite_id === suite.id && item.is_current,
    )
      ?? baselines.find((item) => item.suite_id === suite.id)
      ?? null
    const opsPayload = await this.deps.launchProgrammingOpsService.getAdminPayload({
      now: new Date(),
    })

    const coverageMap = new Map<string, WarmupSuiteDetail['coverage'][number]>()
    for (const batch of [kickoffReadModel, warmupReadModel]) {
      for (const item of batch?.coverage ?? []) {
        const current = coverageMap.get(item.community_id)
        if (current) {
          current.post_count += item.post_count
        } else {
          coverageMap.set(item.community_id, { ...item })
        }
      }
    }

    const summary = {
      posts: (kickoffReadModel?.stats.posts ?? 0) + (warmupReadModel?.stats.posts ?? 0),
      threads:
        (kickoffReadModel?.stats.threads ?? 0) + (warmupReadModel?.stats.threads ?? 0),
      turns: (kickoffReadModel?.stats.turns ?? 0) + (warmupReadModel?.stats.turns ?? 0),
      votes: (kickoffReadModel?.stats.votes ?? 0) + (warmupReadModel?.stats.votes ?? 0),
      media: (kickoffReadModel?.stats.media ?? 0) + (warmupReadModel?.stats.media ?? 0),
      communities: coverageMap.size,
      media_covered_posts:
        (kickoffReadModel?.stats.media_covered_posts ?? 0)
        + (warmupReadModel?.stats.media_covered_posts ?? 0),
      media_coverage_ratio: this.computeMediaCoverageRatio([
        kickoffReadModel?.stats.posts ?? 0,
        warmupReadModel?.stats.posts ?? 0,
      ], [
        kickoffReadModel?.stats.media_covered_posts ?? 0,
        warmupReadModel?.stats.media_covered_posts ?? 0,
      ]),
    }
    const activationReadiness = this.evaluateActivationReadiness({
      kickoffBatch: kickoffReadModel,
      warmupBatch: warmupReadModel,
      summary,
    })

    return {
      id: suite.id,
      state: suite.state,
      suite_label: suite.suite_label,
      created_by_user_id: suite.created_by_user_id,
      created_at: suite.created_at.toISOString(),
      updated_at: suite.updated_at.toISOString(),
      activated_at: toIso(suite.activated_at),
      archived_at: toIso(suite.archived_at),
      kickoff_batch_id: suite.kickoff_batch_id,
      warmup_batch_id: suite.warmup_batch_id,
      latest_review: latestReview
        ? {
            id: latestReview.id,
            reviewer_user_id: latestReview.reviewer_user_id,
            decision: latestReview.decision,
            reason_codes: latestReview.reason_codes,
            note: latestReview.note,
            created_at: latestReview.created_at.toISOString(),
            is_fresh_for_current_batches: reviewFresh,
          }
        : null,
      active_baseline: suiteBaseline
        ? {
            id: suiteBaseline.id,
            is_current: suiteBaseline.is_current,
            previous_baseline_id: suiteBaseline.previous_baseline_id,
            activated_by_user_id: suiteBaseline.activated_by_user_id,
            activated_at: suiteBaseline.activated_at.toISOString(),
            deactivated_at: toIso(suiteBaseline.deactivated_at),
          }
        : null,
      summary,
      activation_readiness: activationReadiness,
      coverage: [...coverageMap.values()].sort((a, b) => b.post_count - a.post_count),
      programming_health: {
        required_daily_outcomes: {
          ...opsPayload.health.required_daily_outcomes,
        },
        observed_daily_outcomes: {
          ...opsPayload.health.observed_daily_outcomes,
        },
        daypart_readiness: opsPayload.health.daypart_readiness.map((item) => ({
          daypart_id: item.daypart_id,
          label: item.label,
          ok: item.ok,
        })),
        community_supply_floor: opsPayload.health.community_supply_floor.map((item) => ({
          community_slug: item.community_slug,
          community_name: item.community_name,
          ok: item.ok,
          missed_slots: item.missed_slots,
        })),
        visual_ratio_ok: opsPayload.health.visual_ratio_ok,
        aftershow_pipeline_ok: opsPayload.health.aftershow_pipeline_ok,
        warning_count: opsPayload.health.warning_count,
        warnings: opsPayload.health.warnings.map((item) => ({
          code: item.code,
          severity: item.severity,
          message: item.message,
          affected_daypart: item.affected_daypart ?? null,
          affected_community_slug: item.affected_community_slug ?? null,
        })),
      },
      kickoff_batch: kickoffReadModel,
      warmup_batch: warmupReadModel,
      actions: {
        can_review: suite.state === 'review_ready',
        can_retry:
          suite.state === 'review_ready'
          && latestReview?.decision === 'pass_to_active'
          && reviewFresh,
        can_rebuild: suite.state !== 'active' && warmupBatch !== null,
        can_archive: suite.state === 'review_ready' || suite.state === 'active',
      },
    }
  }

  async reviewSuite(input: {
    suite_id: string
    reviewer_user_id?: string | null
    decision: WarmupReviewDecision
    reason_codes?: WarmupReviewReasonCode[]
    note?: string | null
    confirm_activation?: boolean
  }): Promise<{
    review: WarmupSuiteReview
    suite: WarmupSuiteDetail
  }> {
    const detail = await this.getSuiteDetail(input.suite_id)
    if (detail.state !== 'review_ready') {
      throw new ValidationError('only review_ready suites can be reviewed')
    }

    if (input.decision === 'not_passed' && (!input.reason_codes || input.reason_codes.length === 0)) {
      throw new ValidationError('not_passed review requires at least one structured reason code')
    }

    if (input.decision === 'pass_to_active' && input.confirm_activation !== true) {
      throw new ValidationError('pass_to_active requires explicit confirm_activation=true')
    }

    if (input.decision === 'pass_to_active' && !detail.activation_readiness.ok) {
      throw new ValidationError('suite is not ready for activation', {
        reasons: detail.activation_readiness.reasons,
      })
    }

    const review = await this.deps.warmupGovernanceRepo.createReview({
      suite_id: input.suite_id,
      reviewer_user_id: input.reviewer_user_id ?? null,
      decision: input.decision,
      reason_codes: input.reason_codes ?? [],
      note: input.note ?? null,
    })

    if (input.decision === 'pass_to_active') {
      const suite = await this.activateSuite({
        suite_id: input.suite_id,
        activated_by_user_id: input.reviewer_user_id ?? null,
      })
      return { review, suite }
    }

    return {
      review,
      suite: await this.getSuiteDetail(input.suite_id),
    }
  }

  async retrySuite(input: {
    suite_id: string
    actor_user_id?: string | null
  }): Promise<WarmupSuiteDetail> {
    const detail = await this.getSuiteDetail(input.suite_id)
    if (detail.state === 'active') {
      return detail
    }
    const latestReview = detail.latest_review
    if (latestReview?.decision !== 'pass_to_active' || latestReview.is_fresh_for_current_batches !== true) {
      return detail
    }
    return this.activateSuite({
      suite_id: input.suite_id,
      activated_by_user_id: input.actor_user_id ?? null,
    })
  }

  async rebuildSuite(input: {
    suite_id: string
    actor_user_id?: string | null
    max_runtime_topup_posts?: number
    roster?: LaunchSystemRosterRuntime
    now?: Date
  }): Promise<WarmupSuiteDetail> {
    const suite = await this.deps.warmupGovernanceRepo.findSuiteById(input.suite_id)
    if (!suite) throw new NotFoundError('warmup suite', input.suite_id)
    if (suite.state === 'active') {
      throw new ValidationError('active suites must be archived before rebuild')
    }

    const now = input.now ?? new Date()
    const roster = input.roster ?? getLaunchSystemRoster()
    const batches = await this.deps.warmupGovernanceRepo.listBatchesBySuite(suite.id)
    const kickoffBatch = ensureBatch(batches, 'kickoff')
    const previousWarmupBatch = ensureBatch(batches, 'warmup')
    const kickoffPosts = await this.deps.postRepo.findByWarmStartBatch(kickoffBatch.id)
    const usedAgentIds = new Set(
      kickoffPosts.map((post) => post.author_agent_id).filter(Boolean),
    )
    const { communityByAlias } = buildCommunityAliasMap(this.deps.communityRepo)
    const indexes = buildSystemAgentIndexes({
      agentRepo: this.deps.agentRepo,
      agentConfigRepo: this.deps.agentConfigRepo,
      ownerId: roster.owner_model.owner_id,
    })

    await this.applyBatchExposure(previousWarmupBatch.id, 'candidate')
    await this.deps.warmupGovernanceRepo.updateBatch(previousWarmupBatch.id, {
      state: 'archived',
      archived_at: now,
    })

    const nextWarmupBatch = await this.deps.warmupGovernanceRepo.createBatch({
      suite_id: suite.id,
      batch_kind: 'warmup',
      state: 'generating',
      source_batch_id: previousWarmupBatch.id,
      revision_key: 'warmup:v1',
      package_hash: 'launch-warm-start:warmup:v1',
      notes: `rebuild requested by ${input.actor_user_id ?? 'system'}`,
    })

    await this.generateBatch({
      batch: nextWarmupBatch,
      specs: CURATED_LAUNCH_WARM_START_POSTS.filter((item) => item.pass === 'amplification'),
      roster,
      indexes,
      communityByAlias,
      usedAgentIds,
      now,
      generation_mode: 'warmup_candidate',
    }).catch(async (error) => {
      await this.deps.warmupGovernanceRepo.updateBatch(nextWarmupBatch.id, {
        state: 'failed',
        notes: error instanceof Error ? error.message : 'warmup rebuild failed',
      })
      throw error
    })

    await this.runWarmupTopUp({
      warmupBatchId: nextWarmupBatch.id,
      max_runtime_topup_posts: input.max_runtime_topup_posts ?? 0,
    })

    await this.deps.warmupGovernanceRepo.updateBatch(nextWarmupBatch.id, {
      state: 'review_ready',
      notes: `rebuild completed by ${input.actor_user_id ?? 'system'}`,
    })
    await this.deps.warmupGovernanceRepo.updateSuite(suite.id, {
      state: 'review_ready',
      warmup_batch_id: nextWarmupBatch.id,
      activated_at: null,
      archived_at: null,
    })

    return this.getSuiteDetail(suite.id)
  }

  async archiveSuite(input: {
    suite_id: string
    actor_user_id?: string | null
  }): Promise<WarmupSuiteDetail> {
    const suite = await this.deps.warmupGovernanceRepo.findSuiteById(input.suite_id)
    if (!suite) throw new NotFoundError('warmup suite', input.suite_id)

    const batches = await this.deps.warmupGovernanceRepo.listBatchesBySuite(suite.id)
    const now = new Date()
    const currentBaseline = await this.deps.warmupGovernanceRepo.findCurrentBaseline()
    if (currentBaseline?.suite_id === suite.id) {
      await this.deps.warmupGovernanceRepo.updateBaseline(currentBaseline.id, {
        is_current: false,
        deactivated_at: now,
      })
    }

    await Promise.all(
      batches.map(async (batch) => {
        await this.applyBatchExposure(batch.id, 'candidate')
        await this.deps.warmupGovernanceRepo.updateBatch(batch.id, {
          state: 'archived',
          archived_at: now,
        })
      }),
    )
    await this.deps.warmupGovernanceRepo.updateSuite(suite.id, {
      state: 'archived',
      archived_at: now,
    })

    return this.getSuiteDetail(suite.id)
  }

  async previewGovernanceBatch(input: {
    action: GovernanceBatchAction
    suite_id?: string | null
    warm_start_batch_ids?: string[]
    content_ids?: string[]
  }): Promise<WarmupGovernancePreview> {
    return this.resolveGovernancePreview(input)
  }

  async executeGovernanceBatch(input: {
    action: GovernanceBatchAction
    requested_by_user_id?: string | null
    suite_id?: string | null
    warm_start_batch_ids?: string[]
    content_ids?: string[]
  }): Promise<{
    batch: GovernanceBatch
    preview: WarmupGovernancePreview
  }> {
    const preview = await this.resolveGovernancePreview(input)
    const record = await this.deps.warmupGovernanceRepo.createGovernanceBatch({
      action: input.action,
      requested_by_user_id: input.requested_by_user_id ?? null,
      suite_id: input.suite_id ?? null,
      warm_start_batch_ids: preview.warm_start_batch_ids,
      content_ids: preview.scope.posts,
      scope_json: preview.scope,
      preview_json: preview as unknown as Record<string, unknown>,
    })

    if (input.action === 'archive' && input.suite_id) {
      const archivedSuite = await this.archiveSuite({
        suite_id: input.suite_id,
        actor_user_id: input.requested_by_user_id ?? null,
      })
      await this.deps.warmupGovernanceRepo.updateGovernanceBatch(record.id, {
        result_json: {
          archived_suite_id: archivedSuite.id,
          state: archivedSuite.state,
        },
        executed_at: new Date(),
      })
      return {
        batch: await this.requireGovernanceBatch(record.id),
        preview,
      }
    }

    const targetSuites = preview.suite_id ? [preview.suite_id] : []
    const suiteStates = await Promise.all(
      targetSuites.map(async (suiteId) => [suiteId, await this.deps.warmupGovernanceRepo.findSuiteById(suiteId)] as const),
    )
    const suiteStateById = new Map(
      suiteStates.filter((entry): entry is [string, WarmupSuite] => entry[1] !== null),
    )

    const posts = await this.resolvePostsForPreview(preview)
    const threads = await this.resolveThreadsForPreview(preview)
    const turns = await this.resolveTurnsForPreview(preview)

    if (input.action === 'quarantine') {
      await Promise.all([
        ...posts.map((post) => this.deps.postRepo.updateContent(post.id, { visibility: 'QUARANTINE' })),
        ...threads.map((thread) => this.deps.publicStageThreadRepo.updateVisibility(thread.id, 'QUARANTINE')),
        ...turns.map((turn) => this.deps.publicStageTurnRepo.updateVisibility(turn.id, 'QUARANTINE')),
      ])
      await this.refreshSearchDocs({
        postIds: posts.map((post) => post.id),
        threadIds: threads.map((thread) => thread.id),
      })
    }

    if (input.action === 'restore') {
      await Promise.all([
        ...posts.map((post) => {
          const suiteId = this.getSuiteIdForPost(post, preview)
          return this.restorePost(post, suiteId ? suiteStateById.get(suiteId) ?? null : null)
        }),
        ...threads.map((thread) => {
          const suiteId = this.getSuiteIdForBatch(thread.warm_start_batch_id, preview)
          return this.restoreThread(
            thread,
            suiteId ? suiteStateById.get(suiteId) ?? null : null,
          )
        }),
        ...turns.map((turn) => {
          const suiteId = this.getSuiteIdForBatch(turn.warm_start_batch_id, preview)
          return this.restoreTurn(
            turn,
            suiteId ? suiteStateById.get(suiteId) ?? null : null,
          )
        }),
      ])
      await this.refreshSearchDocs({
        postIds: posts.map((post) => post.id),
        threadIds: threads.map((thread) => thread.id),
      })
    }

    await this.deps.warmupGovernanceRepo.updateGovernanceBatch(record.id, {
      result_json: {
        counts: preview.counts,
        action: input.action,
      },
      executed_at: new Date(),
    })

    return {
      batch: await this.requireGovernanceBatch(record.id),
      preview,
    }
  }

  async getGovernanceBatch(governanceBatchId: string) {
    return this.requireGovernanceBatch(governanceBatchId)
  }

  async getRuntimeBaselineAdmission(): Promise<RuntimeBaselineAdmission> {
    const currentBaseline = await this.deps.warmupGovernanceRepo.findCurrentBaseline()
    if (!currentBaseline) {
      return {
        active_baseline_id: null,
        suite_id: null,
        kickoff_batch_id: null,
        warmup_batch_id: null,
        has_active_baseline: false,
        kickoff_layer_ready: false,
        warmup_layer_ready: false,
        key_communities_ready: false,
        key_shelves_ready: false,
        media_access_ok: false,
        aftershow_pipeline_ok: false,
        last_review_decision_ok: false,
        allow_public_growth: false,
        reasons: ['no_active_baseline'],
      }
    }

    const suite = await this.deps.warmupGovernanceRepo.findSuiteById(currentBaseline.suite_id)
    const batches = await this.deps.warmupGovernanceRepo.listBatchesBySuite(currentBaseline.suite_id)
    const kickoffBatch = batches.find((item) => item.id === currentBaseline.kickoff_batch_id) ?? null
    const warmupBatch = batches.find((item) => item.id === currentBaseline.warmup_batch_id) ?? null
    const [kickoffReadModel, warmupReadModel] = await Promise.all([
      kickoffBatch ? this.buildBatchReadModel(kickoffBatch) : Promise.resolve(null),
      warmupBatch ? this.buildBatchReadModel(warmupBatch) : Promise.resolve(null),
    ])
    const latestReview = await this.deps.warmupGovernanceRepo.findLatestReviewBySuite(currentBaseline.suite_id)
    const freshReview = buildReviewFreshness(latestReview, kickoffBatch, warmupBatch)
    const opsPayload = await this.deps.launchProgrammingOpsService.getAdminPayload({
      now: new Date(),
    })

    const kickoffLayerReady =
      kickoffBatch?.state === 'active' && kickoffBatch.activated_at !== null
    const warmupLayerReady =
      warmupBatch?.state === 'active' && warmupBatch.activated_at !== null
    const keyCommunitiesReady = opsPayload.health.community_supply_floor.every((item) => item.ok)
    const keyShelvesReady = opsPayload.health.daypart_readiness.every((item) => item.ok)
      && Object.entries(opsPayload.health.required_daily_outcomes).every(([key, required]) => {
        const observed = opsPayload.health.observed_daily_outcomes[key.replace(/_min$/, '')] ?? 0
        return observed >= required
      })
    const mediaAccessOk = opsPayload.health.visual_ratio_ok
    const aftershowPipelineOk = opsPayload.health.aftershow_pipeline_ok
    const lastReviewDecisionOk =
      suite?.state === 'active'
      && latestReview?.decision === 'pass_to_active'
      && freshReview
    const activationReadiness = this.evaluateActivationReadiness({
      kickoffBatch: kickoffReadModel,
      warmupBatch: warmupReadModel,
      summary: {
        posts: (kickoffReadModel?.stats.posts ?? 0) + (warmupReadModel?.stats.posts ?? 0),
        threads: (kickoffReadModel?.stats.threads ?? 0) + (warmupReadModel?.stats.threads ?? 0),
        turns: (kickoffReadModel?.stats.turns ?? 0) + (warmupReadModel?.stats.turns ?? 0),
        votes: (kickoffReadModel?.stats.votes ?? 0) + (warmupReadModel?.stats.votes ?? 0),
        media: (kickoffReadModel?.stats.media ?? 0) + (warmupReadModel?.stats.media ?? 0),
        communities: new Set([
          ...(kickoffReadModel?.coverage.map((item) => item.community_id) ?? []),
          ...(warmupReadModel?.coverage.map((item) => item.community_id) ?? []),
        ]).size,
        media_covered_posts:
          (kickoffReadModel?.stats.media_covered_posts ?? 0)
          + (warmupReadModel?.stats.media_covered_posts ?? 0),
        media_coverage_ratio: this.computeMediaCoverageRatio([
          kickoffReadModel?.stats.posts ?? 0,
          warmupReadModel?.stats.posts ?? 0,
        ], [
          kickoffReadModel?.stats.media_covered_posts ?? 0,
          warmupReadModel?.stats.media_covered_posts ?? 0,
        ]),
      },
    })
    const reasons: string[] = []
    if (!kickoffLayerReady) reasons.push('kickoff_layer_not_ready')
    if (!warmupLayerReady) reasons.push('warmup_layer_not_ready')
    if (!lastReviewDecisionOk) reasons.push('review_not_fresh_or_not_passed')
    reasons.push(...activationReadiness.reasons)
    if (!keyCommunitiesReady) reasons.push('key_communities_not_ready')
    if (!keyShelvesReady) reasons.push('key_shelves_not_ready')
    if (!mediaAccessOk) reasons.push('media_access_not_ready')
    if (!aftershowPipelineOk) reasons.push('aftershow_pipeline_not_ready')

    return {
      active_baseline_id: currentBaseline.id,
      suite_id: currentBaseline.suite_id,
      kickoff_batch_id: currentBaseline.kickoff_batch_id,
      warmup_batch_id: currentBaseline.warmup_batch_id,
      has_active_baseline: true,
      kickoff_layer_ready: kickoffLayerReady,
      warmup_layer_ready: warmupLayerReady,
      key_communities_ready: keyCommunitiesReady,
      key_shelves_ready: keyShelvesReady,
      media_access_ok: mediaAccessOk,
      aftershow_pipeline_ok: aftershowPipelineOk,
      last_review_decision_ok: lastReviewDecisionOk,
      allow_public_growth: reasons.length === 0,
      reasons: [...new Set(reasons)],
    }
  }

  private async activateSuite(input: {
    suite_id: string
    activated_by_user_id?: string | null
  }): Promise<WarmupSuiteDetail> {
    const detail = await this.getSuiteDetail(input.suite_id)
    const suite = await this.deps.warmupGovernanceRepo.findSuiteById(input.suite_id)
    if (!suite) throw new NotFoundError('warmup suite', input.suite_id)
    if (!detail.activation_readiness.ok) {
      throw new ValidationError('suite is not ready for activation', {
        reasons: detail.activation_readiness.reasons,
      })
    }

    const batches = await this.deps.warmupGovernanceRepo.listBatchesBySuite(suite.id)
    const kickoffBatch = ensureBatch(batches, 'kickoff')
    const warmupBatch = ensureBatch(batches, 'warmup')
    const latestReview = await this.deps.warmupGovernanceRepo.findLatestReviewBySuite(suite.id)
    if (
      latestReview?.decision !== 'pass_to_active'
      || !buildReviewFreshness(latestReview, kickoffBatch, warmupBatch)
    ) {
      throw new ValidationError('suite activation requires a fresh pass_to_active review')
    }

    const currentBaseline = await this.deps.warmupGovernanceRepo.findCurrentBaseline()
    if (currentBaseline?.suite_id === suite.id) {
      return detail
    }

    const now = new Date()
    if (currentBaseline) {
      await this.deps.warmupGovernanceRepo.updateBaseline(currentBaseline.id, {
        is_current: false,
        deactivated_at: now,
      })
      const previousSuite = await this.deps.warmupGovernanceRepo.findSuiteById(
        currentBaseline.suite_id,
      )
      if (previousSuite) {
        const previousBatches = await this.deps.warmupGovernanceRepo.listBatchesBySuite(
          previousSuite.id,
        )
        await Promise.all(
          previousBatches.map(async (batch) => {
            await this.applyBatchExposure(batch.id, 'candidate')
            await this.deps.warmupGovernanceRepo.updateBatch(batch.id, {
              state: 'archived',
              archived_at: now,
            })
          }),
        )
        await this.deps.warmupGovernanceRepo.updateSuite(previousSuite.id, {
          state: 'archived',
          archived_at: now,
        })
      }
    }

    await this.applyBatchExposure(kickoffBatch.id, 'active')
    await this.applyBatchExposure(warmupBatch.id, 'active')
    await this.deps.warmupGovernanceRepo.updateBatch(kickoffBatch.id, {
      state: 'active',
      activated_at: now,
      archived_at: null,
    })
    await this.deps.warmupGovernanceRepo.updateBatch(warmupBatch.id, {
      state: 'active',
      activated_at: now,
      archived_at: null,
    })
    await this.deps.warmupGovernanceRepo.createBaseline({
      suite_id: suite.id,
      kickoff_batch_id: kickoffBatch.id,
      warmup_batch_id: warmupBatch.id,
      previous_baseline_id: currentBaseline?.id ?? null,
      is_current: true,
      activated_by_user_id: input.activated_by_user_id ?? null,
      activated_at: now,
    })
    await this.deps.warmupGovernanceRepo.updateSuite(suite.id, {
      state: 'active',
      activated_at: now,
      archived_at: null,
    })

    return this.getSuiteDetail(suite.id)
  }

  private evaluateActivationReadiness(input: {
    kickoffBatch: WarmupBatchReadModel | null
    warmupBatch: WarmupBatchReadModel | null
    summary: WarmupSuiteDetail['summary']
  }): {
    ok: boolean
    reasons: string[]
  } {
    const reasons = [
      ...batchReadinessReasons(input.kickoffBatch, 'kickoff'),
      ...batchReadinessReasons(input.warmupBatch, 'warmup'),
    ]

    const suiteMediaFloor = Math.min(Math.max(1, input.summary.posts), 6)
    if (input.summary.media < suiteMediaFloor) {
      reasons.push('suite_media_below_floor')
    }
    if (input.summary.posts >= 6) {
      if (input.summary.media_coverage_ratio < SUITE_MEDIA_RATIO_MIN) {
        reasons.push('suite_media_ratio_below_floor')
      }
      if (input.summary.media_coverage_ratio > SUITE_MEDIA_RATIO_MAX) {
        reasons.push('suite_media_ratio_above_ceiling')
      }
    }

    return {
      ok: reasons.length === 0,
      reasons,
    }
  }

  private async generateBatch(input: {
    batch: WarmStartBatch
    specs: typeof CURATED_LAUNCH_WARM_START_POSTS
    roster: LaunchSystemRosterRuntime
    indexes: ReturnType<typeof buildSystemAgentIndexes>
    communityByAlias: Map<string, { id: string; slug: string; name: string }>
    usedAgentIds: Set<string>
    now: Date
    generation_mode: WarmStartGenerationMode
  }): Promise<LaunchWarmupSuiteResult['created_posts']> {
    const createdPosts: LaunchWarmupSuiteResult['created_posts'] = []

    for (const spec of input.specs) {
      const community = input.communityByAlias.get(spec.community_slug)
      if (!community) {
        throw new ValidationError(`missing launch community ${spec.community_slug}`)
      }

      const agent = pickRosterEntryForSpec({
        roster: input.roster,
        spec,
        usedAgentIds: input.usedAgentIds,
        indexes: input.indexes,
      })
      input.usedAgentIds.add(agent.id)

      const result = await this.deps.forumWriteService.createPost({
        actor_agent_id: agent.id,
        run_id: `warmup-suite:${input.batch.id}:${spec.id}:${Date.now()}`,
        community_id: community.id,
        title: spec.title,
        body: spec.body,
        tags: spec.tags,
        scene: buildWarmStartScenePayload({ spec, now: input.now }),
        warmup_context: {
          warm_start_batch_id: input.batch.id,
          generation_mode: input.generation_mode,
        },
      })

      createdPosts.push({
        spec_id: spec.id,
        post_id: result.post.id,
        title: spec.title,
        agent_id: agent.id,
        community_id: community.id,
        community_slug: community.slug,
        batch_id: input.batch.id,
        batch_kind: input.batch.batch_kind,
      })

      await this.createEngagementForPost({
        batch: input.batch,
        spec,
        post: result.post,
        rootAuthorAgentId: agent.id,
        roster: input.roster,
        indexes: input.indexes,
      })
    }

    return createdPosts
  }

  private async createEngagementForPost(input: {
    batch: WarmStartBatch
    spec: LaunchWarmStartSpec
    post: Post
    rootAuthorAgentId: string
    roster: LaunchSystemRosterRuntime
    indexes: ReturnType<typeof buildSystemAgentIndexes>
  }): Promise<void> {
    const supportAgents = this.pickSupportAgents({
      roster: input.roster,
      indexes: input.indexes,
      spec: input.spec,
      excludeAgentIds: [input.rootAuthorAgentId],
      limit: 5,
    })
    const [threadAuthor, turnAuthorA, turnAuthorB, voteAuthorA, voteAuthorB] = supportAgents
    if (!threadAuthor || !turnAuthorA || !turnAuthorB) {
      throw new ValidationError(`warmup engagement is blocked: not enough support agents for ${input.spec.community_slug}`)
    }
    const warmupContext = {
      warm_start_batch_id: input.batch.id,
      generation_mode: 'warmup_candidate' as const,
    }
    const threadResult = await this.deps.forumWriteService.createThread({
      actor_agent_id: threadAuthor.id,
      run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:thread:0:${Date.now()}`,
      post_id: input.post.id,
      body: buildWarmupThreadBody({ spec: input.spec, ordinal: 0 }),
      warmup_context: warmupContext,
    })
    const threadId = threadResult.entry.thread_id

    await this.deps.forumWriteService.addThreadTurn({
      actor_agent_id: turnAuthorA.id,
      run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:turn:0:${Date.now()}`,
      thread_id: threadId,
      body: buildWarmupTurnBody({ spec: input.spec, ordinal: 0 }),
      warmup_context: warmupContext,
    })
    const secondTurn = await this.deps.forumWriteService.addThreadTurn({
      actor_agent_id: turnAuthorB.id,
      run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:turn:1:${Date.now()}`,
      thread_id: threadId,
      body: buildWarmupTurnBody({ spec: input.spec, ordinal: 1 }),
      warmup_context: warmupContext,
    })

    const voters = [voteAuthorA, voteAuthorB, threadAuthor].filter(
      (agent): agent is { id: string } => Boolean(agent),
    )
    for (const [index, voter] of voters.entries()) {
      await this.deps.forumWriteService.upsertVote({
        actor_agent_id: voter.id,
        run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:post-vote:${index}:${Date.now()}`,
        target_type: 'POST',
        target_id: input.post.id,
        direction: 'UP',
      })
    }
    for (const [index, voter] of [turnAuthorA, turnAuthorB].entries()) {
      await this.deps.forumWriteService.upsertVote({
        actor_agent_id: voter.id,
        run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:thread-vote:${index}:${Date.now()}`,
        target_type: 'THREAD',
        target_id: threadId,
        direction: 'UP',
      })
    }
    await this.deps.forumWriteService.upsertVote({
      actor_agent_id: threadAuthor.id,
      run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:turn-vote:${Date.now()}`,
      target_type: 'TURN',
      target_id: secondTurn.entry.id,
      direction: 'UP',
    })

    if (!shouldAttachMedia(input.spec) || !this.deps.mediaAssetControlService) {
      return
    }

    const relativeAssetPath = pickLocalWarmupMediaAsset(input.spec)
    const asset = await readLocalWarmupMediaAsset(relativeAssetPath)
    const mimeType = relativeAssetPath.endsWith('.webp')
      ? 'image/webp'
      : relativeAssetPath.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg'
    const created = await this.deps.mediaAssetControlService.createFromUpload({
      agent_id: input.rootAuthorAgentId,
      owner_user_id: this.requireAgentOwnerId(input.rootAuthorAgentId),
      owner_note: `warmup-suite:${input.batch.id}:${input.spec.id}`,
      original_name: relativeAssetPath.split('/').pop() ?? 'warmup-media.webp',
      mime_type: mimeType,
      bytes: asset.bytes,
    })
    const promoted = await this.deps.mediaAssetControlService.promoteAsset({
      agent_id: input.rootAuthorAgentId,
      owner_user_id: this.requireAgentOwnerId(input.rootAuthorAgentId),
      asset_id: created.asset_id,
    })
    const attachment = await this.deps.mediaAssetControlService.attachPostMediaAndConsume({
      asset_id: promoted.asset_id,
      post_id: input.post.id,
      warmup_context: warmupContext,
    })
    if (!attachment.linked) {
      throw new ValidationError(`failed to attach warmup media for ${input.spec.id}`)
    }
  }

  private pickSupportAgents(input: {
    roster: LaunchSystemRosterRuntime
    indexes: ReturnType<typeof buildSystemAgentIndexes>
    spec: LaunchWarmStartSpec
    excludeAgentIds: string[]
    limit: number
  }): Array<{ id: string }> {
    const support: Array<{ id: string }> = []
    const used = new Set(input.excludeAgentIds)

    for (let index = 0; index < input.roster.roster.length && support.length < input.limit; index += 1) {
      const agent = pickRosterEntryForSpec({
        roster: input.roster,
        spec: input.spec,
        usedAgentIds: used,
        indexes: input.indexes,
      })
      if (used.has(agent.id)) continue
      used.add(agent.id)
      support.push({ id: agent.id })
    }

    return support
  }

  private requireAgentOwnerId(agentId: string): string {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) {
      throw new NotFoundError('agent', agentId)
    }
    return agent.owner_id
  }

  private async buildLaunchSuiteResult(
    suite: WarmupSuite,
    input: {
      bootstrap_memberships: LaunchWarmupSuiteResult['bootstrap_memberships']
      runtime_top_up: LaunchWarmupSuiteResult['runtime_top_up']
      reused_existing_suite: boolean
      created_posts?: LaunchWarmupSuiteResult['created_posts']
    },
  ): Promise<LaunchWarmupSuiteResult> {
    const detail = await this.getSuiteDetail(suite.id)
    const admission = await this.getRuntimeBaselineAdmission()
    const createdPosts = input.created_posts ?? []
    const kickoffBatch = detail.kickoff_batch
    const warmupBatch = detail.warmup_batch
    const missing: string[] = []
    if (!kickoffBatch || kickoffBatch.state !== 'review_ready' && kickoffBatch.state !== 'active') {
      missing.push('kickoff_batch_not_ready')
    }
    if (!warmupBatch || warmupBatch.state !== 'review_ready' && warmupBatch.state !== 'active') {
      missing.push('warmup_batch_not_ready')
    }
    if (detail.state !== 'review_ready' && detail.state !== 'active') {
      missing.push('suite_not_ready')
    }
    if (!detail.kickoff_batch_id || !detail.warmup_batch_id) {
      missing.push('suite_batches_not_linked')
    }
    missing.push(...detail.activation_readiness.reasons)

    return {
      suite_id: detail.id,
      suite_state: detail.state,
      suite_label: detail.suite_label,
      kickoff_batch_id: detail.kickoff_batch_id!,
      warmup_batch_id: detail.warmup_batch_id!,
      reused_existing_suite: input.reused_existing_suite,
      bootstrap_memberships: input.bootstrap_memberships,
      created_posts: createdPosts,
      skipped_posts: [],
      runtime_top_up: input.runtime_top_up,
      verification: {
        ok: missing.length === 0,
        missing: [...new Set(missing)],
        suite_state: detail.state,
        batch_states: {
          kickoff: kickoffBatch?.state ?? 'failed',
          warmup: warmupBatch?.state ?? 'failed',
        },
        total_candidate_posts: detail.summary.posts,
        total_candidate_threads: detail.summary.threads,
        total_candidate_turns: detail.summary.turns,
        total_candidate_votes: detail.summary.votes,
        total_candidate_media: detail.summary.media,
        active_baseline: admission,
      },
    }
  }

  private async buildBatchReadModel(batch: WarmStartBatch): Promise<WarmupBatchReadModel> {
    const content = await this.readBatchContent(batch.id)
    const communityCoverage = new Map<string, WarmupBatchReadModel['coverage'][number]>()
    const threadsByPost = new Map<string, number>()
    const turnsByPost = new Map<string, number>()
    const mediaByPost = new Map<string, number>()
    const votesByPost = new Map<string, number>()
    const threadPostIndex = new Map(content.threads.map((thread) => [thread.id, thread.post_id]))
    const turnPostIndex = new Map(content.turns.map((turn) => [turn.id, turn.post_id]))

    for (const thread of content.threads) {
      threadsByPost.set(thread.post_id, (threadsByPost.get(thread.post_id) ?? 0) + 1)
    }
    for (const turn of content.turns) {
      turnsByPost.set(turn.post_id, (turnsByPost.get(turn.post_id) ?? 0) + 1)
    }
    for (const media of content.media) {
      mediaByPost.set(media.post_id, (mediaByPost.get(media.post_id) ?? 0) + 1)
    }
    for (const vote of content.votes) {
      const postId = vote.target_type === 'POST'
        ? vote.target_id
        : vote.target_type === 'THREAD'
          ? threadPostIndex.get(vote.target_id)
          : vote.target_type === 'TURN'
            ? turnPostIndex.get(vote.target_id)
            : null
      if (!postId) continue
      votesByPost.set(postId, (votesByPost.get(postId) ?? 0) + 1)
    }

    const samples = content.posts
      .slice()
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, DEFAULT_SAMPLE_LIMIT)
      .map((post) => {
        const community = this.deps.communityRepo.findById(post.community_id)
        return {
          post_id: post.id,
          title: post.title,
          community_id: post.community_id,
          community_slug: community?.slug ?? post.community_id,
          community_name: community?.name ?? post.community_id,
          visibility: post.visibility,
          state: post.state,
          distribution_state: readDistributionState(post),
          thread_count: threadsByPost.get(post.id) ?? 0,
          turn_count: turnsByPost.get(post.id) ?? 0,
          media_count: mediaByPost.get(post.id) ?? 0,
          vote_count: votesByPost.get(post.id) ?? 0,
          created_at: post.created_at.toISOString(),
        } satisfies WarmupContentSample
      })

    for (const post of content.posts) {
      const community = this.deps.communityRepo.findById(post.community_id)
      const communityId = community?.id ?? post.community_id
      const current = communityCoverage.get(communityId)
      if (current) {
        current.post_count += 1
        continue
      }
      communityCoverage.set(communityId, {
        community_id: communityId,
        community_slug: community?.slug ?? post.community_id,
        community_name: community?.name ?? post.community_id,
        post_count: 1,
      })
    }

    const mediaCoveredPosts = new Set(content.media.map((item) => item.post_id)).size

    return {
      id: batch.id,
      batch_kind: batch.batch_kind,
      state: batch.state,
      source_batch_id: batch.source_batch_id,
      revision_key: batch.revision_key,
      package_hash: batch.package_hash,
      notes: batch.notes,
      activated_at: toIso(batch.activated_at),
      archived_at: toIso(batch.archived_at),
      created_at: batch.created_at.toISOString(),
      updated_at: batch.updated_at.toISOString(),
      stats: {
        posts: content.posts.length,
        threads: content.threads.length,
        turns: content.turns.length,
        votes: content.votes.length,
        media: content.media.length,
        communities: communityCoverage.size,
        media_covered_posts: mediaCoveredPosts,
        media_coverage_ratio: this.computeMediaCoverageRatio(
          [content.posts.length],
          [mediaCoveredPosts],
        ),
      },
      coverage: [...communityCoverage.values()].sort((a, b) => b.post_count - a.post_count),
      samples,
    }
  }

  private async readBatchContent(batchId: string): Promise<WarmupBatchContent> {
    const [posts, threads, turns] = await Promise.all([
      this.deps.postRepo.findByWarmStartBatch(batchId),
      this.deps.publicStageThreadRepo.findByWarmStartBatch(batchId),
      this.deps.publicStageTurnRepo.findByWarmStartBatch(batchId),
    ])
    const votes = [
      ...posts.flatMap((post) => this.deps.voteRepo.findByTarget('POST', post.id)),
      ...threads.flatMap((thread) => this.deps.voteRepo.findByTarget('THREAD', thread.id)),
      ...turns.flatMap((turn) => this.deps.voteRepo.findByTarget('TURN', turn.id)),
    ]
    return {
      posts,
      threads,
      turns,
      media: this.deps.postMediaRepo.findByWarmStartBatch(batchId),
      votes,
    }
  }

  private async runWarmupTopUp(input: {
    warmupBatchId: string
    max_runtime_topup_posts: number
  }): Promise<LaunchWarmupSuiteResult['runtime_top_up']> {
    const runtimeTopUp: LaunchWarmupSuiteResult['runtime_top_up'] = {
      enabled: input.max_runtime_topup_posts > 0,
      running: this.runtimeDeps.runtimeLoop?.isRunning === true,
      attempted: 0,
      triggered: 0,
      errors: [],
    }
    if (
      !runtimeTopUp.enabled
      || !runtimeTopUp.running
      || !this.runtimeDeps.postScheduler
    ) {
      return runtimeTopUp
    }

    for (let attempt = 0; attempt < input.max_runtime_topup_posts; attempt += 1) {
      runtimeTopUp.attempted += 1
      const result = await this.runtimeDeps.postScheduler.createPost({
        warmup_context: {
          warm_start_batch_id: input.warmupBatchId,
          generation_mode: 'warmup_topup_candidate',
        },
      })
      if (result.triggered) {
        runtimeTopUp.triggered += 1
      }
      if (result.error) {
        runtimeTopUp.errors.push(result.error)
      }
    }

    return runtimeTopUp
  }

  private async applyBatchExposure(
    batchId: string,
    mode: 'candidate' | 'active',
  ): Promise<void> {
    const content = await this.readBatchContent(batchId)
    await Promise.all([
      ...content.posts.map((post) => this.applyPostExposure(post, mode)),
      ...content.threads.map((thread) => this.applyThreadExposure(thread.id, mode)),
      ...content.turns.map((turn) => this.applyTurnExposure(turn.id, mode)),
    ])
    await this.refreshSearchDocs({
      postIds: content.posts.map((post) => post.id),
      threadIds: content.threads.map((thread) => thread.id),
    })
  }

  private async applyPostExposure(post: Post, mode: 'candidate' | 'active'): Promise<void> {
    const distributionState = readDistributionState(post)
    await this.deps.postRepo.updateContent(post.id, {
      state: mode === 'candidate' ? 'PENDING' : 'APPROVED',
      visibility:
        mode === 'candidate'
          ? 'GRAY'
          : post.visibility === 'QUARANTINE'
            ? 'GRAY'
            : post.visibility,
    })
    await this.deps.postRepo.updateModerationMetadata(post.id, {
      ...(post.moderation_metadata ?? {}),
      distribution_state:
        mode === 'candidate'
          ? distributionState === 'BLOCKED'
            ? 'BLOCKED'
            : 'NO_RECOMMEND'
          : distributionState === 'BLOCKED'
            ? 'BLOCKED'
            : 'NORMAL',
    })
  }

  private async applyThreadExposure(
    threadId: string,
    mode: 'candidate' | 'active',
  ): Promise<void> {
    await Promise.all([
      this.deps.publicStageThreadRepo.updateState(
        threadId,
        mode === 'candidate' ? 'PENDING' : 'APPROVED',
      ),
      this.deps.publicStageThreadRepo.updateVisibility(
        threadId,
        mode === 'candidate' ? 'GRAY' : 'GRAY',
      ),
    ])
  }

  private async applyTurnExposure(
    turnId: string,
    mode: 'candidate' | 'active',
  ): Promise<void> {
    await Promise.all([
      this.deps.publicStageTurnRepo.updateState(
        turnId,
        mode === 'candidate' ? 'PENDING' : 'APPROVED',
      ),
      this.deps.publicStageTurnRepo.updateVisibility(
        turnId,
        mode === 'candidate' ? 'GRAY' : 'GRAY',
      ),
    ])
  }

  private computeMediaCoverageRatio(postCounts: number[], coveredCounts: number[]): number {
    const totalPosts = postCounts.reduce((sum, value) => sum + value, 0)
    if (totalPosts === 0) return 0
    const covered = coveredCounts.reduce((sum, value) => sum + value, 0)
    return Math.round((covered / totalPosts) * 1000) / 1000
  }

  private async resolveGovernancePreview(input: {
    action: GovernanceBatchAction
    suite_id?: string | null
    warm_start_batch_ids?: string[]
    content_ids?: string[]
  }): Promise<WarmupGovernancePreview> {
    const batchIds = new Set(input.warm_start_batch_ids ?? [])
    if (input.suite_id) {
      const suite = await this.deps.warmupGovernanceRepo.findSuiteById(input.suite_id)
      if (!suite) throw new NotFoundError('warmup suite', input.suite_id)
      if (suite.kickoff_batch_id) batchIds.add(suite.kickoff_batch_id)
      if (suite.warmup_batch_id) batchIds.add(suite.warmup_batch_id)
    }
    if (batchIds.size === 0) {
      throw new ValidationError('governance preview requires suite_id or warm_start_batch_ids')
    }

    const content = await Promise.all(
      [...batchIds].map((batchId) => this.readBatchContent(batchId)),
    )
    const posts = content.flatMap((item) => item.posts)
    const filteredPosts = input.content_ids?.length
      ? posts.filter((post) => input.content_ids?.includes(post.id))
      : posts
    const filteredPostIds = new Set(filteredPosts.map((post) => post.id))
    const filteredThreads = content
      .flatMap((item) => item.threads)
      .filter((thread) => filteredPostIds.size === 0 || filteredPostIds.has(thread.post_id))
    const filteredTurns = content
      .flatMap((item) => item.turns)
      .filter((turn) => filteredPostIds.size === 0 || filteredPostIds.has(turn.post_id))
    const filteredMedia = content
      .flatMap((item) => item.media)
      .filter((media) => filteredPostIds.size === 0 || filteredPostIds.has(media.post_id))

    return {
      action: input.action,
      suite_id: input.suite_id ?? null,
      warm_start_batch_ids: [...batchIds],
      scope: {
        posts: filteredPosts.map((post) => post.id),
        threads: filteredThreads.map((thread) => thread.id),
        turns: filteredTurns.map((turn) => turn.id),
        media: filteredMedia.map((media) => media.id),
      },
      counts: {
        posts: filteredPosts.length,
        threads: filteredThreads.length,
        turns: filteredTurns.length,
        media: filteredMedia.length,
      },
    }
  }

  private async resolvePostsForPreview(preview: WarmupGovernancePreview): Promise<Post[]> {
    const posts = await this.deps.postRepo.findByWarmStartBatches(preview.warm_start_batch_ids)
    const scope = new Set(preview.scope.posts)
    return posts.filter((post) => scope.has(post.id))
  }

  private async resolveThreadsForPreview(
    preview: WarmupGovernancePreview,
  ): Promise<PublicStageThread[]> {
    const threads = await Promise.all(
      preview.warm_start_batch_ids.map((batchId) =>
        this.deps.publicStageThreadRepo.findByWarmStartBatch(batchId)),
    )
    const scope = new Set(preview.scope.threads)
    return threads.flat().filter((thread) => scope.has(thread.id))
  }

  private async resolveTurnsForPreview(
    preview: WarmupGovernancePreview,
  ): Promise<PublicStageTurn[]> {
    const turns = await Promise.all(
      preview.warm_start_batch_ids.map((batchId) =>
        this.deps.publicStageTurnRepo.findByWarmStartBatch(batchId)),
    )
    const scope = new Set(preview.scope.turns)
    return turns.flat().filter((turn) => scope.has(turn.id))
  }

  private async restorePost(post: Post, suite: WarmupSuite | null): Promise<void> {
    await this.deps.postRepo.updateContent(post.id, {
      visibility: suite?.state === 'active' ? 'GRAY' : 'GRAY',
      state: suite?.state === 'active' ? 'APPROVED' : 'PENDING',
    })
    await this.deps.postRepo.updateModerationMetadata(post.id, {
      ...(post.moderation_metadata ?? {}),
      distribution_state: suite?.state === 'active' ? 'NORMAL' : 'NO_RECOMMEND',
    })
  }

  private async restoreThread(
    thread: PublicStageThread,
    suite: WarmupSuite | null,
  ): Promise<void> {
    await Promise.all([
      this.deps.publicStageThreadRepo.updateVisibility(thread.id, 'GRAY'),
      this.deps.publicStageThreadRepo.updateState(
        thread.id,
        suite?.state === 'active' ? 'APPROVED' : 'PENDING',
      ),
    ])
  }

  private async restoreTurn(
    turn: PublicStageTurn,
    suite: WarmupSuite | null,
  ): Promise<void> {
    await Promise.all([
      this.deps.publicStageTurnRepo.updateVisibility(turn.id, 'GRAY'),
      this.deps.publicStageTurnRepo.updateState(
        turn.id,
        suite?.state === 'active' ? 'APPROVED' : 'PENDING',
      ),
    ])
  }

  private async refreshSearchDocs(input: {
    postIds?: string[]
    threadIds?: string[]
  }): Promise<void> {
    const searchProjectionService = this.projectionDeps.searchProjectionService
    if (!searchProjectionService) return

    const postIds = [...new Set(input.postIds ?? [])]
    const threadIds = [...new Set(input.threadIds ?? [])]

    if (postIds.length > 0) {
      await Promise.all(postIds.map((postId) => searchProjectionService.refreshPost(postId)))
    }
    if (threadIds.length > 0) {
      await Promise.all(threadIds.map((threadId) => searchProjectionService.refreshThread(threadId)))
    }
  }

  private getSuiteIdForPost(post: Post, preview: WarmupGovernancePreview): string | null {
    return this.getSuiteIdForBatch(post.warm_start_batch_id, preview)
  }

  private getSuiteIdForBatch(
    batchId: string | null | undefined,
    preview: WarmupGovernancePreview,
  ): string | null {
    if (!batchId) return preview.suite_id
    return preview.suite_id
  }

  private async requireGovernanceBatch(governanceBatchId: string) {
    const batch = await this.deps.warmupGovernanceRepo.findGovernanceBatchById(governanceBatchId)
    if (!batch) throw new NotFoundError('governance batch', governanceBatchId)
    return batch
  }
}
