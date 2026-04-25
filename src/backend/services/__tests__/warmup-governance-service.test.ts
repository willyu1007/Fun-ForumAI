import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLaunchSystemConfigSlice, getLaunchSystemRoster } from '../../launch/system-roster.js'
import { listLaunchCommunitySeeds } from '../../launch/community-rules.js'
import {
  InMemoryAgentConfigRepository,
  InMemoryAgentRepository,
} from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { InMemoryWarmupGovernanceRepository } from '../../repos/warmup-governance-repository.js'
import type { GovernanceGenerationMode } from '../../repos/types/warmup-governance.js'
import type { ReconcileMembershipsResult } from '../agent-community-membership-service.js'
import type { LaunchProgrammingOpsPayload } from '../launch-programming-ops-service.js'
import type { PostSchedulerResult } from '../../runtime/post-scheduler.js'
import { WarmupGovernanceService } from '../warmup-governance-service.js'

const ORIGINAL_CWD = process.cwd()
const TEST_TMP_ROOT = resolve(ORIGINAL_CWD, '.ai/.tmp/tests/warmup-governance')
const KEEP_TEST_ARTIFACTS = process.env.KEEP_TEST_ARTIFACTS === '1'

function createTempRepoRoot(prefix: string): string {
  mkdirSync(TEST_TMP_ROOT, { recursive: true })
  return mkdtempSync(join(TEST_TMP_ROOT, `${prefix}-`))
}

type MockWarmupWriteContext = {
  governance_batch_id?: string | null
  generation_mode?: GovernanceGenerationMode | null
}

type MockCreatePostInput = {
  community_id: string
  actor_agent_id: string
  title: string
  body: string
  tags?: string[]
  governance_context?: MockWarmupWriteContext
}

type MockCreateThreadInput = {
  post_id: string
  actor_agent_id: string
  body: string
  governance_context?: MockWarmupWriteContext
}

type MockAddThreadTurnInput = {
  thread_id: string
  actor_agent_id: string
  body: string
  governance_context?: MockWarmupWriteContext
}

type MockUpsertVoteInput = {
  actor_agent_id: string
  target_type: 'POST' | 'THREAD' | 'TURN'
  target_id: string
  direction: 'UP' | 'DOWN'
}

type MockAttachPostMediaInput = {
  post_id: string
  asset_id: string
  governance_context?: MockWarmupWriteContext
}

function makeHealthyProgrammingPayload(): LaunchProgrammingOpsPayload {
  return {
    enabled: true,
    timezone: 'Asia/Shanghai',
    active_daypart_id: null,
    dayparts: [],
    slots: [],
    health: {
      required_daily_outcomes: {},
      observed_daily_outcomes: {},
      daypart_readiness: [],
      community_supply_floor: [],
      visual_ratio_ok: true,
      aftershow_pipeline_ok: true,
      warning_count: 0,
      warnings: [],
    },
    observations: {
      visual_ratio: {
        root_cover_ratio: null,
        note_cover_ratio: null,
        highlight_visual_ratio: null,
        reject_reason_counts: {},
        budget_remaining_cny: null,
        cost_gate_active: false,
      },
      highlight_candidates: [],
      aftershow: [],
    },
    governance_references: {
      communities: [],
      incubation: [],
    },
    rollback_order: [],
    drill_checklist: [],
    meta: {
      generated_at: '2026-04-18T10:00:00.000Z',
      source: 'launch-programming-ops-v1',
    },
  }
}

