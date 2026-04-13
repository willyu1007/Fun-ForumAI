import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import { KickoffSuiteEditService } from '../kickoff-suite-edit-service.js'

describe('KickoffSuiteEditService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('previews and applies rewrite_post edits through repositories plus readiness refresh', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const postRepo = new InMemoryPostRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()
    const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
    const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
    const refreshPost = vi.fn(async () => {})
    const refreshThread = vi.fn(async () => {})

    const agent = agentRepo.create({
      owner_id: 'owner-1',
      display_name: 'Kickoff Editor',
    })
    const post = await postRepo.create({
      community_id: 'community-1',
      author_agent_id: agent.id,
      title: 'Original title',
      body: 'Original body',
      visibility: 'GRAY',
      state: 'PENDING',
      moderation_metadata: {
        distribution_state: 'NO_RECOMMEND',
      },
      warm_start_batch_id: 'kickoff-batch-1',
      generation_mode: 'warmup_candidate',
    })

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
      summary: {
        posts: 1,
        threads: 0,
        turns: 0,
        votes: 0,
        media: 0,
        communities: 1,
        media_covered_posts: 0,
        media_coverage_ratio: 0,
      },
      activation_readiness: {
        ok: true,
        reasons: [],
      },
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

    const service = new KickoffSuiteEditService({
      warmupGovernanceRepo: {} as never,
      warmupGovernanceService: {
        getSuiteDetail: vi.fn(async () => suiteDetail as never),
      },
      runtimeReadinessService: {
        buildForSuite: vi.fn(async () => ({
          contract_version: 1,
          suite_id: 'suite-1',
          suite_label: 'kickoff-v1',
          suite_state: 'review_ready',
          kickoff_batch_id: 'kickoff-batch-1',
          warmup_batch_id: 'warmup-batch-1',
          active_baseline_id: null,
          activation_readiness: { ok: true, reasons: [] },
          layer_readiness: {
            kickoff_layer_ready: true,
            warmup_layer_ready: true,
            key_communities_ready: true,
            key_shelves_ready: true,
            media_access_ok: true,
            aftershow_pipeline_ok: true,
          },
          quality_state: {
            summary: suiteDetail.summary,
            warning_count: 0,
            warnings: [],
          },
          admission: {
            allow_public_growth: false,
            reasons: [],
            has_active_baseline: false,
            active_baseline_id: null,
          },
          generated_at: '2026-04-13T00:05:00.000Z',
        })),
      } as never,
      postRepo,
      postMediaRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      forumWriteService: {
        createThread: vi.fn(),
        addThreadTurn: vi.fn(),
      } as never,
      mediaAssetControlService: {
        createFromUpload: vi.fn(),
        promoteAsset: vi.fn(),
        attachPostMediaAndConsume: vi.fn(),
      } as never,
      agentRepo,
      searchProjectionService: {
        refreshPost,
        refreshThread,
      },
    })

    const preview = await service.previewEdit({
      action: 'rewrite_post',
      target: {
        suite_id: 'suite-1',
        post_id: post.id,
      },
      payload: {
        title: 'Updated title',
        body: 'Updated body',
      },
      reason: 'tighten kickoff copy',
    })

    expect(preview.impact_summary).toContain('kickoff-v1')

    const result = await service.applyEdit({
      action: 'rewrite_post',
      target: {
        suite_id: 'suite-1',
        post_id: post.id,
      },
      payload: {
        title: 'Updated title',
        body: 'Updated body',
      },
      reason: 'tighten kickoff copy',
    })

    const updated = await postRepo.findById(post.id)
    expect(updated?.title).toBe('Updated title')
    expect(updated?.body).toBe('Updated body')
    expect(refreshPost).toHaveBeenCalledWith(post.id)
    expect(result.suite_readiness.activation_readiness.ok).toBe(true)
  })

  it('replaces post media through media services without direct storage-key mutation', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const postRepo = new InMemoryPostRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()
    const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
    const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
    const refreshPost = vi.fn(async () => {})
    const createFromUpload = vi.fn(async () => ({ asset_id: 'asset-uploaded' }))
    const promoteAsset = vi.fn(async () => ({ asset_id: 'asset-promoted' }))

    const agent = agentRepo.create({
      owner_id: 'owner-1',
      display_name: 'Kickoff Editor',
    })
    const post = await postRepo.create({
      community_id: 'community-1',
      author_agent_id: agent.id,
      title: 'Original title',
      body: 'Original body',
      visibility: 'GRAY',
      state: 'PENDING',
      moderation_metadata: {
        distribution_state: 'NO_RECOMMEND',
      },
      warm_start_batch_id: 'warmup-batch-1',
      generation_mode: 'warmup_candidate',
    })
    postMediaRepo.create({
      post_id: post.id,
      asset_id: 'asset-old',
      media_url: '/media/old.png',
      mime_type: 'image/png',
      warm_start_batch_id: 'warmup-batch-1',
      generation_mode: 'warmup_candidate',
    })

    const attachPostMediaAndConsume = vi.fn(async (input: {
      asset_id: string
      post_id: string
      warmup_context: {
        warm_start_batch_id: string
        generation_mode: 'warmup_candidate' | 'warmup_topup_candidate' | 'governance_restore'
      }
    }) => {
      postMediaRepo.create({
        post_id: input.post_id,
        asset_id: input.asset_id,
        media_url: `/media/${input.asset_id}.png`,
        mime_type: 'image/png',
        warm_start_batch_id: input.warmup_context.warm_start_batch_id,
        generation_mode: input.warmup_context.generation_mode,
      })
    })

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
      summary: {
        posts: 1,
        threads: 0,
        turns: 0,
        votes: 0,
        media: 1,
        communities: 1,
        media_covered_posts: 1,
        media_coverage_ratio: 1,
      },
      activation_readiness: {
        ok: true,
        reasons: [],
      },
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

    const service = new KickoffSuiteEditService({
      warmupGovernanceRepo: {} as never,
      warmupGovernanceService: {
        getSuiteDetail: vi.fn(async () => suiteDetail as never),
      },
      runtimeReadinessService: {
        buildForSuite: vi.fn(async () => ({
          contract_version: 1,
          suite_id: 'suite-1',
          suite_label: 'kickoff-v1',
          suite_state: 'review_ready',
          kickoff_batch_id: 'kickoff-batch-1',
          warmup_batch_id: 'warmup-batch-1',
          active_baseline_id: null,
          activation_readiness: { ok: true, reasons: [] },
          layer_readiness: {
            kickoff_layer_ready: true,
            warmup_layer_ready: true,
            key_communities_ready: true,
            key_shelves_ready: true,
            media_access_ok: true,
            aftershow_pipeline_ok: true,
          },
          quality_state: {
            summary: suiteDetail.summary,
            warning_count: 0,
            warnings: [],
          },
          admission: {
            allow_public_growth: false,
            reasons: [],
            has_active_baseline: false,
            active_baseline_id: null,
          },
          generated_at: '2026-04-13T00:05:00.000Z',
        })),
      } as never,
      postRepo,
      postMediaRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      forumWriteService: {
        createThread: vi.fn(),
        addThreadTurn: vi.fn(),
      } as never,
      mediaAssetControlService: {
        createFromUpload,
        promoteAsset,
        attachPostMediaAndConsume,
      } as never,
      agentRepo,
      searchProjectionService: {
        refreshPost,
        refreshThread: vi.fn(async () => {}),
      },
    })

    await service.applyEdit({
      action: 'replace_post_media',
      target: {
        suite_id: 'suite-1',
        post_id: post.id,
      },
      payload: {
        source_kind: 'inline_base64',
        inline_base64: Buffer.from('fake-image').toString('base64'),
        mime_type: 'image/png',
      },
      reason: 'refresh kickoff cover image',
    })

    const postMedia = postMediaRepo.findByPostId(post.id)
    expect(createFromUpload).toHaveBeenCalledTimes(1)
    expect(promoteAsset).toHaveBeenCalledTimes(1)
    expect(attachPostMediaAndConsume).toHaveBeenCalledTimes(1)
    expect(postMedia).toHaveLength(1)
    expect(postMedia[0]?.asset_id).toBe('asset-promoted')
    expect(refreshPost).toHaveBeenCalledWith(post.id)
  })

  it('regenerates a thread and refreshes the new thread id instead of the deleted one', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const postRepo = new InMemoryPostRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()
    const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
    const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
    const refreshPost = vi.fn(async () => {})
    const refreshThread = vi.fn(async () => {})

    const agent = agentRepo.create({
      owner_id: 'owner-1',
      display_name: 'Kickoff Editor',
    })
    const post = await postRepo.create({
      community_id: 'community-1',
      author_agent_id: agent.id,
      title: 'Original title',
      body: 'Original body',
      visibility: 'GRAY',
      state: 'PENDING',
      moderation_metadata: {
        distribution_state: 'NO_RECOMMEND',
      },
      warm_start_batch_id: 'kickoff-batch-1',
      generation_mode: 'warmup_candidate',
    })
    const thread = await publicStageThreadRepo.create({
      community_id: 'community-1',
      post_id: post.id,
      author_actor_type: 'agent',
      author_agent_id: agent.id,
      body: 'Old thread root',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      warm_start_batch_id: 'warmup-batch-1',
      generation_mode: 'warmup_candidate',
    })

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
      activation_readiness: {
        ok: true,
        reasons: [],
      },
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

    const createThread = vi.fn(async () => ({
      entry: {
        id: 'thread-new',
      },
    }))

    const service = new KickoffSuiteEditService({
      warmupGovernanceRepo: {} as never,
      warmupGovernanceService: {
        getSuiteDetail: vi.fn(async () => suiteDetail as never),
      },
      runtimeReadinessService: {
        buildForSuite: vi.fn(async () => ({
          contract_version: 1,
          suite_id: 'suite-1',
          suite_label: 'kickoff-v1',
          suite_state: 'review_ready',
          kickoff_batch_id: 'kickoff-batch-1',
          warmup_batch_id: 'warmup-batch-1',
          active_baseline_id: null,
          activation_readiness: { ok: true, reasons: [] },
          layer_readiness: {
            kickoff_layer_ready: true,
            warmup_layer_ready: true,
            key_communities_ready: true,
            key_shelves_ready: true,
            media_access_ok: true,
            aftershow_pipeline_ok: true,
          },
          quality_state: {
            summary: suiteDetail.summary,
            warning_count: 0,
            warnings: [],
          },
          admission: {
            allow_public_growth: false,
            reasons: [],
            has_active_baseline: false,
            active_baseline_id: null,
          },
          generated_at: '2026-04-13T00:05:00.000Z',
        })),
      } as never,
      postRepo,
      postMediaRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      forumWriteService: {
        createThread,
        addThreadTurn: vi.fn(),
      } as never,
      mediaAssetControlService: {
        createFromUpload: vi.fn(),
        promoteAsset: vi.fn(),
        attachPostMediaAndConsume: vi.fn(),
      } as never,
      agentRepo,
      searchProjectionService: {
        refreshPost,
        refreshThread,
      },
    })

    await service.applyEdit({
      action: 'regenerate_thread',
      target: {
        suite_id: 'suite-1',
        thread_id: thread.id,
      },
      payload: {
        body: 'New kickoff thread root',
      },
      reason: 'refresh kickoff thread root',
    })

    expect(createThread).toHaveBeenCalledTimes(1)
    expect(refreshThread).toHaveBeenCalledWith('thread-new')
    expect(refreshThread).not.toHaveBeenCalledWith(thread.id)
    expect(refreshPost).toHaveBeenCalledWith(post.id)
  })
})
