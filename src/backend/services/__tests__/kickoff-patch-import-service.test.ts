import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import { InMemoryWarmupGovernanceRepository } from '../../repos/warmup-governance-repository.js'
import { KickoffPatchImportService } from '../kickoff-patch-import-service.js'
import type { WarmupSuiteListItem } from '../warmup-governance-service.js'

function createPatch() {
  return {
    patch_meta: {
      contract_version: 1,
      patch_id: 'patch-kickoff-import',
      patch_kind: 'local-llm-assisted-candidate',
      generated_by_tool: 'vitest',
      generated_at: '2026-04-13T00:00:00.000Z',
      iteration: 1,
      parent_patch_id: null,
      repair_of_patch_id: null,
    },
    target: {
      mode: 'candidate',
      suite_label: 'kickoff-v1',
      expected_seed_profile: 'launch',
      target_environment: 'local',
      target_batch_scope: 'both',
    },
    source_contract_refs: {
      launch_manifest_path: 'config/launch/manifest.v1.yaml',
      manifest_version: 1,
      community_rules_contract_path: 'config/launch/community_rules.v1.yaml',
      system_roster_contract_path: 'config/launch/system_roster.v1.yaml',
      programming_schedule_contract_path: 'config/launch/launch_programming_schedule.v1.yaml',
      visual_rollout_contract_path: 'config/launch/visual_surface_rollout.v1.yaml',
    },
    preconditions: {
      require_clean_db: true,
      require_launch_seed_ready: true,
      require_no_other_review_ready_suite: true,
      require_roster_memberships_ready: true,
      require_media_backend_available: false,
    },
    operations: [
      {
        op_id: 'create-post',
        action: 'create',
        entity_kind: 'post',
        logical_key: 'post.primary',
        community_selector: {
          slug: 'warmup-arena',
        },
        actor_selector: {
          display_name: 'Kickoff Bot',
        },
        payload: {
          title: 'Kickoff primary post',
          body: 'Primary kickoff body',
          tags: ['kickoff'],
        },
      },
      {
        op_id: 'create-thread',
        action: 'create',
        entity_kind: 'thread',
        logical_key: 'thread.primary',
        depends_on: ['post.primary'],
        actor_selector: {
          display_name: 'Kickoff Bot',
        },
        payload: {
          post_ref_key: 'post.primary',
          body: 'Kickoff reply chain root',
        },
      },
    ],
    quality_expectations: {
      summary_floor: {
        posts: 1,
        threads: 1,
        turns: 0,
        votes: 0,
      },
      coverage_floor: {
        communities: 1,
        media_coverage_ratio: 0,
      },
      media_floor: {
        minimum_media_assets: 0,
      },
      interaction_floor: {
        minimum_threads: 1,
        minimum_turns: 0,
      },
      key_communities_expected: ['warmup-arena'],
      key_shelves_expected: ['must_watch_today'],
      aftershow_pipeline_expected: true,
      allow_public_growth_expected: false,
    },
    notes: ['import service test'],
  } as const
}

