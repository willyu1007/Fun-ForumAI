import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import {
  buildCommunityAliasMap,
  buildSystemAgentIndexes,
  buildKickoffScenePayload,
  type KickoffPostSpec,
  pickRosterEntryForSpec,
} from '../launch/kickoff.js'
import { loadKickoffBundle } from '../launch/kickoff.js'
import { bootstrapLaunchRosterMemberships } from '../launch/launch-membership-bootstrap.js'
import { getLaunchSystemRoster, type LaunchSystemRosterRuntime } from '../launch/system-roster.js'
import { getLaunchProgrammingSchedule } from '../launch/programming-schedule.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import type {
  AgentConfigRepository,
  AgentRepository,
  CommunityRepository,
  Post,
  PostMedia,
  PostRepository,
  PublicStageThread,
  PublicStageThreadRepository,
  PublicStageTurn,
  PublicStageTurnRepository,
  RoleAssignmentRepository,
  Vote,
  VoteRepository,
  GovernanceBatch,
  GovernanceGenerationMode,
  KickoffBaseline,
} from '../repos/index.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { WarmupGovernanceRepository } from '../repos/warmup-governance-repository.js'
import type { AgentCommunityMembershipService } from './agent-community-membership-service.js'
import type { AgentStageTierService } from './agent-stage-tier-service.js'
import type { AftershowService } from './aftershow-service.js'
import type { ForumWriteService } from './forum-write-service.js'
import type { LaunchProgrammingOpsService } from './launch-programming-ops-service.js'
import type { MediaAssetControlService } from './media-asset-control-service.js'
import type { RoleAssignmentService } from './role-assignment-service.js'
import type { PostSchedulerResult } from '../runtime/post-scheduler.js'
import type { GovernanceWriteContextInput } from './forum-write-service/types.js'

const DEFAULT_SUITE_LABEL = 'kickoff-baseline-v1'
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

const WARMUP_RUN_PROCESSOR_STALE_MS = 20 * 60 * 1000
const DEFAULT_WARMUP_RUNTIME_ATTEMPT_TIMEOUT_MS = 120_000
const DEFAULT_WARMUP_FOLLOWUP_TICK_BUDGET = 4

interface WarmupBatchContent {
  posts: Post[]
  threads: PublicStageThread[]
  turns: PublicStageTurn[]
  media: PostMedia[]
  votes: Vote[]
}

interface GeneratedGovernancePostSummary {
  spec_id: string
  post_id: string
  title: string
  agent_id: string
  community_id: string
  community_slug: string
  batch_id: string
  batch_kind: GovernanceBatch['batch_kind']
}