function createHarness() {
  const warmupGovernanceRepo = new InMemoryWarmupGovernanceRepository()
  const postRepo = new InMemoryPostRepository()
  const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
  const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
  const postMediaRepo = new InMemoryPostMediaRepository()
  const voteRepo = new InMemoryVoteRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const agentRepo = new InMemoryAgentRepository()
  const agentConfigRepo = new InMemoryAgentConfigRepository()
  const refreshPost = vi.fn(async () => {})
  const refreshThread = vi.fn(async () => {})
  const aftershowTrigger = vi.fn(async () => ({ artifact: null }))
  const programmingOpsPayload = makeHealthyProgrammingPayload()
  const roster = getLaunchSystemRoster()
  const launchCommunities = listLaunchCommunitySeeds()
  const primaryCommunity = launchCommunities[0]
  if (!primaryCommunity) {
    throw new Error('expected launch community seed')
  }

  for (const community of launchCommunities) {
    communityRepo.create({
      name: community.name,
      slug: community.slug,
      rules_json: community.rules_json,
    })
  }

  for (const entry of roster.roster) {
    const agent = agentRepo.create({
      owner_id: roster.owner_model.owner_id,
      display_name: entry.display_name,
    })
    agentConfigRepo.create({
      agent_id: agent.id,
      config_json: buildLaunchSystemConfigSlice(entry),
      updated_by: 'warmup-governance-service.test',
    })
  }

  let assetCounter = 0
  const service = new WarmupGovernanceService({
    warmupGovernanceRepo,
    postRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    postMediaRepo,
    voteRepo,
    communityRepo,
    agentRepo,
    agentConfigRepo,
    membershipService: {
      reconcileMemberships: async (): Promise<ReconcileMembershipsResult> => ({
        agent_id: 'warmup-governance-service.test',
        active_memberships: [],
        updated: {
          added: [],
          removed: [],
          role_changed: [],
          blocked: [],
          source: 'DERIVED',
        },
      }),
      listActive: () => [],
    },
    forumWriteService: {
      createPost: vi.fn(async (input: MockCreatePostInput) => {
        const post = await postRepo.create({
          community_id: input.community_id,
          author_agent_id: input.actor_agent_id,
          title: input.title,
          body: input.body,
          tags: input.tags ?? [],
          visibility: 'GRAY',
          state: 'PENDING',
          moderation_metadata: {
            distribution_state: 'NO_RECOMMEND',
          },
          governance_batch_id: input.governance_context?.governance_batch_id ?? null,
          generation_mode: input.governance_context?.generation_mode ?? null,
        })
        return { post, moderation: null, event: null, agentRun: null }
      }),
      createThread: vi.fn(async (input: MockCreateThreadInput) => {
        const post = await postRepo.findById(input.post_id)
        if (!post) throw new Error(`missing post ${input.post_id}`)
        const entry = await publicStageThreadRepo.create({
          post_id: input.post_id,
          community_id: post.community_id,
          author_agent_id: input.actor_agent_id,
          body: input.body,
          visibility: 'GRAY',
          state: 'PENDING',
          governance_batch_id: input.governance_context?.governance_batch_id ?? null,
          generation_mode: input.governance_context?.generation_mode ?? null,
        })
        return { entry: { ...entry, thread_id: entry.id }, moderation: null, event: null }
      }),
      addThreadTurn: vi.fn(async (input: MockAddThreadTurnInput) => {
        const thread = await publicStageThreadRepo.findById(input.thread_id)
        if (!thread) throw new Error(`missing thread ${input.thread_id}`)
        const turns = await publicStageTurnRepo.findByThread(input.thread_id, {
          limit: 100,
          cursor: undefined,
        })
        const entry = await publicStageTurnRepo.create({
          thread_id: input.thread_id,
          post_id: thread.post_id,
          author_agent_id: input.actor_agent_id,
          turn_index: turns.items.length,
          body: input.body,
          visibility: 'GRAY',
          state: 'PENDING',
          governance_batch_id: input.governance_context?.governance_batch_id ?? null,
          generation_mode: input.governance_context?.generation_mode ?? null,
        })
        return { entry, moderation: null, event: null }
      }),
      upsertVote: vi.fn(async (input: MockUpsertVoteInput) => {
        const targetAuthorAgentId =
          input.target_type === 'POST'
            ? (await postRepo.findById(input.target_id))?.author_agent_id ?? null
            : input.target_type === 'THREAD'
              ? (await publicStageThreadRepo.findById(input.target_id))?.author_agent_id ?? null
              : (await publicStageTurnRepo.findById(input.target_id))?.author_agent_id ?? null
        if (!targetAuthorAgentId) {
          throw new Error(`missing vote target ${input.target_type}:${input.target_id}`)
        }
        if (targetAuthorAgentId === input.actor_agent_id) {
          throw new Error('Self-vote is not allowed')
        }
        const vote = voteRepo.upsert({
          voter_agent_id: input.actor_agent_id,
          target_type: input.target_type,
          target_id: input.target_id,
          direction: input.direction,
        })
        return { vote, event: null }
      }),
    } as never,
    launchProgrammingOpsService: {
      getAdminPayload: vi.fn(async () => programmingOpsPayload),
    },
    mediaAssetControlService: {
      createFromUpload: vi.fn(async () => ({
        asset_id: `asset-${++assetCounter}`,
        visibility_policy: 'private',
        lifecycle_status: 'READY',
        media_url: `https://example.com/asset-${assetCounter}.webp`,
        mime_type: 'image/webp',
        created_by_type: 'agent',
        created_by_id: 'warmup-governance-service.test',
        owner_user_id: 'warmup-governance-service.test',
        latest_post_id: null,
        latest_public_attachment_at: null,
        owner_note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      promoteAsset: vi.fn(async (input: { asset_id: string }) => ({
        asset_id: input.asset_id,
        visibility_policy: 'public',
        lifecycle_status: 'READY',
        media_url: `https://example.com/${input.asset_id}.webp`,
        mime_type: 'image/webp',
        created_by_type: 'agent',
        created_by_id: 'warmup-governance-service.test',
        owner_user_id: 'warmup-governance-service.test',
        latest_post_id: null,
        latest_public_attachment_at: null,
        owner_note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      attachPostMediaAndConsume: vi.fn(async (input: MockAttachPostMediaInput) => {
        postMediaRepo.create({
          post_id: input.post_id,
          asset_id: input.asset_id,
          media_url: `https://example.com/${input.asset_id}.webp`,
          mime_type: 'image/webp',
          governance_batch_id: input.governance_context?.governance_batch_id ?? null,
          generation_mode: input.governance_context?.generation_mode ?? null,
        })
        return { linked: true }
      }),
    } as never,
    aftershowService: {
      trigger: aftershowTrigger,
      getLatestByPost: vi.fn(async () => ({ artifact: null, callouts: [] })),
    } as never,
    runtimeLoop: {
      isRunning: true,
    },
    searchProjectionService: {
      refreshPost,
      refreshThread,
    },
  })

  return {
    service,
    programmingOpsPayload,
    roster,
    primaryCommunitySlug: primaryCommunity.slug,
    repos: {
      warmupGovernanceRepo,
      postRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      postMediaRepo,
      voteRepo,
      communityRepo,
      agentRepo,
    },
    mocks: {
      refreshPost,
      refreshThread,
      aftershowTrigger,
    },
  }
}

function writeKickoffBundle(rootDir: string, communitySlug: string): string {
  const kickoffDir = resolve(rootDir, '.ai/.tmp/kickoff')
  const assetDir = resolve(kickoffDir, 'assets')
  mkdirSync(assetDir, { recursive: true })
  copyFileSync(
    resolve(ORIGINAL_CWD, 'public/community-banners/sea-glow.webp'),
    resolve(assetDir, 'sea-glow.webp'),
  )
  const manifestPath = resolve(kickoffDir, 'manifest.v1.yaml')
  writeFileSync(
    manifestPath,
    [
      'version: 1',
      'bundle_id: test-kickoff-bundle-v1',
      'baseline_label: kickoff-baseline-test',
      'posts:',
      '  - id: kickoff-root-1',
      `    community_slug: ${communitySlug}`,
      '    programming_daypart: evening_prime',
      '    scheduled_local_time: "19:20"',
      '    phase: opening',
      '    title: Kickoff Root',
      '    body: Kickoff body',
      '    tags:',
      '      - launch.kickoff',
      '      - daypart:evening_prime',
      '      - content-kind:mainline_root',
      '    storyline:',
      '      id: kickoff-story-1',
      '      title: Kickoff Story',
      '      hook: Start the storyline now.',
      '      state: opening',
      '    editorial_shelf_id: conflict_rising',
      '    content_kind: mainline_root',
      '    target_thread_turn_count: 3',
      '    post_vote_target: 3',
      '    attach_media: true',
      '    visual_asset_path: ./assets/sea-glow.webp',
      '',
    ].join('\n'),
    'utf8',
  )
  return manifestPath
}

async function appendRuntimeWarmupPost(
  ctx: ReturnType<typeof createHarness>,
  batchId: string,
  ordinal: number,
) {
  const community = ctx.repos.communityRepo.findBySlug(ctx.primaryCommunitySlug)
  const agent = ctx.repos.agentRepo.findByOwner(ctx.roster.owner_model.owner_id)[ordinal % 4]
  if (!community || !agent) {
    throw new Error('expected seeded community and agents')
  }

  const post = await ctx.repos.postRepo.create({
    community_id: community.id,
    author_agent_id: agent.id,
    title: `Warmup runtime ${ordinal}`,
    body: `Runtime body ${ordinal}`,
    tags: ['warmup.runtime'],
    visibility: 'GRAY',
    state: 'PENDING',
    moderation_metadata: {
      distribution_state: 'NO_RECOMMEND',
    },
    governance_batch_id: batchId,
    generation_mode: 'warmup_runtime',
  })
  ctx.repos.postMediaRepo.create({
    post_id: post.id,
    asset_id: `runtime-asset-${ordinal}`,
    media_url: `https://example.com/runtime-${ordinal}.webp`,
    mime_type: 'image/webp',
    governance_batch_id: batchId,
    generation_mode: 'warmup_runtime',
  })
  return { post, agent, community }
}

async function appendRuntimeWarmupPromptCoverage(
  ctx: ReturnType<typeof createHarness>,
  batchId: string,
) {
  const posts = await ctx.repos.postRepo.findByGovernanceBatch(batchId)
  const post = posts[posts.length - 1]
  if (!post) {
    throw new Error(`expected warmup post for batch ${batchId}`)
  }

  const existingThreads = await ctx.repos.publicStageThreadRepo.findByGovernanceBatch(batchId)
  if (existingThreads.some((thread) => thread.post_id === post.id)) {
    return
  }

  const agents = ctx.repos.agentRepo.findByOwner(ctx.roster.owner_model.owner_id)
  const threadAuthor = agents[1]
  const turnAuthor = agents[2]
  if (!threadAuthor || !turnAuthor) {
    throw new Error('expected support agents for runtime prompt coverage')
  }

  const thread = await ctx.repos.publicStageThreadRepo.create({
    post_id: post.id,
    community_id: post.community_id,
    author_agent_id: threadAuthor.id,
    body: 'Runtime-generated thread',
    visibility: 'GRAY',
    state: 'PENDING',
    governance_batch_id: batchId,
    generation_mode: 'warmup_runtime',
  })
  await ctx.repos.publicStageTurnRepo.create({
    thread_id: thread.id,
    post_id: post.id,
    author_agent_id: turnAuthor.id,
    turn_index: 1,
    body: 'Runtime-generated turn',
    visibility: 'GRAY',
    state: 'PENDING',
    governance_batch_id: batchId,
    generation_mode: 'warmup_runtime',
  })
}

async function waitForWarmupRunToSettle(
  service: WarmupGovernanceService,
  runId: string,
): Promise<Awaited<ReturnType<WarmupGovernanceService['getWarmupRun']>>> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const run = await service.getWarmupRun(runId)
    if (run.state !== 'generating') {
      return run
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`warmup run ${runId} did not settle in time`)
}

async function waitForStoredWarmupBatchToSettle(
  repo: ReturnType<typeof createHarness>['repos']['warmupGovernanceRepo'],
  runId: string,
) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const run = await repo.findBatchById(runId)
    if (!run) {
      throw new Error(`expected warmup batch ${runId}`)
    }
    if (run.state !== 'generating') {
      return run
    }
    await Promise.resolve()
  }
  throw new Error(`warmup batch ${runId} did not settle in time`)
}

describe('WarmupGovernanceService', () => {
  const tempRoots: string[] = []

  beforeEach(() => {
    vi.useRealTimers()
    tempRoots.length = 0
  })

  afterEach(() => {
    process.chdir(ORIGINAL_CWD)
    if (!KEEP_TEST_ARTIFACTS) {
      for (const tempRoot of tempRoots) {
        rmSync(tempRoot, { recursive: true, force: true })
      }
    }
  })

  it('imports kickoff baseline from .ai/.tmp and preserves kickoff lineage', async () => {
    const tempRoot = createTempRepoRoot('kickoff-import')
    tempRoots.push(tempRoot)
    process.chdir(tempRoot)
    const ctx = createHarness()
    const manifestPath = writeKickoffBundle(tempRoot, ctx.primaryCommunitySlug)
    const eventQueue = {
      size: vi.fn(async () => 12),
      clear: vi.fn(async () => {}),
    }
    ctx.service.attachRuntimeDeps({
      eventQueue,
    })

    const result = await ctx.service.importKickoffBaseline({
      manifest_path: manifestPath,
      created_by_user_id: 'admin-1',
      now: new Date('2026-04-18T10:00:00.000Z'),
    })

    expect(result.created_posts).toHaveLength(1)
    expect(result.verification.ok).toBe(true)
    expect(result.verification.active_baseline.allow_public_growth).toBe(false)
    expect(result.verification.active_baseline.reasons).toContain('warmup_layer_not_ready')

    const kickoff = await ctx.service.getKickoffStatus()
    if (!kickoff) {
      throw new Error('expected kickoff status baseline')
    }
    expect(kickoff?.baseline_label).toBe('kickoff-baseline-test')
    expect(kickoff?.verification.ok).toBe(true)
    expect(kickoff?.current_warmup_run).toBeNull()

    const kickoffPosts = await ctx.repos.postRepo.findByGovernanceBatch(result.kickoff_batch_id)
    const kickoffThreads = await ctx.repos.publicStageThreadRepo.findByGovernanceBatch(
      result.kickoff_batch_id,
    )
    const kickoffTurns = await ctx.repos.publicStageTurnRepo.findByGovernanceBatch(
      result.kickoff_batch_id,
    )
    const kickoffMedia = ctx.repos.postMediaRepo.findByGovernanceBatch(result.kickoff_batch_id)

    expect(kickoffPosts).toHaveLength(1)
    expect(kickoffThreads).toHaveLength(1)
    expect(kickoffTurns).toHaveLength(2)
    expect(kickoffMedia).toHaveLength(1)
    expect(kickoffPosts[0]?.generation_mode).toBe('kickoff_import')
    expect(kickoffThreads[0]?.generation_mode).toBe('kickoff_import')
    expect(kickoffTurns[0]?.generation_mode).toBe('kickoff_import')
    expect(kickoffMedia[0]?.generation_mode).toBe('kickoff_import')
    expect(kickoffPosts[0]?.state).toBe('APPROVED')
    expect(kickoffPosts[0]?.moderation_metadata?.distribution_state).toBe('NORMAL')
    expect(ctx.mocks.aftershowTrigger).not.toHaveBeenCalled()

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    expect(formatter.format(kickoffPosts[0]!.created_at)).toBe('18/04/2026, 19:20')
    expect(eventQueue.clear).toHaveBeenCalledTimes(1)
  })

  it('creates runtime-only warmup runs and rolls back to the previous active run', async () => {
    const tempRoot = createTempRepoRoot('warmup-runtime')
    tempRoots.push(tempRoot)
    process.chdir(tempRoot)
    const ctx = createHarness()
    const manifestPath = writeKickoffBundle(tempRoot, ctx.primaryCommunitySlug)

    const imported = await ctx.service.importKickoffBaseline({
      manifest_path: manifestPath,
      now: new Date('2026-04-18T10:00:00.000Z'),
    })

    let runtimeOrdinal = 0
    let currentBatchId: string | null = null
    const eventQueue = {
      size: vi.fn()
        .mockResolvedValueOnce(12)
        .mockResolvedValue(0),
      clear: vi.fn(async () => {}),
    }
    ctx.service.attachRuntimeDeps({
      postScheduler: {
        forcePost: vi.fn(async (input?: { governance_context?: { governance_batch_id: string } }) => {
          runtimeOrdinal += 1
          const batchId = input?.governance_context?.governance_batch_id
          if (!batchId) {
            throw new Error('warmup batch id is required')
          }
          currentBatchId = batchId
          const created = await appendRuntimeWarmupPost(ctx, batchId, runtimeOrdinal)
          return {
            triggered: true,
            post_id: created.post.id,
            agent_id: created.agent.id,
            community_id: created.community.id,
          }
        }),
        createPost: vi.fn(async () => ({ triggered: false })),
      },
      runtimeLoop: {
        isRunning: true,
        tick: vi.fn(async () => {
          if (currentBatchId) {
            await appendRuntimeWarmupPromptCoverage(ctx, currentBatchId)
          }
          return {
            processed_events: 1,
            batch_stats: {
              successful: 1,
            },
          }
        }),
      },
      eventQueue,
    })

    const firstRun = await ctx.service.startWarmupRun({
      actor_user_id: 'admin-1',
      target_posts: 1,
      max_attempts: 1,
    })
    const settledFirstRun = await waitForWarmupRunToSettle(ctx.service, firstRun.id)
    expect(settledFirstRun.state).toBe('active')
    expect(settledFirstRun.stop_reason).toBe('target_reached')
    expect(settledFirstRun.triggered).toBe(1)
    expect(settledFirstRun.stats.posts).toBe(1)
    expect(settledFirstRun.stats.threads).toBeGreaterThanOrEqual(1)
    expect(settledFirstRun.stats.turns).toBeGreaterThanOrEqual(1)
    expect(settledFirstRun.stats.votes).toBeGreaterThanOrEqual(1)

    const secondRun = await ctx.service.startWarmupRun({
      actor_user_id: 'admin-1',
      target_posts: 1,
      max_attempts: 1,
    })
    const settledSecondRun = await waitForWarmupRunToSettle(ctx.service, secondRun.id)
    expect(settledSecondRun.state).toBe('active')
    expect(settledSecondRun.source_run_id).toBe(firstRun.id)
    const secondRunPostsBeforeRollback = await ctx.repos.postRepo.findByGovernanceBatch(secondRun.id)
    const secondRunThreadsBeforeRollback = await ctx.repos.publicStageThreadRepo.findByGovernanceBatch(
      secondRun.id,
    )
    const secondRunTurnsBeforeRollback = await ctx.repos.publicStageTurnRepo.findByGovernanceBatch(
      secondRun.id,
    )
    const secondRunVotesBeforeRollback = await ctx.repos.voteRepo.findByTargetsFresh([
      ...secondRunPostsBeforeRollback.map((post) => ({ target_type: 'POST' as const, target_id: post.id })),
      ...secondRunThreadsBeforeRollback.map((thread) => ({
        target_type: 'THREAD' as const,
        target_id: thread.id,
      })),
      ...secondRunTurnsBeforeRollback.map((turn) => ({ target_type: 'TURN' as const, target_id: turn.id })),
    ])

    const archivedFirstRun = await ctx.service.getWarmupRun(firstRun.id)
    expect(archivedFirstRun.state).toBe('archived')
    expect(archivedFirstRun.is_current).toBe(false)

    const rolledBack = await ctx.service.rollbackWarmupRun({
      run_id: settledSecondRun.id,
      actor_user_id: 'admin-1',
    })
    expect(rolledBack.state).toBe('archived')
    expect(rolledBack.stop_reason).toBe('rolled_back')

    const restoredFirstRun = await ctx.service.getWarmupRun(firstRun.id)
    expect(restoredFirstRun.state).toBe('active')
    expect(restoredFirstRun.is_current).toBe(true)
    expect(await ctx.repos.postRepo.findByGovernanceBatch(secondRun.id)).toHaveLength(0)
    expect(await ctx.repos.publicStageThreadRepo.findByGovernanceBatch(secondRun.id)).toHaveLength(0)
    expect(await ctx.repos.publicStageTurnRepo.findByGovernanceBatch(secondRun.id)).toHaveLength(0)
    expect(ctx.repos.postMediaRepo.findByGovernanceBatch(secondRun.id)).toHaveLength(0)
    expect(
      await ctx.repos.voteRepo.findByTargetsFresh([
        ...secondRunPostsBeforeRollback.map((post) => ({
          target_type: 'POST' as const,
          target_id: post.id,
        })),
        ...secondRunThreadsBeforeRollback.map((thread) => ({
          target_type: 'THREAD' as const,
          target_id: thread.id,
        })),
        ...secondRunTurnsBeforeRollback.map((turn) => ({
          target_type: 'TURN' as const,
          target_id: turn.id,
        })),
      ]),
    ).toHaveLength(0)
    expect(secondRunVotesBeforeRollback.length).toBeGreaterThan(0)

    const kickoffPosts = await ctx.repos.postRepo.findByGovernanceBatch(imported.kickoff_batch_id)
    expect(kickoffPosts[0]?.state).toBe('APPROVED')

    const admission = await ctx.service.getRuntimeBaselineAdmission()
    expect(admission.warmup_layer_ready).toBe(true)
    expect(admission.allow_public_growth).toBe(true)
    expect(admission.reasons).toEqual([])
    expect(eventQueue.clear).toHaveBeenCalledTimes(1)
  })

  it('fails warmup runs when max_attempts is exhausted before target_posts is reached', async () => {
    const tempRoot = createTempRepoRoot('warmup-runtime-fail')
    tempRoots.push(tempRoot)
    process.chdir(tempRoot)
    const ctx = createHarness()
    const manifestPath = writeKickoffBundle(tempRoot, ctx.primaryCommunitySlug)

    await ctx.service.importKickoffBaseline({
      manifest_path: manifestPath,
      now: new Date('2026-04-18T10:00:00.000Z'),
    })

    ctx.service.attachRuntimeDeps({
      postScheduler: {
        forcePost: vi.fn(async () => ({
          triggered: false,
          error: 'scheduler returned no-op',
        })),
        createPost: vi.fn(async () => ({ triggered: false })),
      },
      runtimeLoop: {
        isRunning: true,
      },
    })

    const run = await ctx.service.startWarmupRun({
      actor_user_id: 'admin-1',
      target_posts: 2,
      max_attempts: 1,
    })
    const settledRun = await waitForWarmupRunToSettle(ctx.service, run.id)

    expect(settledRun.state).toBe('failed')
    expect(settledRun.stop_reason).toBe('max_attempts_exhausted')
    expect(settledRun.triggered).toBe(0)
    expect(settledRun.errors).toEqual(['scheduler returned no-op'])

    const kickoff = await ctx.service.getKickoffStatus()
    expect(kickoff?.current_warmup_run).toBeNull()

    const admission = await ctx.service.getRuntimeBaselineAdmission()
    expect(admission.allow_public_growth).toBe(false)
    expect(admission.reasons).toContain('warmup_layer_not_ready')
  })

  it('returns a generating run immediately and rejects duplicate starts while it is in progress', async () => {
    const tempRoot = createTempRepoRoot('warmup-runtime-async')
    tempRoots.push(tempRoot)
    process.chdir(tempRoot)
    const ctx = createHarness()
    const manifestPath = writeKickoffBundle(tempRoot, ctx.primaryCommunitySlug)

    await ctx.service.importKickoffBaseline({
      manifest_path: manifestPath,
      now: new Date('2026-04-18T10:00:00.000Z'),
    })

    let releaseRun: (() => void) | null = null
    let currentBatchId: string | null = null
    const runGate = new Promise<void>((resolve) => {
      releaseRun = resolve
    })
    ctx.service.attachRuntimeDeps({
      postScheduler: {
        forcePost: vi.fn(async (input?: { governance_context?: { governance_batch_id: string } }) => {
          await runGate
          const batchId = input?.governance_context?.governance_batch_id
          if (!batchId) {
            throw new Error('warmup batch id is required')
          }
          currentBatchId = batchId
          const created = await appendRuntimeWarmupPost(ctx, batchId, 1)
          return {
            triggered: true,
            post_id: created.post.id,
            agent_id: created.agent.id,
            community_id: created.community.id,
          }
        }),
        createPost: vi.fn(async () => ({ triggered: false })),
      },
      runtimeLoop: {
        isRunning: true,
        tick: vi.fn(async () => {
          if (currentBatchId) {
            await appendRuntimeWarmupPromptCoverage(ctx, currentBatchId)
          }
          return {
            processed_events: 1,
            batch_stats: {
              successful: 1,
            },
          }
        }),
      },
    })

    const run = await ctx.service.startWarmupRun({
      actor_user_id: 'admin-1',
      target_posts: 1,
      max_attempts: 1,
    })
    expect(run.state).toBe('generating')
    expect(run.attempted).toBe(0)
    expect(run.triggered).toBe(0)
    expect(run.stop_reason).toBeNull()

    await expect(
      ctx.service.startWarmupRun({
        actor_user_id: 'admin-1',
        target_posts: 1,
        max_attempts: 1,
      }),
    ).rejects.toMatchObject({
      message: 'warmup run already in progress',
    })

    const releaseCurrentRun = releaseRun as (() => void) | null
    if (releaseCurrentRun) {
      releaseCurrentRun()
    }
    const settledRun = await waitForWarmupRunToSettle(ctx.service, run.id)
    expect(settledRun.state).toBe('active')
    expect(settledRun.triggered).toBe(1)
  })

  it('settles warmup runs when a runtime attempt exceeds the timeout budget', async () => {
    const tempRoot = createTempRepoRoot('warmup-runtime-timeout')
    tempRoots.push(tempRoot)
    process.chdir(tempRoot)
    const ctx = createHarness()
    const manifestPath = writeKickoffBundle(tempRoot, ctx.primaryCommunitySlug)

    await ctx.service.importKickoffBaseline({
      manifest_path: manifestPath,
      now: new Date('2026-04-18T10:00:00.000Z'),
    })

    ctx.service.attachRuntimeDeps({
      postScheduler: {
        forcePost: vi.fn(async () => await new Promise<PostSchedulerResult>(() => {})),
        createPost: vi.fn(async () => ({ triggered: false })),
      },
      runtimeLoop: {
        isRunning: true,
      },
      warmupAttemptTimeoutMs: 10,
    })

    const run = await ctx.service.startWarmupRun({
      actor_user_id: 'admin-1',
      target_posts: 1,
      max_attempts: 1,
    })
    const settledRun = await waitForWarmupRunToSettle(ctx.service, run.id)

    expect(settledRun.state).toBe('failed')
    expect(settledRun.stop_reason).toBe('max_attempts_exhausted')
    expect(settledRun.triggered).toBe(0)
    expect(settledRun.errors).toEqual([
      'warmup runtime attempt timed out after 10ms',
    ])
  })

  it('reclaims stale generating warmup runs during baseline admission checks', async () => {
    vi.useFakeTimers()
    const tempRoot = createTempRepoRoot('warmup-runtime-reclaim')
    tempRoots.push(tempRoot)
    process.chdir(tempRoot)
    const ctx = createHarness()
    const manifestPath = writeKickoffBundle(tempRoot, ctx.primaryCommunitySlug)

    await ctx.service.importKickoffBaseline({
      manifest_path: manifestPath,
      now: new Date('2026-04-18T10:00:00.000Z'),
    })

    ctx.service.attachRuntimeDeps({
      postScheduler: {
        forcePost: vi.fn(async () => ({ triggered: false })),
        createPost: vi.fn(async () => ({ triggered: false })),
      },
      runtimeLoop: {
        isRunning: true,
        tick: vi.fn(async () => ({
          processed_events: 0,
          batch_stats: {
            successful: 0,
          },
        })),
      },
      warmupAttemptTimeoutMs: 10,
    })

    const kickoff = await ctx.service.getKickoffStatus()
    if (!kickoff) {
      throw new Error('expected kickoff status baseline')
    }
    const staleStartedAt = new Date('2026-04-18T11:00:00.000Z')
    vi.setSystemTime(staleStartedAt)
    const staleRun = await ctx.repos.warmupGovernanceRepo.createBatch({
      baseline_id: kickoff.id,
      batch_kind: 'warmup',
      state: 'generating',
      source_batch_id: null,
      revision_key: `warmup:processing:${staleStartedAt.getTime()}:orphaned-processor`,
      package_hash: `warmup:processing:${staleStartedAt.getTime()}:orphaned-processor`,
      notes: JSON.stringify({
        kind: 'warmup_run',
        target_posts: 1,
        max_attempts: 1,
        attempted: 0,
        triggered: 0,
        errors: [],
        stop_reason: null,
        rolled_back_at: null,
      }),
    })

    vi.setSystemTime(new Date(staleStartedAt.getTime() + 61_000))
    const admission = await ctx.service.getRuntimeBaselineAdmission()
    expect(admission.allow_public_growth).toBe(false)

    const settledRun = await waitForStoredWarmupBatchToSettle(
      ctx.repos.warmupGovernanceRepo,
      staleRun.id,
    )
    expect(settledRun.state).toBe('failed')
    expect(settledRun.revision_key).toMatch(/^warmup:failed:/)

    const settledDetail = await ctx.service.getWarmupRun(staleRun.id)
    expect(settledDetail.stop_reason).toBe('max_attempts_exhausted')
    expect(settledDetail.errors).toEqual([])
  })

  it('waits for queued runtime follow-up work to settle before failing the run', async () => {
    const tempRoot = createTempRepoRoot('warmup-runtime-followup-settle')
    tempRoots.push(tempRoot)
    process.chdir(tempRoot)
    const ctx = createHarness()
    const manifestPath = writeKickoffBundle(tempRoot, ctx.primaryCommunitySlug)

    await ctx.service.importKickoffBaseline({
      manifest_path: manifestPath,
      now: new Date('2026-04-18T10:00:00.000Z'),
    })

    let currentBatchId: string | null = null
    let tickAttempts = 0
    let processing = false
    ctx.service.attachRuntimeDeps({
      postScheduler: {
        forcePost: vi.fn(async (input?: { governance_context?: { governance_batch_id: string } }) => {
          const batchId = input?.governance_context?.governance_batch_id
          if (!batchId) {
            throw new Error('warmup batch id is required')
          }
          currentBatchId = batchId
          const created = await appendRuntimeWarmupPost(ctx, batchId, 1)
          return {
            triggered: true,
            post_id: created.post.id,
            agent_id: created.agent.id,
            community_id: created.community.id,
          }
        }),
        createPost: vi.fn(async () => ({ triggered: false })),
      },
      runtimeLoop: {
        isRunning: true,
        get isProcessing() {
          return processing
        },
        tick: vi.fn(async () => {
          tickAttempts += 1
          if (tickAttempts === 1) {
            processing = true
            setTimeout(() => {
              if (currentBatchId) {
                void appendRuntimeWarmupPromptCoverage(ctx, currentBatchId)
              }
              processing = false
            }, 5)
          }
          return {
            processed_events: 0,
            batch_stats: {
              successful: 0,
            },
          }
        }),
      },
      eventQueue: {
        clear: vi.fn(async () => {}),
        size: vi.fn(async () => (tickAttempts < 1 ? 1 : 0)),
      },
      warmupAttemptTimeoutMs: 50,
    })

    const run = await ctx.service.startWarmupRun({
      actor_user_id: 'admin-1',
      target_posts: 1,
      max_attempts: 1,
    })
    const settledRun = await waitForWarmupRunToSettle(ctx.service, run.id)

    expect(settledRun.state).toBe('active')
    expect(settledRun.stop_reason).toBe('target_reached')
    expect(settledRun.triggered).toBe(1)
    expect(await ctx.repos.publicStageThreadRepo.findByGovernanceBatch(run.id)).toHaveLength(1)
    expect(await ctx.repos.publicStageTurnRepo.findByGovernanceBatch(run.id)).toHaveLength(1)
  })

  it('fails warmup runs when runtime follow-up does not produce thread/turn coverage', async () => {
    const tempRoot = createTempRepoRoot('warmup-runtime-followup-fail')
    tempRoots.push(tempRoot)
    process.chdir(tempRoot)
    const ctx = createHarness()
    const manifestPath = writeKickoffBundle(tempRoot, ctx.primaryCommunitySlug)

    await ctx.service.importKickoffBaseline({
      manifest_path: manifestPath,
      now: new Date('2026-04-18T10:00:00.000Z'),
    })

    ctx.service.attachRuntimeDeps({
      postScheduler: {
        forcePost: vi.fn(async (input?: { governance_context?: { governance_batch_id: string } }) => {
          const batchId = input?.governance_context?.governance_batch_id
          if (!batchId) {
            throw new Error('warmup batch id is required')
          }
          const created = await appendRuntimeWarmupPost(ctx, batchId, 1)
          return {
            triggered: true,
            post_id: created.post.id,
            agent_id: created.agent.id,
            community_id: created.community.id,
          }
        }),
        createPost: vi.fn(async () => ({ triggered: false })),
      },
      runtimeLoop: {
        isRunning: true,
        tick: vi.fn(async () => ({
          processed_events: 0,
          batch_stats: {
            successful: 0,
          },
        })),
      },
      eventQueue: {
        clear: vi.fn(async () => {}),
        size: vi.fn(async () => 0),
      },
      warmupAttemptTimeoutMs: 10,
    })

    const run = await ctx.service.startWarmupRun({
      actor_user_id: 'admin-1',
      target_posts: 1,
      max_attempts: 1,
    })
    const settledRun = await waitForWarmupRunToSettle(ctx.service, run.id)

    expect(settledRun.state).toBe('failed')
    expect(settledRun.stop_reason).toBe('failed')
    expect(settledRun.triggered).toBe(1)
    expect(settledRun.errors).toContain(
      'warmup runtime follow-up is blocked: runtime prompt chain did not produce thread/turn coverage',
    )
    expect(await ctx.repos.publicStageThreadRepo.findByGovernanceBatch(run.id)).toHaveLength(0)
    expect(await ctx.repos.publicStageTurnRepo.findByGovernanceBatch(run.id)).toHaveLength(0)
  })
})