describe('KickoffPatchImportService', () => {
  const readiness = {
    contract_version: 1,
    suite_id: 'suite-1',
    suite_label: 'kickoff-v1',
    suite_state: 'review_ready',
    kickoff_batch_id: 'kickoff-batch-1',
    warmup_batch_id: 'warmup-batch-1',
    active_baseline_id: null,
    activation_readiness: {
      ok: true,
      reasons: [],
    },
    layer_readiness: {
      kickoff_layer_ready: true,
      warmup_layer_ready: true,
      key_communities_ready: true,
      key_shelves_ready: true,
      media_access_ok: true,
      aftershow_pipeline_ok: true,
    },
    quality_state: {
      summary: {
        posts: 1,
        threads: 1,
        turns: 0,
        votes: 0,
        media: 0,
        communities: 1,
        media_covered_posts: 0,
        media_coverage_ratio: 0,
      },
      warning_count: 0,
      warnings: [],
    },
    admission: {
      allow_public_growth: false,
      reasons: [],
      has_active_baseline: false,
      active_baseline_id: null,
    },
    generated_at: '2026-04-13T00:00:00.000Z',
  } as const

  const suiteDetail = {
    id: 'suite-1',
    state: 'review_ready',
    suite_label: 'kickoff-v1',
    created_by_user_id: 'admin-1',
    created_at: '2026-04-13T00:00:00.000Z',
    updated_at: '2026-04-13T00:00:00.000Z',
    activated_at: null,
    archived_at: null,
    kickoff_batch_id: 'kickoff-batch-1',
    warmup_batch_id: 'warmup-batch-1',
    latest_review: null,
    active_baseline: null,
    summary: readiness.quality_state.summary,
    activation_readiness: readiness.activation_readiness,
    coverage: [],
    programming_health: {
      required_daily_outcomes: {},
      observed_daily_outcomes: {},
      daypart_readiness: [],
      community_supply_floor: [],
      visual_ratio_ok: true,
      aftershow_pipeline_ok: true,
      warning_count: 0,
      warnings: [],
    },
    kickoff_batch: null,
    warmup_batch: null,
    actions: {
      can_review: true,
      can_retry: true,
      can_rebuild: true,
      can_archive: true,
    },
  } as const

  function createService() {
    const communityRepo = new InMemoryCommunityRepository()
    const agentRepo = new InMemoryAgentRepository()
    const postRepo = new InMemoryPostRepository()
    const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
    const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()
    const warmupGovernanceRepo = new InMemoryWarmupGovernanceRepository()

    const community = communityRepo.create({
      name: 'Warmup Arena',
      slug: 'warmup-arena',
    })
    const agent = agentRepo.create({
      owner_id: 'owner-1',
      display_name: 'Kickoff Bot',
    })

    const createPost = vi.fn(async (input: {
      actor_agent_id: string
      run_id: string
      community_id: string
      title: string
      body: string
      tags?: string[]
      warmup_context: {
        warm_start_batch_id: string
        generation_mode: 'warmup_candidate' | 'warmup_topup_candidate' | 'governance_restore'
      }
    }) => {
      const post = await postRepo.create({
        community_id: input.community_id,
        author_agent_id: input.actor_agent_id,
        title: input.title,
        body: input.body,
        visibility: 'GRAY',
        state: 'PENDING',
        moderation_metadata: {
          distribution_state: 'NO_RECOMMEND',
        },
        warm_start_batch_id: input.warmup_context.warm_start_batch_id,
        generation_mode: input.warmup_context.generation_mode,
      })
      return { post }
    })

    const createThread = vi.fn(async (input: {
      actor_agent_id: string
      run_id: string
      post_id: string
      body: string
      channel?: 'STAGE' | 'ASIDE'
      warmup_context: {
        warm_start_batch_id: string
        generation_mode: 'warmup_candidate' | 'warmup_topup_candidate' | 'governance_restore'
      }
    }) => {
      const post = await postRepo.findById(input.post_id)
      if (!post) {
        throw new Error(`missing post ${input.post_id}`)
      }
      const entry = await publicStageThreadRepo.create({
        post_id: post.id,
        community_id: post.community_id,
        author_agent_id: input.actor_agent_id,
        body: input.body,
        visibility: 'GRAY',
        state: 'PENDING',
        warm_start_batch_id: input.warmup_context.warm_start_batch_id,
        generation_mode: input.warmup_context.generation_mode,
      })
      return { entry } as never
    })

    const service = new KickoffPatchImportService({
      warmupGovernanceService: {
        listSuites: vi.fn(async (): Promise<WarmupSuiteListItem[]> => [{
          id: 'suite-1',
          state: 'review_ready',
          suite_label: 'kickoff-v1',
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
          activated_at: null,
          archived_at: null,
          latest_review: null,
          summary: {
            posts: 0,
            threads: 0,
            turns: 0,
            votes: 0,
            media: 0,
            communities: 0,
            media_coverage_ratio: 0,
          },
          kickoff_batch: null,
          warmup_batch: null,
        }]),
        getSuiteDetail: vi.fn(async () => suiteDetail as never),
        getRuntimeBaselineAdmission: vi.fn(async () => ({
          active_baseline_id: null,
          suite_id: 'suite-1',
          kickoff_batch_id: 'kickoff-batch-1',
          warmup_batch_id: 'warmup-batch-1',
          has_active_baseline: false,
          kickoff_layer_ready: true,
          warmup_layer_ready: true,
          key_communities_ready: true,
          key_shelves_ready: true,
          media_access_ok: true,
          aftershow_pipeline_ok: true,
          last_review_decision_ok: true,
          worker_health_ok: true,
          llm_credentials_ok: true,
          allow_public_growth: false,
          reasons: [],
        })),
      },
      warmupGovernanceRepo,
      communityRepo,
      agentRepo,
      postRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      postMediaRepo,
      forumWriteService: {
        createPost: createPost as never,
        createThread: createThread as never,
        addThreadTurn: vi.fn() as never,
        upsertVote: vi.fn() as never,
      },
      mediaAssetControlService: {
        createFromUpload: vi.fn(),
        promoteAsset: vi.fn(),
        attachPostMediaAndConsume: vi.fn(),
      },
      searchProjectionService: {
        refreshPost: vi.fn(async () => {}),
        refreshThread: vi.fn(async () => {}),
      },
      runtimeReadinessService: {
        buildForSuite: vi.fn(async () => readiness as never),
      } as never,
      runArtifactService: {
        createRun: vi.fn(async () => ({
          run_id: 'run-1',
          artifact_dir: '/tmp/run-1',
        })),
        writeContextPack: vi.fn(async () => '/tmp/run-1/context-pack.json'),
        writePatch: vi.fn(async () => '/tmp/run-1/generated-patch.yaml'),
        writeRepairPatch: vi.fn(async () => '/tmp/run-1/repair-patch.yaml'),
        writeImportReport: vi.fn(async () => '/tmp/run-1/import-report.json'),
        writeReadiness: vi.fn(async () => '/tmp/run-1/readiness-snapshot.json'),
        writeDiffSummary: vi.fn(async () => '/tmp/run-1/diff-summary.md'),
        writeFailureLog: vi.fn(async () => '/tmp/run-1/failure-log.json'),
        completeRun: vi.fn(async () => ({})),
        recordDataMode: vi.fn(async () => {}),
      } as never,
    })

    return {
      service,
      repos: {
        communityRepo,
        agentRepo,
        postRepo,
        publicStageThreadRepo,
      },
      seed: {
        community,
        agent,
      },
      mocks: {
        createPost,
        createThread,
      },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('supports dry-run imports without losing logical-key resolution for dependent operations', async () => {
    const ctx = createService()

    const report = await ctx.service.importPatch({
      dry_run: true,
      patch: createPatch() as never,
      profile_id: 'local-llm-assisted-candidate',
    })

    expect(report.op_results).toEqual([
      expect.objectContaining({
        op_id: 'create-post',
        status: 'skipped',
        created_id: 'dry-run:post:post.primary',
      }),
      expect.objectContaining({
        op_id: 'create-thread',
        status: 'skipped',
        created_id: 'dry-run:thread:thread.primary',
      }),
    ])
    expect(ctx.mocks.createPost).not.toHaveBeenCalled()
    expect((await ctx.repos.postRepo.findByWarmStartBatch('kickoff-batch-1'))).toHaveLength(0)
  })

  it('imports candidate content through real forum services and returns an import report', async () => {
    const ctx = createService()

    const report = await ctx.service.importPatch({
      dry_run: false,
      patch: createPatch() as never,
      profile_id: 'local-llm-assisted-candidate',
    })

    expect(ctx.mocks.createPost).toHaveBeenCalledTimes(1)
    expect(ctx.mocks.createThread).toHaveBeenCalledTimes(1)
    const posts = await ctx.repos.postRepo.findByWarmStartBatch('kickoff-batch-1')
    expect(posts).toHaveLength(1)
    const threads = await ctx.repos.publicStageThreadRepo.findByPostAll(posts[0]!.id, { limit: 20 })
    expect(threads.items).toHaveLength(1)
    expect(report.resolution_map).toEqual(expect.arrayContaining([
      expect.objectContaining({
        logical_key: 'post.primary',
        entity_kind: 'post',
      }),
      expect.objectContaining({
        logical_key: 'thread.primary',
        entity_kind: 'thread',
      }),
    ]))
    expect(report.summary_after_import.posts).toBe(1)
    expect(report.readiness_snapshot.activation_readiness.ok).toBe(true)
  })

  it('imports runtime-simulated instructions without requiring provider configuration', async () => {
    const ctx = createService()
    const basePatch = createPatch()
    const patch = {
      ...basePatch,
      patch_meta: {
        ...basePatch.patch_meta,
        patch_kind: 'local-llm-assisted-runtime-simulation',
      },
      target: {
        ...basePatch.target,
        mode: 'active',
      },
      operations: [
      {
        op_id: 'runtime-topup',
        action: 'runtime_instruction',
        entity_kind: 'runtime_instruction',
        logical_key: 'runtime.topup',
        target_batch_kind: 'warmup',
        generation_mode: 'warmup_topup_candidate',
        payload: {
          community_selector: {
            slug: 'warmup-arena',
          },
          actor_selector: {
            display_name: 'Kickoff Bot',
          },
          title: 'Runtime simulated top-up',
          body: 'Top-up content generated via local assistant.',
          tags: ['runtime-sim'],
          director_goal: 'Raise the temperature for the next visible exchange',
          scene_hint: 'aftershow-prep',
          placement_goal: 'notes_today',
          topup_reason: 'fill local runtime simulation gap',
        },
      },
      ],
    }

    const report = await ctx.service.importPatch({
      dry_run: false,
      patch: patch as never,
      profile_id: 'local-llm-assisted-runtime-simulation',
    })

    expect(ctx.mocks.createPost).toHaveBeenCalledTimes(1)
    expect(report.resolution_map).toEqual(expect.arrayContaining([
      expect.objectContaining({
        logical_key: 'runtime.topup',
        entity_kind: 'runtime_instruction',
      }),
    ]))
    expect(report.op_results[0]).toMatchObject({
      op_id: 'runtime-topup',
      status: 'success',
    })
  })

  it('rejects imports when the requested profile does not match patch metadata', async () => {
    const ctx = createService()
    const patch = createPatch()

    await expect(ctx.service.importPatch({
      dry_run: true,
      patch: patch as never,
      profile_id: 'local-llm-assisted-runtime-simulation',
    })).rejects.toThrow(/does not match requested profile/u)
  })
})