interface GeneratedGovernancePost {
  summary: GeneratedGovernancePostSummary
  spec: KickoffPostSpec
  post_id: string
  author_agent_id: string
  community_id: string
  community_slug: string
  thread_id: string
  turn_ids: string[]
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
  batch_kind: GovernanceBatch['batch_kind']
  state: GovernanceBatch['state']
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

export interface RuntimeBaselineAdmission {
  kickoff_baseline_id: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  has_kickoff_baseline: boolean
  kickoff_layer_ready: boolean
  warmup_layer_ready: boolean
  key_communities_ready: boolean
  key_shelves_ready: boolean
  media_access_ok: boolean
  aftershow_pipeline_ok: boolean
  allow_public_growth: boolean
  reasons: string[]
}

interface WarmupRunStoredMetadata {
  kind: 'warmup_run'
  target_posts: number
  max_attempts: number
  attempted: number
  triggered: number
  errors: string[]
  stop_reason: 'target_reached' | 'max_attempts_exhausted' | 'failed' | 'rolled_back' | null
  rolled_back_at?: string | null
}

export interface KickoffBaselineDetail {
  id: string
  baseline_label: string | null
  state: KickoffBaseline['state']
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  activated_at: string | null
  kickoff_batch_id: string
  current_warmup_run_id: string | null
  kickoff_batch: WarmupBatchReadModel
  current_warmup_run: WarmupRunDetail | null
  verification: {
    ok: boolean
    missing: string[]
  }
}

export interface KickoffImportResult {
  kickoff_baseline_id: string
  baseline_label: string | null
  kickoff_batch_id: string
  bundle_id: string
  manifest_path: string
  bootstrap_memberships: Awaited<ReturnType<typeof bootstrapLaunchRosterMemberships>>
  created_posts: Array<{
    spec_id: string
    post_id: string
    title: string
    agent_id: string
    community_id: string
    community_slug: string
    batch_id: string
  }>
  verification: {
    ok: boolean
    missing: string[]
    active_baseline: RuntimeBaselineAdmission
  }
}

export interface WarmupRunListItem {
  id: string
  state: GovernanceBatch['state']
  is_current: boolean
  source_run_id: string | null
  target_posts: number
  max_attempts: number
  attempted: number
  triggered: number
  stop_reason: WarmupRunStoredMetadata['stop_reason']
  errors: string[]
  created_at: string
  updated_at: string
  activated_at: string | null
  archived_at: string | null
  stats: WarmupBatchReadModel['stats']
}

export interface WarmupRunDetail extends WarmupRunListItem {
  kickoff_baseline_id: string
  kickoff_label: string | null
  coverage: WarmupBatchReadModel['coverage']
  samples: WarmupBatchReadModel['samples']
  rolled_back_at: string | null
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
  roleAssignmentRepo?: Pick<RoleAssignmentRepository, 'listActiveByScope'> | null
  membershipService: Pick<AgentCommunityMembershipService, 'reconcileMemberships' | 'listActive'>
  stageTierService?: Pick<AgentStageTierService, 'ensureBootstrapSnapshot'> | null
  forumWriteService: Pick<
    ForumWriteService,
    'createPost' | 'createThread' | 'addThreadTurn' | 'upsertVote'
  >
  launchProgrammingOpsService: Pick<LaunchProgrammingOpsService, 'getAdminPayload'>
  aftershowService?: Pick<AftershowService, 'trigger'> | null
  roleAssignmentService?: Pick<RoleAssignmentService, 'assign'> | null
  mediaAssetControlService?: Pick<
    MediaAssetControlService,
    'createFromUpload' | 'promoteAsset' | 'attachPostMediaAndConsume'
  > | null
  postScheduler?: {
    createPost(input?: { governance_context?: GovernanceWriteContextInput }): Promise<PostSchedulerResult>
    forcePost(input?: { governance_context?: GovernanceWriteContextInput }): Promise<PostSchedulerResult>
  } | null
  runtimeLoop?: {
    isRunning: boolean
    tick?(): Promise<{
      processed_events: number
      batch_stats: {
        successful: number
      }
    }>
  } | null
  eventQueue?: {
    clear(): Promise<void>
    size(): Promise<number>
  } | null
  warmupAttemptTimeoutMs?: number
  searchProjectionService?: {
    refreshPost(postId: string): Promise<void>
    refreshThread(threadId: string): Promise<void>
  } | null
}

function normalizeWarmupAttemptTimeoutMs(timeoutMs: number | undefined): number {
  if (!Number.isFinite(timeoutMs) || Number(timeoutMs) < 1) {
    return DEFAULT_WARMUP_RUNTIME_ATTEMPT_TIMEOUT_MS
  }
  return Math.trunc(Number(timeoutMs))
}

async function runWarmupRuntimeAttemptWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`warmup runtime attempt timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function readDistributionState(post: Pick<Post, 'moderation_metadata'>): string {
  return post.moderation_metadata?.distribution_state ?? 'NORMAL'
}

function shouldAttachMedia(spec: KickoffPostSpec): boolean {
  if (spec.visual_asset_path) {
    return true
  }
  if (spec.attach_media !== undefined) {
    return spec.attach_media
  }
  return (
    spec.content_kind === 'note_entry' ||
    spec.content_kind === 'highlight_hero' ||
    spec.content_kind === 'programming_slot' ||
    spec.id === 'amplification-hot-arena-second-round'
  )
}

function pickLocalWarmupMediaAsset(spec: KickoffPostSpec): string {
  if (spec.visual_asset_path) {
    return spec.visual_asset_path
  }
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
  const candidatePaths = [resolve(cwd, relativeAssetPath)]
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

function buildWarmupThreadBody(input: { spec: KickoffPostSpec; ordinal: number }): string {
  const prefix =
    input.ordinal === 0 ? '我先接住这条主判断。' : '如果要把这条线继续顶上去，我会补这一层。'
  return [
    prefix,
    `${input.spec.storyline.hook} 不能只停在标题里，至少要把下一步最值得追的人和代价点出来。`,
    '这样这条内容才像是已经有人真的在场，而不是只放了一个首屏公告。',
  ].join('\n')
}

function buildWarmupTurnBody(input: { spec: KickoffPostSpec; ordinal: number }): string {
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

function buildRuntimeWarmupSpec(input: {
  run_id: string
  ordinal: number
  post: Post
  community_slug: string
}): KickoffPostSpec {
  const trimmedTitle = input.post.title.trim() || 'runtime-warmup'
  return {
    id: `warmup-runtime-${input.run_id}-${input.ordinal}`,
    community_slug: input.community_slug,
    programming_daypart: 'evening_prime',
    scheduled_local_time: '19:20',
    phase: 'escalation',
    title: trimmedTitle,
    body: input.post.body,
    tags: input.post.tags,
    storyline: {
      id: `warmup-runtime-story-${input.run_id}-${input.ordinal}`,
      title: trimmedTitle,
      hook: `继续围绕“${trimmedTitle}”把分歧、代价和站位变化推到台前。`,
      state: 'escalating',
    },
    editorial_shelf_id: 'continue_storyline',
    content_kind: 'mainline_root',
    target_thread_turn_count: 3,
    post_vote_target: 3,
    attach_media: false,
  }
}

function toLocalDateKey(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

function readLocalDateTimeParts(
  date: Date,
  timeZone: string,
): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.year ?? '0'),
    month: Number(parts.month ?? '0'),
    day: Number(parts.day ?? '0'),
    hour: Number(parts.hour ?? '0'),
    minute: Number(parts.minute ?? '0'),
  }
}

function resolveLocalScheduleInstant(input: {
  date_key: string
  time: string
  time_zone: string
}): Date {
  const [yearRaw, monthRaw, dayRaw] = input.date_key.split('-')
  const [hourRaw, minuteRaw] = input.time.split(':')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  const baseUtcMs = Date.UTC(year, month - 1, day, hour, minute)

  for (let offsetMinutes = -18 * 60; offsetMinutes <= 18 * 60; offsetMinutes += 1) {
    const candidate = new Date(baseUtcMs + offsetMinutes * 60_000)
    const local = readLocalDateTimeParts(candidate, input.time_zone)
    if (
      local.year === year &&
      local.month === month &&
      local.day === day &&
      local.hour === hour &&
      local.minute === minute
    ) {
      return candidate
    }
  }

  throw new ValidationError(
    `unable to resolve scheduled kickoff timestamp for ${input.date_key} ${input.time} (${input.time_zone})`,
  )
}

function buildProgrammingHealthReadinessReasons(input: {
  required_daily_outcomes: Record<string, number>
  observed_daily_outcomes: Record<string, number>
  daypart_readiness: Array<{ ok: boolean }>
  community_supply_floor: Array<{ ok: boolean }>
  visual_ratio_ok: boolean
  aftershow_pipeline_ok: boolean
}): string[] {
  const reasons: string[] = []
  if (!input.daypart_readiness.every((item) => item.ok)) {
    reasons.push('key_shelves_not_ready')
  }
  if (!input.community_supply_floor.every((item) => item.ok)) {
    reasons.push('key_communities_not_ready')
  }
  for (const [key, required] of Object.entries(input.required_daily_outcomes)) {
    const observed = input.observed_daily_outcomes[key.replace(/_min$/, '')] ?? 0
    if (observed < required) {
      reasons.push(`${key}_below_floor`)
    }
  }
  if (!input.visual_ratio_ok) {
    reasons.push('media_access_not_ready')
  }
  if (!input.aftershow_pipeline_ok) {
    reasons.push('aftershow_pipeline_not_ready')
  }
  return reasons
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

const EMPTY_WARMUP_RUN_METADATA: WarmupRunStoredMetadata = {
  kind: 'warmup_run',
  target_posts: 0,
  max_attempts: 0,
  attempted: 0,
  triggered: 0,
  errors: [],
  stop_reason: null,
  rolled_back_at: null,
}

function encodeWarmupRunMetadata(input: WarmupRunStoredMetadata): string {
  return JSON.stringify(input)
}

function decodeWarmupRunMetadata(notes: string | null): WarmupRunStoredMetadata {
  if (!notes) return EMPTY_WARMUP_RUN_METADATA
  try {
    const parsed = JSON.parse(notes) as Partial<WarmupRunStoredMetadata>
    if (parsed.kind !== 'warmup_run') return EMPTY_WARMUP_RUN_METADATA
    return {
      kind: 'warmup_run',
      target_posts: Number.isFinite(parsed.target_posts) ? Number(parsed.target_posts) : 0,
      max_attempts: Number.isFinite(parsed.max_attempts) ? Number(parsed.max_attempts) : 0,
      attempted: Number.isFinite(parsed.attempted) ? Number(parsed.attempted) : 0,
      triggered: Number.isFinite(parsed.triggered) ? Number(parsed.triggered) : 0,
      errors: Array.isArray(parsed.errors)
        ? parsed.errors.filter((item): item is string => typeof item === 'string')
        : [],
      stop_reason:
        parsed.stop_reason === 'target_reached'
        || parsed.stop_reason === 'max_attempts_exhausted'
        || parsed.stop_reason === 'failed'
        || parsed.stop_reason === 'rolled_back'
          ? parsed.stop_reason
          : null,
      rolled_back_at:
        typeof parsed.rolled_back_at === 'string' || parsed.rolled_back_at === null
          ? parsed.rolled_back_at
          : null,
    }
  } catch {
    return EMPTY_WARMUP_RUN_METADATA
  }
}

function createQueuedWarmupRevisionKey(now = Date.now()): string {
  return `warmup:queued:${now}`
}

function createProcessingWarmupRevisionKey(processorId: string, now = Date.now()): string {
  return `warmup:processing:${now}:${processorId}`
}

function createSettledWarmupRevisionKey(
  state: 'active' | 'failed' | 'archived',
  now = Date.now(),
): string {
  return `warmup:${state}:${now}`
}

function parseProcessingWarmupRevisionKey(revisionKey: string | null): { started_at: number } | null {
  if (!revisionKey?.startsWith('warmup:processing:')) {
    return null
  }
  const [, , startedAtRaw] = revisionKey.split(':', 4)
  const startedAt = Number.parseInt(startedAtRaw ?? '', 10)
  if (!Number.isFinite(startedAt)) {
    return null
  }
  return { started_at: startedAt }
}

export class WarmupGovernanceService {
  private runtimeDeps: {
    postScheduler: WarmupGovernanceServiceDeps['postScheduler']
    runtimeLoop: WarmupGovernanceServiceDeps['runtimeLoop']
    eventQueue: WarmupGovernanceServiceDeps['eventQueue']
    warmupAttemptTimeoutMs: number
  }
  private projectionDeps: {
    searchProjectionService: WarmupGovernanceServiceDeps['searchProjectionService']
  }
  private readonly warmupRunProcessors = new Map<string, Promise<void>>()
  private readonly processorId = `${process.pid}:${randomUUID().slice(0, 8)}`

  constructor(private readonly deps: WarmupGovernanceServiceDeps) {
    this.runtimeDeps = {
      postScheduler: deps.postScheduler ?? null,
      runtimeLoop: deps.runtimeLoop ?? null,
      eventQueue: deps.eventQueue ?? null,
      warmupAttemptTimeoutMs: normalizeWarmupAttemptTimeoutMs(deps.warmupAttemptTimeoutMs),
    }
    this.projectionDeps = {
      searchProjectionService: deps.searchProjectionService ?? null,
    }
  }

  attachRuntimeDeps(input: {
    postScheduler?: WarmupGovernanceServiceDeps['postScheduler']
    runtimeLoop?: WarmupGovernanceServiceDeps['runtimeLoop']
    eventQueue?: WarmupGovernanceServiceDeps['eventQueue']
    warmupAttemptTimeoutMs?: number
  }): void {
    this.runtimeDeps = {
      postScheduler: input.postScheduler ?? this.runtimeDeps.postScheduler,
      runtimeLoop: input.runtimeLoop ?? this.runtimeDeps.runtimeLoop,
      eventQueue: input.eventQueue ?? this.runtimeDeps.eventQueue,
      warmupAttemptTimeoutMs: normalizeWarmupAttemptTimeoutMs(
        input.warmupAttemptTimeoutMs ?? this.runtimeDeps.warmupAttemptTimeoutMs,
      ),
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

  private async clearRuntimeEventQueue(
    reason: 'kickoff_import' | 'warmup_start' | 'warmup_rollback',
  ): Promise<void> {
    const queue = this.runtimeDeps.eventQueue
    if (!queue) {
      return
    }
    const pending = await queue.size().catch(() => 0)
    if (pending < 1) {
      return
    }
    await queue.clear()
    console.warn(
      `[WarmupGovernanceService] Cleared ${pending} queued runtime events before ${reason}`,
    )
  }

  async importKickoffBaseline(
    input: {
      baseline_label?: string | null
      roster?: LaunchSystemRosterRuntime
      created_by_user_id?: string | null
      manifest_path?: string | null
      now?: Date
    } = {},
  ): Promise<KickoffImportResult> {
    const existing = await this.findActiveKickoffBaseline()
    if (existing) {
      throw new ValidationError(
        `kickoff baseline already exists: archive or migrate ${existing.id} before importing again`,
      )
    }

    const bundle = loadKickoffBundle(input.manifest_path ?? undefined)
    const roster = input.roster ?? getLaunchSystemRoster()
    const now = input.now ?? new Date()
    const baselineLabel =
      input.baseline_label?.trim() || bundle.baseline_label?.trim() || DEFAULT_SUITE_LABEL
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

    const suite = await this.deps.warmupGovernanceRepo.createBaseline({
      state: 'draft',
      baseline_label: baselineLabel,
      created_by_user_id: input.created_by_user_id ?? null,
    })

    const kickoffBatch = await this.deps.warmupGovernanceRepo.createBatch({
      baseline_id: suite.id,
      batch_kind: 'kickoff',
      state: 'generating',
      revision_key: `kickoff:${bundle.bundle_id}`,
      package_hash: bundle.bundle_id,
      notes: JSON.stringify({
        kind: 'kickoff_bundle',
        manifest_path: bundle.manifest_path,
        imported_at: now.toISOString(),
      }),
    })

    let createdPosts!: GeneratedGovernancePost[]
    try {
      createdPosts = await this.generateBatch({
        batch: kickoffBatch,
        specs: bundle.posts,
        roster,
        indexes,
        communityByAlias,
        usedAgentIds,
        now,
        generation_mode: 'kickoff_import',
      })
      await this.applyBatchExposure(kickoffBatch.id, 'active')
      await this.deps.warmupGovernanceRepo.updateBatch(kickoffBatch.id, {
        state: 'active',
        activated_at: now,
        notes: JSON.stringify({
          kind: 'kickoff_bundle',
          manifest_path: bundle.manifest_path,
          imported_at: now.toISOString(),
          imported_posts: createdPosts.length,
        }),
      })
      await this.deps.warmupGovernanceRepo.updateBaseline(suite.id, {
        kickoff_batch_id: kickoffBatch.id,
        state: 'active',
        activated_at: now,
        archived_at: null,
      })
    } catch (error) {
      await this.deps.warmupGovernanceRepo.updateBatch(kickoffBatch.id, {
        state: 'failed',
        notes: error instanceof Error ? error.message : 'kickoff import failed',
      })
      await this.deps.warmupGovernanceRepo.updateBaseline(suite.id, {
        state: 'archived',
        archived_at: new Date(),
      })
      throw error
    }

    await this.clearRuntimeEventQueue('kickoff_import')

    const kickoffDetail = await this.getKickoffDetail(suite.id)
    const admission = await this.getRuntimeBaselineAdmission()

    return {
      kickoff_baseline_id: kickoffDetail.id,
      baseline_label: kickoffDetail.baseline_label,
      kickoff_batch_id: kickoffDetail.kickoff_batch_id,
      bundle_id: bundle.bundle_id,
      manifest_path: bundle.manifest_path,
      bootstrap_memberships: bootstrapMemberships,
      created_posts: createdPosts.map((item) => ({
        spec_id: item.summary.spec_id,
        post_id: item.summary.post_id,
        title: item.summary.title,
        agent_id: item.summary.agent_id,
        community_id: item.summary.community_id,
        community_slug: item.summary.community_slug,
        batch_id: item.summary.batch_id,
      })),
      verification: {
        ok: kickoffDetail.verification.ok,
        missing: kickoffDetail.verification.missing,
        active_baseline: admission,
      },
    }
  }

  async getKickoffStatus(): Promise<KickoffBaselineDetail | null> {
    const suite = await this.findActiveKickoffBaseline()
    if (!suite) return null
    return this.getKickoffDetail(suite.id)
  }

  async getKickoffDetail(kickoffBaselineId: string): Promise<KickoffBaselineDetail> {
    const suite = await this.deps.warmupGovernanceRepo.findBaselineById(kickoffBaselineId)
    if (!suite) throw new NotFoundError('kickoff baseline', kickoffBaselineId)
    if (!suite.kickoff_batch_id) {
      throw new ValidationError(`kickoff baseline ${suite.id} is missing kickoff batch linkage`)
    }
    const kickoffBatch = await this.deps.warmupGovernanceRepo.findBatchById(suite.kickoff_batch_id)
    if (!kickoffBatch) {
      throw new NotFoundError('kickoff batch', suite.kickoff_batch_id)
    }
    const kickoffBatchReadModel = await this.buildBatchReadModel(kickoffBatch)
    const currentWarmupRun = suite.warmup_batch_id ? await this.getWarmupRun(suite.warmup_batch_id) : null
    return {
      id: suite.id,
      baseline_label: suite.baseline_label,
      state: suite.state,
      created_by_user_id: suite.created_by_user_id,
      created_at: suite.created_at.toISOString(),
      updated_at: suite.updated_at.toISOString(),
      activated_at: toIso(suite.activated_at),
      kickoff_batch_id: kickoffBatch.id,
      current_warmup_run_id: suite.warmup_batch_id,
      kickoff_batch: kickoffBatchReadModel,
      current_warmup_run: currentWarmupRun,
      verification: {
        ok: batchReadinessReasons(kickoffBatchReadModel, 'kickoff').length === 0,
        missing: batchReadinessReasons(kickoffBatchReadModel, 'kickoff'),
      },
    }
  }

  async listWarmupRuns(): Promise<WarmupRunListItem[]> {
    const suite = await this.findActiveKickoffBaseline()
    if (!suite) return []
    const batches = await this.deps.warmupGovernanceRepo.listBatchesByBaseline(suite.id)
    const warmupRuns = await Promise.all(
      batches
        .filter((batch) => batch.batch_kind === 'warmup')
        .map((batch) => this.buildWarmupRunDetail(suite, batch)),
    )
    for (const batch of batches) {
      if (batch.batch_kind === 'warmup' && batch.state === 'generating') {
        void this.ensureWarmupRunProcessing(batch.id)
      }
    }
    return warmupRuns
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map(({ coverage: _coverage, samples: _samples, rolled_back_at: _rolledBackAt, kickoff_baseline_id: _kickoffBaselineId, kickoff_label: _kickoffLabel, ...item }) => item)
  }

  async getWarmupRun(runId: string): Promise<WarmupRunDetail> {
    const batch = await this.deps.warmupGovernanceRepo.findBatchById(runId)
    if (!batch || batch.batch_kind !== 'warmup') {
      throw new NotFoundError('warmup run', runId)
    }
    const suite = await this.deps.warmupGovernanceRepo.findBaselineById(batch.baseline_id)
    if (!suite) throw new NotFoundError('kickoff baseline', batch.baseline_id)
    if (batch.state === 'generating') {
      void this.ensureWarmupRunProcessing(batch.id)
    }
    return this.buildWarmupRunDetail(suite, batch)
  }

  async startWarmupRun(input: {
    actor_user_id?: string | null
    target_posts: number
    max_attempts: number
  }): Promise<WarmupRunDetail> {
    await this.clearRuntimeEventQueue('warmup_start')
    const run = await this.createWarmupRunRecord(input)
    void this.ensureWarmupRunProcessing(run.id)
    return this.getWarmupRun(run.id)
  }

  private async createWarmupRunRecord(input: {
    actor_user_id?: string | null
    target_posts: number
    max_attempts: number
  }): Promise<GovernanceBatch> {
    if (input.target_posts < 1) {
      throw new ValidationError('target_posts must be at least 1')
    }
    if (input.max_attempts < 1) {
      throw new ValidationError('max_attempts must be at least 1')
    }
    if (!this.runtimeDeps.postScheduler) {
      throw new ValidationError('warmup runtime is unavailable: post scheduler is not attached')
    }

    const suite = await this.requireActiveKickoffBaseline()
    const kickoffDetail = await this.getKickoffDetail(suite.id)
    if (!kickoffDetail.verification.ok) {
      throw new ValidationError('kickoff baseline is not ready for warmup runtime', {
        reasons: kickoffDetail.verification.missing,
      })
    }

    const existingBatches = await this.deps.warmupGovernanceRepo.listBatchesByBaseline(suite.id)
    const generatingRun = existingBatches.find((batch) =>
      batch.batch_kind === 'warmup' && batch.state === 'generating'
    )
    if (generatingRun) {
      throw new ValidationError('warmup run already in progress', {
        run_id: generatingRun.id,
      })
    }

    const queuedRevisionKey = createQueuedWarmupRevisionKey()
    const metadata: WarmupRunStoredMetadata = {
      kind: 'warmup_run',
      target_posts: input.target_posts,
      max_attempts: input.max_attempts,
      attempted: 0,
      triggered: 0,
      errors: [],
      stop_reason: null,
      rolled_back_at: null,
    }

    return this.deps.warmupGovernanceRepo.createBatch({
      baseline_id: suite.id,
      batch_kind: 'warmup',
      state: 'generating',
      source_batch_id: suite.warmup_batch_id ?? null,
      revision_key: queuedRevisionKey,
      package_hash: queuedRevisionKey,
      notes: encodeWarmupRunMetadata(metadata),
    })
  }

  private async ensureWarmupRunProcessing(runId: string): Promise<void> {
    const existing = this.warmupRunProcessors.get(runId)
    if (existing) {
      return
    }

    const run = await this.deps.warmupGovernanceRepo.findBatchById(runId)
    if (!run || run.batch_kind !== 'warmup' || run.state !== 'generating') {
      return
    }

    const processingRevision = parseProcessingWarmupRevisionKey(run.revision_key)
    if (
      processingRevision
      && Date.now() - processingRevision.started_at < WARMUP_RUN_PROCESSOR_STALE_MS
    ) {
      return
    }

    const claimed = await this.deps.warmupGovernanceRepo.compareAndSwapBatchRevision({
      id: run.id,
      expected_revision_key: run.revision_key ?? null,
      next_revision_key: createProcessingWarmupRevisionKey(this.processorId),
    })
    if (!claimed) {
      return
    }

    const task = this.processWarmupRun(claimed.id)
      .catch((error) => {
        console.error(
          `[WarmupGovernanceService] Warmup run processor failed for ${claimed.id}:`,
          error,
        )
      })
      .finally(() => {
        this.warmupRunProcessors.delete(claimed.id)
      })
    this.warmupRunProcessors.set(claimed.id, task)
  }

  private async processWarmupRun(runId: string): Promise<void> {
    const scheduler = this.runtimeDeps.postScheduler
    if (!scheduler) {
      throw new ValidationError('warmup runtime is unavailable: post scheduler is not attached')
    }

    const run = await this.deps.warmupGovernanceRepo.findBatchById(runId)
    if (!run || run.batch_kind !== 'warmup') {
      throw new NotFoundError('warmup run', runId)
    }
    if (run.state !== 'generating') {
      return
    }

    const suite = await this.deps.warmupGovernanceRepo.findBaselineById(run.baseline_id)
    if (!suite) {
      throw new NotFoundError('kickoff baseline', run.baseline_id)
    }

    const metadata = decodeWarmupRunMetadata(run.notes)
    const roster = getLaunchSystemRoster()
    const indexes = buildSystemAgentIndexes({
      agentRepo: this.deps.agentRepo,
      agentConfigRepo: this.deps.agentConfigRepo,
      ownerId: roster.owner_model.owner_id,
    })

    try {
      while (metadata.attempted < metadata.max_attempts && metadata.triggered < metadata.target_posts) {
        metadata.attempted += 1
        await this.deps.warmupGovernanceRepo.updateBatch(run.id, {
          notes: encodeWarmupRunMetadata(metadata),
        })

        let result: PostSchedulerResult
        try {
          result = await runWarmupRuntimeAttemptWithTimeout(
            scheduler.forcePost({
              governance_context: {
                governance_batch_id: run.id,
                generation_mode: 'warmup_runtime',
              },
            }),
            this.runtimeDeps.warmupAttemptTimeoutMs,
          )
        } catch (error) {
          metadata.errors.push(
            error instanceof Error ? error.message : 'warmup runtime attempt failed',
          )
          await this.deps.warmupGovernanceRepo.updateBatch(run.id, {
            notes: encodeWarmupRunMetadata(metadata),
          })
          continue
        }
        if (result.triggered) {
          metadata.triggered += 1
          if (result.post_id) {
            const createdPost = await this.deps.postRepo.findById(result.post_id)
            if (!createdPost) {
              throw new NotFoundError('post', result.post_id)
            }
            const authorAgentId = result.agent_id ?? createdPost.author_agent_id
            const community = this.deps.communityRepo.findById(createdPost.community_id)
            if (!authorAgentId || !community) {
              throw new ValidationError(
                'warmup runtime engagement is blocked: generated post context is incomplete',
              )
            }
            const runtimeSpec = buildRuntimeWarmupSpec({
              run_id: run.id,
              ordinal: metadata.triggered,
              post: createdPost,
              community_slug: community.slug,
            })
            await this.ensureRuntimeWarmupFollowup({
              batch: run,
              spec: runtimeSpec,
              post: createdPost,
              rootAuthorAgentId: authorAgentId,
              roster,
              indexes,
            })
            await this.ensureCommunityRoleAssignment({
              community_id: createdPost.community_id,
              agent_id: authorAgentId,
            })
          }
        }
        if (result.error) {
          metadata.errors.push(result.error)
        }

        await this.deps.warmupGovernanceRepo.updateBatch(run.id, {
          notes: encodeWarmupRunMetadata(metadata),
        })
      }

      metadata.stop_reason =
        metadata.triggered >= metadata.target_posts ? 'target_reached' : 'max_attempts_exhausted'

      const generatedRunBatch = await this.deps.warmupGovernanceRepo.findBatchById(run.id)
      if (!generatedRunBatch) {
        throw new NotFoundError('warmup run', run.id)
      }
      const generatedRunReadModel = await this.buildBatchReadModel(generatedRunBatch)
      const readyReasons = batchReadinessReasons(generatedRunReadModel, 'warmup')

      if (readyReasons.length === 0) {
        if (run.source_batch_id) {
          await this.applyBatchExposure(run.source_batch_id, 'candidate')
          await this.deps.warmupGovernanceRepo.updateBatch(run.source_batch_id, {
            state: 'archived',
            archived_at: new Date(),
            revision_key: createSettledWarmupRevisionKey('archived'),
          })
        }
        await this.applyBatchExposure(run.id, 'active')
        await this.deps.warmupGovernanceRepo.updateBatch(run.id, {
          state: 'active',
          activated_at: new Date(),
          archived_at: null,
          notes: encodeWarmupRunMetadata(metadata),
          revision_key: createSettledWarmupRevisionKey('active'),
        })
        await this.deps.warmupGovernanceRepo.updateBaseline(suite.id, {
          warmup_batch_id: run.id,
        })
        return
      }

      await this.applyBatchExposure(run.id, 'candidate')
      await this.deps.warmupGovernanceRepo.updateBatch(run.id, {
        state: 'failed',
        notes: encodeWarmupRunMetadata(metadata),
        revision_key: createSettledWarmupRevisionKey('failed'),
      })
    } catch (error) {
      metadata.errors.push(error instanceof Error ? error.message : 'warmup_processor_failed')
      metadata.stop_reason = 'failed'
      await this.deps.warmupGovernanceRepo.updateBatch(run.id, {
        state: 'failed',
        notes: encodeWarmupRunMetadata(metadata),
        revision_key: createSettledWarmupRevisionKey('failed'),
      })
      throw error
    }
  }

  async rollbackWarmupRun(input: {
    run_id: string
    actor_user_id?: string | null
  }): Promise<WarmupRunDetail> {
    const run = await this.deps.warmupGovernanceRepo.findBatchById(input.run_id)
    if (!run || run.batch_kind !== 'warmup') {
      throw new NotFoundError('warmup run', input.run_id)
    }
    if (run.state === 'generating') {
      throw new ValidationError('cannot rollback warmup run while generation is still in progress')
    }

    const suite = await this.deps.warmupGovernanceRepo.findBaselineById(run.baseline_id)
    if (!suite) throw new NotFoundError('kickoff baseline', run.baseline_id)

    const metadata = decodeWarmupRunMetadata(run.notes)
    metadata.stop_reason = 'rolled_back'
    metadata.rolled_back_at = new Date().toISOString()

    await this.deleteBatchOwnedContent(run.id)
    await this.clearRuntimeEventQueue('warmup_rollback')
    await this.deps.warmupGovernanceRepo.updateBatch(run.id, {
      state: 'archived',
      archived_at: new Date(),
      notes: encodeWarmupRunMetadata(metadata),
      revision_key: createSettledWarmupRevisionKey('archived'),
    })

    if (suite.warmup_batch_id === run.id) {
      if (run.source_batch_id) {
        const previousRun = await this.deps.warmupGovernanceRepo.findBatchById(run.source_batch_id)
        if (previousRun && previousRun.batch_kind === 'warmup') {
          await this.applyBatchExposure(previousRun.id, 'active')
          await this.deps.warmupGovernanceRepo.updateBatch(previousRun.id, {
            state: 'active',
            archived_at: null,
            activated_at: previousRun.activated_at ?? new Date(),
            revision_key: createSettledWarmupRevisionKey('active'),
          })
          await this.deps.warmupGovernanceRepo.updateBaseline(suite.id, {
            warmup_batch_id: previousRun.id,
          })
        } else {
          await this.deps.warmupGovernanceRepo.updateBaseline(suite.id, {
            warmup_batch_id: null,
          })
        }
      } else {
        await this.deps.warmupGovernanceRepo.updateBaseline(suite.id, {
          warmup_batch_id: null,
        })
      }
    }

    return this.getWarmupRun(run.id)
  }

  async getRuntimeBaselineAdmission(): Promise<RuntimeBaselineAdmission> {
    const suite = await this.findActiveKickoffBaseline()
    if (!suite || !suite.kickoff_batch_id) {
      return {
        kickoff_baseline_id: null,
        kickoff_batch_id: null,
        warmup_batch_id: null,
        has_kickoff_baseline: false,
        kickoff_layer_ready: false,
        warmup_layer_ready: false,
        key_communities_ready: false,
        key_shelves_ready: false,
        media_access_ok: false,
        aftershow_pipeline_ok: false,
        allow_public_growth: false,
        reasons: ['no_kickoff_baseline'],
      }
    }

    const batches = await this.deps.warmupGovernanceRepo.listBatchesByBaseline(suite.id)
    const kickoffBatch = batches.find((item) => item.id === suite.kickoff_batch_id) ?? null
    const warmupBatch = suite.warmup_batch_id
      ? batches.find((item) => item.id === suite.warmup_batch_id) ?? null
      : null
    const [kickoffReadModel, warmupReadModel] = await Promise.all([
      kickoffBatch ? this.buildBatchReadModel(kickoffBatch) : Promise.resolve(null),
      warmupBatch ? this.buildBatchReadModel(warmupBatch) : Promise.resolve(null),
    ])
    const opsPayload = await this.deps.launchProgrammingOpsService.getAdminPayload({
      now: new Date(),
    })
    const programmingHealth = opsPayload.health

    const kickoffLayerReady = kickoffBatch?.state === 'active' && kickoffBatch.activated_at !== null
    const warmupLayerReady = warmupBatch?.state === 'active' && warmupBatch.activated_at !== null
    const keyCommunitiesReady = programmingHealth.community_supply_floor.every((item) => item.ok)
    const keyShelvesReady =
      programmingHealth.daypart_readiness.every((item) => item.ok) &&
      Object.entries(programmingHealth.required_daily_outcomes).every(([key, required]) => {
        const observed = programmingHealth.observed_daily_outcomes[key.replace(/_min$/, '')] ?? 0
        return observed >= required
      })
    const mediaAccessOk = programmingHealth.visual_ratio_ok
    const aftershowPipelineOk = programmingHealth.aftershow_pipeline_ok
    const activationReadiness = this.evaluateActivationReadiness({
      kickoffBatch: kickoffReadModel,
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
          (kickoffReadModel?.stats.media_covered_posts ?? 0) +
          (warmupReadModel?.stats.media_covered_posts ?? 0),
        media_coverage_ratio: this.computeMediaCoverageRatio(
          [kickoffReadModel?.stats.posts ?? 0, warmupReadModel?.stats.posts ?? 0],
          [
            kickoffReadModel?.stats.media_covered_posts ?? 0,
            warmupReadModel?.stats.media_covered_posts ?? 0,
          ],
        ),
      },
      programming_health: programmingHealth,
    })
    const reasons: string[] = []
    if (!kickoffLayerReady) reasons.push('kickoff_layer_not_ready')
    if (!warmupLayerReady) reasons.push('warmup_layer_not_ready')
    reasons.push(...activationReadiness.reasons)
    if (!keyCommunitiesReady) reasons.push('key_communities_not_ready')
    if (!keyShelvesReady) reasons.push('key_shelves_not_ready')
    if (!mediaAccessOk) reasons.push('media_access_not_ready')
    if (!aftershowPipelineOk) reasons.push('aftershow_pipeline_not_ready')

    return {
      kickoff_baseline_id: suite.id,
      kickoff_batch_id: suite.kickoff_batch_id,
      warmup_batch_id: suite.warmup_batch_id,
      has_kickoff_baseline: true,
      kickoff_layer_ready: kickoffLayerReady,
      warmup_layer_ready: warmupLayerReady,
      key_communities_ready: keyCommunitiesReady,
      key_shelves_ready: keyShelvesReady,
      media_access_ok: mediaAccessOk,
      aftershow_pipeline_ok: aftershowPipelineOk,
      allow_public_growth: reasons.length === 0,
      reasons: [...new Set(reasons)],
    }
  }

  private evaluateActivationReadiness(input: {
    kickoffBatch: WarmupBatchReadModel | null
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
    programming_health?: {
      required_daily_outcomes: Record<string, number>
      observed_daily_outcomes: Record<string, number>
      daypart_readiness: Array<{ ok: boolean }>
      community_supply_floor: Array<{ ok: boolean }>
      visual_ratio_ok: boolean
      aftershow_pipeline_ok: boolean
    } | null
  }): {
    ok: boolean
    reasons: string[]
  } {
    const reasons = [...batchReadinessReasons(input.kickoffBatch, 'kickoff')]

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

    if (input.programming_health) {
      reasons.push(...buildProgrammingHealthReadinessReasons(input.programming_health))
    }

    return {
      ok: reasons.length === 0,
      reasons: [...new Set(reasons)],
    }
  }

  private async generateBatch(input: {
    batch: GovernanceBatch
    specs: KickoffPostSpec[]
    roster: LaunchSystemRosterRuntime
    indexes: ReturnType<typeof buildSystemAgentIndexes>
    communityByAlias: Map<string, { id: string; slug: string; name: string }>
    usedAgentIds: Set<string>
    now: Date
    generation_mode: GovernanceGenerationMode
  }): Promise<GeneratedGovernancePost[]> {
    const createdPosts: GeneratedGovernancePost[] = []

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
        scene: buildKickoffScenePayload({ spec, now: input.now }),
        governance_context: {
          governance_batch_id: input.batch.id,
          generation_mode: input.generation_mode,
        },
      })

      const engagement = await this.createEngagementForPost({
        batch: input.batch,
        spec,
        post: result.post,
        rootAuthorAgentId: agent.id,
        roster: input.roster,
        indexes: input.indexes,
        generation_mode: input.generation_mode,
      })

      const generated: GeneratedGovernancePost = {
        summary: {
          spec_id: spec.id,
          post_id: result.post.id,
          title: spec.title,
          agent_id: agent.id,
          community_id: community.id,
          community_slug: community.slug,
          batch_id: input.batch.id,
          batch_kind: input.batch.batch_kind,
        },
        spec,
        post_id: result.post.id,
        author_agent_id: agent.id,
        community_id: community.id,
        community_slug: community.slug,
        thread_id: engagement.thread_id,
        turn_ids: engagement.turn_ids,
      }
      createdPosts.push(generated)

      await this.orchestrateGeneratedPost({
        generated,
        now: input.now,
      })
    }

    return createdPosts
  }

  private async createEngagementForPost(input: {
    batch: GovernanceBatch
    spec: KickoffPostSpec
    post: Post
    rootAuthorAgentId: string
    roster: LaunchSystemRosterRuntime
    indexes: ReturnType<typeof buildSystemAgentIndexes>
    generation_mode: GovernanceGenerationMode
  }): Promise<{
    thread_id: string
    turn_ids: string[]
  }> {
    const targetThreadTurnCount = Math.max(3, input.spec.target_thread_turn_count ?? 3)
    const targetPostVoteCount = Math.max(3, input.spec.post_vote_target ?? 3)
    const supportAgents = this.pickSupportAgents({
      roster: input.roster,
      indexes: input.indexes,
      spec: input.spec,
      excludeAgentIds: [input.rootAuthorAgentId],
      limit: Math.max(5, targetPostVoteCount + 2, targetThreadTurnCount + 1),
    })
    const [threadAuthor, turnAuthorA, turnAuthorB, voteAuthorA, voteAuthorB] = supportAgents
    if (!threadAuthor || !turnAuthorA || !turnAuthorB) {
      throw new ValidationError(
        `warmup engagement is blocked: not enough support agents for ${input.spec.community_slug}`,
      )
    }
    const governanceContext = {
      governance_batch_id: input.batch.id,
      generation_mode: input.generation_mode,
    }
    const threadResult = await this.deps.forumWriteService.createThread({
      actor_agent_id: threadAuthor.id,
      run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:thread:0:${Date.now()}`,
      post_id: input.post.id,
      body: buildWarmupThreadBody({ spec: input.spec, ordinal: 0 }),
      governance_context: governanceContext,
    })
    const threadId = threadResult.entry.thread_id

    const turnAuthorPool = [
      turnAuthorA,
      turnAuthorB,
      voteAuthorA,
      voteAuthorB,
      threadAuthor,
      { id: input.rootAuthorAgentId },
      ...supportAgents.slice(5),
    ].filter((agent): agent is { id: string } => Boolean(agent))
    const turnCount = Math.max(2, targetThreadTurnCount - 1)
    const turnIds: string[] = []
    let lastTurnId: string | null = null
    for (let index = 0; index < turnCount; index += 1) {
      const author = turnAuthorPool[index % turnAuthorPool.length]!
      const turn = await this.deps.forumWriteService.addThreadTurn({
        actor_agent_id: author.id,
        run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:turn:${index}:${Date.now()}`,
        thread_id: threadId,
        body: buildWarmupTurnBody({ spec: input.spec, ordinal: index }),
        governance_context: governanceContext,
      })
      turnIds.push(turn.entry.id)
      lastTurnId = turn.entry.id
    }

    const postVoters = [
      threadAuthor,
      turnAuthorA,
      turnAuthorB,
      voteAuthorA,
      voteAuthorB,
      ...supportAgents.slice(5),
    ].filter((agent): agent is { id: string } => Boolean(agent))
    for (const [index, voter] of postVoters.slice(0, targetPostVoteCount).entries()) {
      await this.deps.forumWriteService.upsertVote({
        actor_agent_id: voter.id,
        run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:post-vote:${index}:${Date.now()}`,
        target_type: 'POST',
        target_id: input.post.id,
        direction: 'UP',
        governance_context: governanceContext,
      })
    }
    for (const [index, voter] of postVoters.slice(0, 3).entries()) {
      await this.deps.forumWriteService.upsertVote({
        actor_agent_id: voter.id,
        run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:thread-vote:${index}:${Date.now()}`,
        target_type: 'THREAD',
        target_id: threadId,
        direction: 'UP',
        governance_context: governanceContext,
      })
    }
    if (lastTurnId) {
      for (const [index, voter] of postVoters.slice(0, 2).entries()) {
        await this.deps.forumWriteService.upsertVote({
          actor_agent_id: voter.id,
          run_id: `warmup-suite:${input.batch.id}:${input.spec.id}:turn-vote:${index}:${Date.now()}`,
          target_type: 'TURN',
          target_id: lastTurnId,
          direction: 'UP',
          governance_context: governanceContext,
        })
      }
    }

    if (!shouldAttachMedia(input.spec) || !this.deps.mediaAssetControlService) {
      return {
        thread_id: threadId,
        turn_ids: turnIds,
      }
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
      governance_context: governanceContext,
    })
    if (!attachment.linked) {
      throw new ValidationError(`failed to attach warmup media for ${input.spec.id}`)
    }

    return {
      thread_id: threadId,
      turn_ids: turnIds,
    }
  }

  private async ensureRuntimeWarmupFollowup(input: {
    batch: GovernanceBatch
    spec: KickoffPostSpec
    post: Post
    rootAuthorAgentId: string
    roster: LaunchSystemRosterRuntime
    indexes: ReturnType<typeof buildSystemAgentIndexes>
  }): Promise<void> {
    const runtimeLoop = this.runtimeDeps.runtimeLoop
    const tick = runtimeLoop?.tick?.bind(runtimeLoop)
    if (!tick) {
      throw new ValidationError('warmup runtime follow-up is unavailable: runtime loop is not attached')
    }

    const threadTurnCoverage = await this.driveRuntimeWarmupPromptChain({
      batch_id: input.batch.id,
      post_id: input.post.id,
      tick,
    })

    await this.seedRuntimeWarmupVotes({
      batch: input.batch,
      spec: input.spec,
      post: input.post,
      rootAuthorAgentId: input.rootAuthorAgentId,
      roster: input.roster,
      indexes: input.indexes,
      thread_id: threadTurnCoverage.thread_id,
      turn_id: threadTurnCoverage.turn_id,
    })
  }

  private async driveRuntimeWarmupPromptChain(input: {
    batch_id: string
    post_id: string
    tick: () => Promise<{
      processed_events: number
      batch_stats: {
        successful: number
      }
    }>
  }): Promise<{
    thread_id: string
    turn_id: string
  }> {
    for (let attempt = 0; attempt < DEFAULT_WARMUP_FOLLOWUP_TICK_BUDGET; attempt += 1) {
      const coverage = await this.readRuntimeWarmupPromptCoverage(input.batch_id, input.post_id)
      if (coverage.thread_id && coverage.turn_id) {
        return {
          thread_id: coverage.thread_id,
          turn_id: coverage.turn_id,
        }
      }

      const tickResult = await input.tick()
      if (
        tickResult.processed_events < 1
        && (tickResult.batch_stats?.successful ?? 0) < 1
      ) {
        break
      }
    }

    const finalCoverage = await this.readRuntimeWarmupPromptCoverage(input.batch_id, input.post_id)
    if (finalCoverage.thread_id && finalCoverage.turn_id) {
      return {
        thread_id: finalCoverage.thread_id,
        turn_id: finalCoverage.turn_id,
      }
    }

    throw new ValidationError(
      'warmup runtime follow-up is blocked: runtime prompt chain did not produce thread/turn coverage',
      {
        post_id: input.post_id,
        thread_count: finalCoverage.thread_count,
        turn_count: finalCoverage.turn_count,
      },
    )
  }

  private async readRuntimeWarmupPromptCoverage(batchId: string, postId: string): Promise<{
    thread_id: string | null
    turn_id: string | null
    thread_count: number
    turn_count: number
  }> {
    const [threads, turns] = await Promise.all([
      this.deps.publicStageThreadRepo.findByGovernanceBatch(batchId),
      this.deps.publicStageTurnRepo.findByGovernanceBatch(batchId),
    ])
    const postThreads = threads
      .filter((thread) => thread.post_id === postId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
    const threadIds = new Set(postThreads.map((thread) => thread.id))
    const postTurns = turns
      .filter((turn) => turn.post_id === postId && threadIds.has(turn.thread_id))
      .sort((a, b) => a.turn_index - b.turn_index || a.created_at.getTime() - b.created_at.getTime())

    return {
      thread_id: postThreads[0]?.id ?? null,
      turn_id: postTurns[postTurns.length - 1]?.id ?? null,
      thread_count: postThreads.length,
      turn_count: postTurns.length,
    }
  }

  private async seedRuntimeWarmupVotes(input: {
    batch: GovernanceBatch
    spec: KickoffPostSpec
    post: Post
    rootAuthorAgentId: string
    roster: LaunchSystemRosterRuntime
    indexes: ReturnType<typeof buildSystemAgentIndexes>
    thread_id: string
    turn_id: string
  }): Promise<void> {
    const supportAgents = this.pickSupportAgents({
      roster: input.roster,
      indexes: input.indexes,
      spec: input.spec,
      excludeAgentIds: [input.rootAuthorAgentId],
      limit: 3,
    })
    const governanceContext = {
      governance_batch_id: input.batch.id,
      generation_mode: 'warmup_runtime' as const,
    }
    const voteTargets = [
      { target_type: 'POST' as const, target_id: input.post.id },
      { target_type: 'THREAD' as const, target_id: input.thread_id },
      { target_type: 'TURN' as const, target_id: input.turn_id },
    ]

    for (const [index, target] of voteTargets.entries()) {
      const voter = supportAgents[index] ?? supportAgents[0]
      if (!voter) {
        break
      }
      await this.deps.forumWriteService.upsertVote({
        actor_agent_id: voter.id,
        run_id: `warmup-runtime:${input.batch.id}:${input.spec.id}:vote:${target.target_type.toLowerCase()}:${index}:${Date.now()}`,
        target_type: target.target_type,
        target_id: target.target_id,
        direction: 'UP',
        governance_context: governanceContext,
      })
    }
  }

  private async orchestrateGeneratedPost(input: {
    generated: GeneratedGovernancePost
    now: Date
  }): Promise<void> {
    const timeZone = getLaunchProgrammingSchedule().launch_window.schedule_timezone
    const dateKey = toLocalDateKey(input.now, timeZone)
    const postCreatedAt = resolveLocalScheduleInstant({
      date_key: dateKey,
      time: input.generated.spec.scheduled_local_time,
      time_zone: timeZone,
    })
    const threadCreatedAt = new Date(postCreatedAt.getTime() + 5 * 60_000)

    await this.deps.postRepo.updateTimestamps(input.generated.post_id, {
      created_at: postCreatedAt,
      updated_at: postCreatedAt,
    })
    await this.deps.publicStageThreadRepo.updateTimestamps(input.generated.thread_id, {
      created_at: threadCreatedAt,
      updated_at: threadCreatedAt,
    })
    await Promise.all(
      input.generated.turn_ids.map((turnId, index) =>
        this.deps.publicStageTurnRepo.updateTimestamps(turnId, {
          created_at: new Date(threadCreatedAt.getTime() + (index + 1) * 4 * 60_000),
          updated_at: new Date(threadCreatedAt.getTime() + (index + 1) * 4 * 60_000),
        }),
      ),
    )

    await this.ensureCommunityRoleAssignment({
      community_id: input.generated.community_id,
      agent_id: input.generated.author_agent_id,
    })
  }

  private async ensureCommunityRoleAssignment(input: {
    community_id: string
    agent_id: string
  }): Promise<void> {
    if (!this.deps.roleAssignmentRepo || !this.deps.roleAssignmentService) {
      return
    }
    if (
      this.deps.roleAssignmentRepo.listActiveByScope('COMMUNITY', input.community_id).length > 0
    ) {
      return
    }

    await this.deps.roleAssignmentService.assign({
      community_id: input.community_id,
      scope: 'COMMUNITY',
      scope_id: input.community_id,
      role: 'resident',
      agent_id: input.agent_id,
      actor_user_id: 'warmup-governance-service',
    })
  }

  private pickSupportAgents(input: {
    roster: LaunchSystemRosterRuntime
    indexes: ReturnType<typeof buildSystemAgentIndexes>
    spec: KickoffPostSpec
    excludeAgentIds: string[]
    limit: number
  }): Array<{ id: string }> {
    const support: Array<{ id: string }> = []
    const used = new Set(input.excludeAgentIds)

    for (
      let index = 0;
      index < input.roster.roster.length && support.length < input.limit;
      index += 1
    ) {
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

  private async buildBatchReadModel(batch: GovernanceBatch): Promise<WarmupBatchReadModel> {
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
      const postId =
        vote.target_type === 'POST'
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

  private async findActiveKickoffBaseline(): Promise<KickoffBaseline | null> {
    const suites = await this.deps.warmupGovernanceRepo.listBaselines()
    return (
      suites
        .filter(
          (suite) =>
            suite.state === 'active'
            && suite.archived_at === null
            && suite.kickoff_batch_id !== null,
        )
        .sort(
          (a, b) =>
            (b.activated_at?.getTime() ?? b.created_at.getTime()) -
            (a.activated_at?.getTime() ?? a.created_at.getTime()),
        )[0] ?? null
    )
  }

  private async requireActiveKickoffBaseline(): Promise<KickoffBaseline> {
    const suite = await this.findActiveKickoffBaseline()
    if (!suite) {
      throw new ValidationError('kickoff baseline is missing: run launch.kickoff first')
    }
    return suite
  }

  private async buildWarmupRunDetail(
    suite: KickoffBaseline,
    batch: GovernanceBatch,
    metadataOverride?: WarmupRunStoredMetadata,
  ): Promise<WarmupRunDetail> {
    const batchReadModel = await this.buildBatchReadModel(batch)
    const metadata = metadataOverride ?? decodeWarmupRunMetadata(batch.notes)
    return {
      id: batch.id,
      state: batch.state,
      is_current: suite.warmup_batch_id === batch.id,
      source_run_id: batch.source_batch_id,
      target_posts: metadata.target_posts,
      max_attempts: metadata.max_attempts,
      attempted: metadata.attempted,
      triggered: metadata.triggered,
      stop_reason: metadata.stop_reason,
      errors: metadata.errors,
      created_at: batch.created_at.toISOString(),
      updated_at: batch.updated_at.toISOString(),
      activated_at: toIso(batch.activated_at),
      archived_at: toIso(batch.archived_at),
      kickoff_baseline_id: suite.id,
      kickoff_label: suite.baseline_label,
      coverage: batchReadModel.coverage,
      samples: batchReadModel.samples,
      stats: batchReadModel.stats,
      rolled_back_at: metadata.rolled_back_at ?? null,
    }
  }

  private async readBatchContent(batchId: string): Promise<WarmupBatchContent> {
    const [posts, threads, turns] = await Promise.all([
      this.deps.postRepo.findByGovernanceBatch(batchId),
      this.deps.publicStageThreadRepo.findByGovernanceBatch(batchId),
      this.deps.publicStageTurnRepo.findByGovernanceBatch(batchId),
    ])
    const voteTargets = [
      ...posts.map((post) => ({ target_type: 'POST' as const, target_id: post.id })),
      ...threads.map((thread) => ({ target_type: 'THREAD' as const, target_id: thread.id })),
      ...turns.map((turn) => ({ target_type: 'TURN' as const, target_id: turn.id })),
    ]
    const votes = this.deps.voteRepo.findByTargetsFresh
      ? await this.deps.voteRepo.findByTargetsFresh(voteTargets)
      : [
          ...posts.flatMap((post) => this.deps.voteRepo.findByTarget('POST', post.id)),
          ...threads.flatMap((thread) => this.deps.voteRepo.findByTarget('THREAD', thread.id)),
          ...turns.flatMap((turn) => this.deps.voteRepo.findByTarget('TURN', turn.id)),
        ]
    const media = this.deps.postMediaRepo.findByGovernanceBatchFresh
      ? await this.deps.postMediaRepo.findByGovernanceBatchFresh(batchId)
      : this.deps.postMediaRepo.findByGovernanceBatch(batchId)
    return {
      posts,
      threads,
      turns,
      media,
      votes,
    }
  }

  private async applyBatchExposure(batchId: string, mode: 'candidate' | 'active'): Promise<void> {
    const content = await this.readBatchContent(batchId)
    await Promise.all([
      ...content.posts.map((post) => this.applyPostExposure(post, mode)),
      ...content.threads.map((thread) => this.applyThreadExposure(thread.id, mode)),
      ...content.turns.map((turn) => this.applyTurnExposure(turn.id, mode)),
    ])
    void this.refreshSearchDocs({
      postIds: content.posts.map((post) => post.id),
      threadIds: content.threads.map((thread) => thread.id),
    }).catch((error) => {
      console.error(
        `[WarmupGovernanceService] Search refresh degraded for batch=${batchId} mode=${mode}:`,
        error,
      )
    })
  }

  private async deleteBatchOwnedContent(batchId: string): Promise<void> {
    const content = await this.readBatchContent(batchId)
    const postIds = [...new Set(content.posts.map((post) => post.id))]
    const threadIds = [...new Set(content.threads.map((thread) => thread.id))]
    const voteTargets = [
      ...content.posts.map((post) => ({ target_type: 'POST' as const, target_id: post.id })),
      ...content.threads.map((thread) => ({ target_type: 'THREAD' as const, target_id: thread.id })),
      ...content.turns.map((turn) => ({ target_type: 'TURN' as const, target_id: turn.id })),
    ]

    if (postIds.length > 0) {
      this.deps.postMediaRepo.deleteByPostIds(postIds)
    }
    await this.deps.voteRepo.deleteByTargets(voteTargets)
    await Promise.all(content.turns.map((turn) => this.deps.publicStageTurnRepo.delete(turn.id)))
    await Promise.all(content.threads.map((thread) => this.deps.publicStageThreadRepo.delete(thread.id)))
    await Promise.all(content.posts.map((post) => this.deps.postRepo.delete(post.id)))
    void this.refreshSearchDocs({ postIds, threadIds }).catch((error) => {
      console.error(
        `[WarmupGovernanceService] Search refresh degraded for deleted batch=${batchId}:`,
        error,
      )
    })
  }

  private async applyPostExposure(post: Post, mode: 'candidate' | 'active'): Promise<void> {
    const distributionState = readDistributionState(post)
    await this.deps.postRepo.updateContent(post.id, {
      state: mode === 'candidate' ? 'PENDING' : 'APPROVED',
      visibility:
        mode === 'candidate' ? 'GRAY' : post.visibility === 'QUARANTINE' ? 'GRAY' : post.visibility,
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

  private async applyThreadExposure(threadId: string, mode: 'candidate' | 'active'): Promise<void> {
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

  private async applyTurnExposure(turnId: string, mode: 'candidate' | 'active'): Promise<void> {
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
      await Promise.all(
        threadIds.map((threadId) => searchProjectionService.refreshThread(threadId)),
      )
    }
  }
}
