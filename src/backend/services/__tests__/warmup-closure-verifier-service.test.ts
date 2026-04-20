import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WarmupProbeContextInput } from '../../../shared/warmup-verifier.js'

const ORIGINAL_CWD = process.cwd()
let originalHighlightsFlag: boolean | undefined

type HarnessOptions = {
  hasBaseline?: boolean
  runtimeRunning?: boolean
  llmConfigured?: boolean
  baselineReasons?: string[]
  kickoffVerificationMissing?: string[]
  initialFeedVisible?: boolean
  initialSearchVisible?: boolean
  homeHealthy?: boolean
  highlightsHealthy?: boolean
  quarantineHidesProbe?: boolean
  restoreShowsProbe?: boolean
  cleanupHidesProbe?: boolean
  throwOnAdmissionRead?: boolean
  throwOnKickoffDetailRead?: boolean
  throwOnBaselinePostsRead?: boolean
  throwOnFeedRead?: boolean
  throwOnSearchRead?: boolean
  throwOnHomeRead?: boolean
  throwOnHighlightsRead?: boolean
}

function createHarness(options: HarnessOptions = {}) {
  const baselinePostIds = ['kickoff-base-1', 'warmup-base-1']
  let probePostId: string | null = null
  let probeToken: string | null = null
  let probeVisibility: 'PUBLIC' | 'QUARANTINE' = 'PUBLIC'
  let probeState: 'APPROVED' | 'PENDING' = 'APPROVED'
  let probeModerationMetadata: Record<string, unknown> | null = {
    distribution_state: 'NORMAL',
  }
  let quarantineCount = 0

  const hasBaseline = options.hasBaseline ?? true
  const initialFeedVisible = options.initialFeedVisible ?? true
  const initialSearchVisible = options.initialSearchVisible ?? true
  const homeHealthy = options.homeHealthy ?? true
  const highlightsHealthy = options.highlightsHealthy ?? true
  const quarantineHidesProbe = options.quarantineHidesProbe ?? true
  const restoreShowsProbe = options.restoreShowsProbe ?? true
  const cleanupHidesProbe = options.cleanupHidesProbe ?? quarantineHidesProbe

  const admission = hasBaseline
    ? {
        kickoff_baseline_id: 'kickoff-1',
        kickoff_batch_id: 'kickoff-batch-1',
        warmup_batch_id: 'warmup-batch-1',
        has_kickoff_baseline: true,
        kickoff_layer_ready: true,
        warmup_layer_ready: true,
        key_communities_ready: true,
        key_shelves_ready: true,
        media_access_ok: true,
        aftershow_pipeline_ok: true,
        allow_public_growth: (options.baselineReasons ?? []).length === 0,
        reasons: options.baselineReasons ?? [],
      }
    : {
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

  const kickoffDetail = {
    id: 'suite-1',
    baseline_label: 'suite label',
    state: 'active',
    created_by_user_id: 'admin-1',
    created_at: '2026-04-15T08:00:00.000Z',
    updated_at: '2026-04-15T08:00:00.000Z',
    activated_at: '2026-04-15T08:00:00.000Z',
    kickoff_batch_id: 'kickoff-batch-1',
    current_warmup_run_id: 'warmup-batch-1',
    kickoff_batch: {
      id: 'kickoff-batch-1',
      batch_kind: 'kickoff',
      state: 'active',
      source_batch_id: null,
      revision_key: 'kickoff:test',
      package_hash: 'kickoff:test',
      notes: null,
      activated_at: '2026-04-15T08:00:00.000Z',
      archived_at: null,
      created_at: '2026-04-15T08:00:00.000Z',
      updated_at: '2026-04-15T08:00:00.000Z',
      stats: {
        posts: 6,
        threads: 6,
        turns: 12,
        votes: 20,
        media: 3,
        communities: 2,
        media_covered_posts: 3,
        media_coverage_ratio: 0.5,
      },
      coverage: [],
      samples: [],
    },
    current_warmup_run: null,
    verification: {
      ok: (options.kickoffVerificationMissing ?? []).length === 0,
      missing: options.kickoffVerificationMissing ?? [],
    },
  }

  const shouldExposeProbe = () => {
    if (!probePostId) return false
    if (probeVisibility === 'QUARANTINE') {
      return !(quarantineCount > 1 ? cleanupHidesProbe : quarantineHidesProbe)
    }
    return restoreShowsProbe
  }

  const artifactRoot = mkdtempSync(join(tmpdir(), 'warmup-verifier-'))

  return {
    artifactRoot,
    inspect: {
      probeVisibility: () => probeVisibility,
      probeState: () => probeState,
    },
    deps: {
      artifactService: null as unknown,
      warmupGovernanceService: {
        getRuntimeBaselineAdmission: vi.fn(async () => {
          if (options.throwOnAdmissionRead) {
            throw new Error('admission read crashed')
          }
          return admission
        }),
        getKickoffDetail: vi.fn(async () => {
          if (options.throwOnKickoffDetailRead) {
            throw new Error('kickoff detail crashed')
          }
          return kickoffDetail
        }),
      },
      postScheduler: {
        forcePost: vi.fn(async (input?: { probe_context?: WarmupProbeContextInput }) => {
          probePostId = 'probe-post-1'
          probeToken = input?.probe_context?.probe_token ?? 'probe-token'
          probeVisibility = 'PUBLIC'
          probeState = 'APPROVED'
          probeModerationMetadata = { distribution_state: 'NORMAL' }
          return {
            triggered: true,
            agent_id: 'agent-1',
            community_id: 'community-1',
            post_id: probePostId,
          }
        }),
      },
      postRepo: {
        findById: vi.fn(async (id: string) => {
          if (id !== probePostId) return null
          return {
            id,
            community_id: 'community-1',
            author_agent_id: 'agent-1',
            title: `Probe title [probe:${probeToken}]`,
            body: 'probe body',
            tags: ['warmup-probe'],
            visibility: probeVisibility,
            state: probeState,
            moderation_metadata: probeModerationMetadata,
            governance_batch_id: null,
            generation_mode: null,
            created_at: new Date(),
            updated_at: new Date(),
          }
        }),
        findByGovernanceBatches: vi.fn(async () => {
          if (options.throwOnBaselinePostsRead) {
            throw new Error('baseline posts crashed')
          }
          return baselinePostIds.map((id, index) => ({
            id,
            community_id: `community-${index + 1}`,
            author_agent_id: `agent-${index + 1}`,
            title: `baseline-${id}`,
            body: 'baseline body',
            tags: [],
            visibility: 'PUBLIC',
            state: 'APPROVED',
            moderation_metadata: { distribution_state: 'NORMAL' },
            governance_batch_id: index === 0 ? 'kickoff-batch-1' : 'warmup-batch-1',
            generation_mode: 'warmup_runtime',
            created_at: new Date(),
            updated_at: new Date(),
          }))
        }),
        updateContent: vi.fn(
          async (
            _id: string,
            patch: {
              visibility?: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
              state?: 'PENDING' | 'APPROVED' | 'REJECTED'
            },
          ) => {
            if (patch.visibility) {
              probeVisibility = patch.visibility as 'PUBLIC' | 'QUARANTINE'
              if (patch.visibility === 'QUARANTINE') quarantineCount += 1
            }
            if (patch.state) probeState = patch.state as 'APPROVED' | 'PENDING'
            return null
          },
        ),
        updateModerationMetadata: vi.fn(
          async (_id: string, moderationMetadata: Record<string, unknown> | null) => {
            probeModerationMetadata = moderationMetadata
            return null
          },
        ),
      },
      forumReadService: {
        getFeed: vi.fn(async () => {
          if (options.throwOnFeedRead) {
            throw new Error('feed read crashed')
          }
          return {
            items: [
              ...(initialFeedVisible && shouldExposeProbe() && probePostId
                ? [
                    {
                      id: probePostId,
                    },
                  ]
                : []),
              ...baselinePostIds.map((id) => ({ id })),
            ],
            next_cursor: null,
          }
        }),
      },
      searchService: {
        search: vi.fn(async () => {
          if (options.throwOnSearchRead) {
            throw new Error('search read crashed')
          }
          return {
            query: probeToken ?? '',
            normalized_query: probeToken ?? '',
            current_tab: 'posts',
            counts: {
              posts: shouldExposeProbe() && initialSearchVisible ? 1 : 0,
              communities: 0,
              agents: 0,
              threads: 0,
            },
            items:
              initialSearchVisible && shouldExposeProbe() && probePostId
                ? [
                    {
                      type: 'post',
                      id: probePostId,
                    },
                  ]
                : [],
            discovery: null,
            cursor: null,
            took_ms: 1,
          }
        }),
      },
      homeProgrammingService: {
        getHome: vi.fn(async () => {
          if (options.throwOnHomeRead) {
            throw new Error('home read crashed')
          }
          return {
            enabled: homeHealthy,
            mode: 'launch',
            fallback_mode: 'legacy',
            shelves: [
              {
                id: 'must_watch_today',
                label: 'Must Watch',
                collapsed: false,
                items: homeHealthy
                  ? [
                      {
                        id: baselinePostIds[0],
                        item_kind: 'post',
                      },
                    ]
                  : [],
              },
            ],
            hot_feed_continuation: {
              items: [],
              next_cursor: null,
            },
            meta: {
              generated_at: '2026-04-15T08:00:00.000Z',
              source: 'home-programming-v1',
            },
          }
        }),
      },
      globalHighlightsService: {
        collectToday: vi.fn(async () => {
          if (options.throwOnHighlightsRead) {
            throw new Error('highlights read crashed')
          }
          return {
            hot_threads: highlightsHealthy ? [{ id: baselinePostIds[0] }] : [],
            featured_agents: [],
            controversy: highlightsHealthy ? [{ id: baselinePostIds[1] }] : [],
            wildcard_cameos: [],
            meta: {
              range: 'today',
              generated_at: '2026-04-15T08:00:00.000Z',
              source: 'global-highlights-v1',
            },
          }
        }),
      },
      searchProjectionService: {
        refreshPost: vi.fn(async () => {}),
      },
      runtimeLoop: {
        isRunning: options.runtimeRunning ?? true,
      },
      llmGateway: {
        isConfigured: options.llmConfigured ?? true,
      },
    },
  }
}

describe('WarmupClosureVerifierService', () => {
  beforeEach(async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'warmup-verifier-cwd-'))
    process.chdir(tempRoot)
    const { config } = await import('../../lib/config.js')
    originalHighlightsFlag = config.launch.capabilities.globalHighlightsV1
    config.launch.capabilities.globalHighlightsV1 = true
  })

  afterEach(async () => {
    process.chdir(ORIGINAL_CWD)
    const { config } = await import('../../lib/config.js')
    config.launch.capabilities.globalHighlightsV1 = originalHighlightsFlag ?? true
  })

  it('passes the full closure path when probe, surfaces, and governance drill all succeed', async () => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
    const harness = createHarness()
    const artifactService = new WarmupRunArtifactService(harness.artifactRoot)
    const service = new WarmupClosureVerifierService({
      ...harness.deps,
      artifactService,
    } as never)

    const result = await service.run({ triggered_by_user_id: 'admin-1' })

    expect(result.summary.status).toBe('passed')
    expect(result.summary.surface_matrix).toEqual({
      feed: true,
      home: true,
      highlights: true,
      search: true,
    })
    expect(result.summary.governance_drill).toEqual({
      quarantine_ok: true,
      restore_ok: true,
      cleanup_ok: true,
    })
    expect(result.probe_manifest?.post_id).toBe('probe-post-1')
    expect(harness.inspect.probeVisibility()).toBe('QUARANTINE')
  })

  it('fails closed when no kickoff baseline exists', async () => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
    const harness = createHarness({ hasBaseline: false })
    const artifactService = new WarmupRunArtifactService(harness.artifactRoot)
    const service = new WarmupClosureVerifierService({
      ...harness.deps,
      artifactService,
    } as never)

    const result = await service.run({ triggered_by_user_id: 'admin-1' })

    expect(result.summary.status).toBe('failed')
    expect(result.summary.failed_phase).toBe('baseline_admission')
    expect(result.top_diagnosis?.code).toBe('baseline.missing_kickoff_baseline')
    for (const path of Object.values(result.artifacts)) {
      expect(existsSync(path)).toBe(true)
    }
  })

  it('fails closed when runtime is stopped or llm is not configured', async () => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
    const harness = createHarness({ runtimeRunning: false, llmConfigured: false })
    const artifactService = new WarmupRunArtifactService(harness.artifactRoot)
    const service = new WarmupClosureVerifierService({
      ...harness.deps,
      artifactService,
    } as never)

    const result = await service.run({ triggered_by_user_id: 'admin-1' })

    expect(result.summary.status).toBe('failed')
    expect(result.diagnoses.map((item) => item.code)).toEqual(
      expect.arrayContaining(['runtime.worker_not_running', 'runtime.llm_not_configured']),
    )
  })

  it.each([
    ['feed', { initialFeedVisible: false }, 'surface.feed.missing_expected_content'],
    ['search', { initialSearchVisible: false }, 'surface.search.missing_expected_content'],
    ['home', { homeHealthy: false }, 'surface.home.missing_expected_content'],
    ['highlights', { highlightsHealthy: false }, 'surface.highlights.missing_expected_content'],
  ])('classifies %s surface failures', async (_label, override, expectedCode) => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
    const harness = createHarness(override)
    const artifactService = new WarmupRunArtifactService(harness.artifactRoot)
    const service = new WarmupClosureVerifierService({
      ...harness.deps,
      artifactService,
    } as never)

    const result = await service.run({ triggered_by_user_id: 'admin-1' })

    expect(result.summary.status).toBe('failed')
    expect(result.diagnoses.map((item) => item.code)).toContain(expectedCode)
  })

  it.each([
    ['feed', { throwOnFeedRead: true }, 'surface.feed.read_failed', 'surface_feed'],
    ['search', { throwOnSearchRead: true }, 'surface.search.read_failed', 'surface_search'],
    ['home', { throwOnHomeRead: true }, 'surface.home.read_failed', 'surface_home'],
    [
      'highlights',
      { throwOnHighlightsRead: true },
      'surface.highlights.read_failed',
      'surface_highlights',
    ],
  ])(
    'classifies %s surface read exceptions to the correct subsystem',
    async (_label, override, expectedCode, expectedPhase) => {
      const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
      const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
      const harness = createHarness(override)
      const artifactService = new WarmupRunArtifactService(harness.artifactRoot)
      const service = new WarmupClosureVerifierService({
        ...harness.deps,
        artifactService,
      } as never)

      const result = await service.run({ triggered_by_user_id: 'admin-1' })

      expect(result.summary.status).toBe('failed')
      expect(result.summary.failed_phase).toBe(expectedPhase)
      expect(result.diagnoses.map((item) => item.code)).toContain(expectedCode)
    },
  )

  it('classifies governance quarantine drift when the probe remains visible', async () => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
    const harness = createHarness({ quarantineHidesProbe: false })
    const artifactService = new WarmupRunArtifactService(harness.artifactRoot)
    const service = new WarmupClosureVerifierService({
      ...harness.deps,
      artifactService,
    } as never)

    const result = await service.run({ triggered_by_user_id: 'admin-1' })

    expect(result.summary.status).toBe('failed')
    expect(result.summary.governance_drill.quarantine_ok).toBe(false)
    expect(result.diagnoses.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'surface.after_quarantine.feed.unexpected_visibility',
        'surface.after_quarantine.search.unexpected_visibility',
        'governance.quarantine.surface_check_failed',
      ]),
    )
  })

  it('classifies governance restore drift when the probe does not return', async () => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
    const harness = createHarness({ restoreShowsProbe: false })
    const artifactService = new WarmupRunArtifactService(harness.artifactRoot)
    const service = new WarmupClosureVerifierService({
      ...harness.deps,
      artifactService,
    } as never)

    const result = await service.run({ triggered_by_user_id: 'admin-1' })

    expect(result.summary.status).toBe('failed')
    expect(result.summary.governance_drill.restore_ok).toBe(false)
    expect(result.diagnoses.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'surface.after_restore.feed.missing_expected_content',
        'surface.after_restore.search.missing_expected_content',
        'governance.restore.surface_check_failed',
      ]),
    )
  })

  it('persists cleanup failures into the governance drill summary and artifact payload', async () => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
    const harness = createHarness({
      quarantineHidesProbe: true,
      restoreShowsProbe: true,
      cleanupHidesProbe: false,
    })
    const artifactService = new WarmupRunArtifactService(harness.artifactRoot)
    const service = new WarmupClosureVerifierService({
      ...harness.deps,
      artifactService,
    } as never)

    const result = await service.run({ triggered_by_user_id: 'admin-1' })

    expect(result.summary.status).toBe('failed')
    expect(result.summary.governance_drill.cleanup_ok).toBe(false)
    expect(result.governance_drill?.cleanup?.ok).toBe(false)
    expect(result.surface_audit?.after_cleanup?.feed.ok).toBe(false)
    expect(result.diagnoses.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'surface.after_cleanup.feed.unexpected_visibility',
        'surface.after_cleanup.search.unexpected_visibility',
        'governance.cleanup.surface_check_failed',
      ]),
    )
  })

  it('keeps persisted diagnoses consistent when a late artifact write fails', async () => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
    const harness = createHarness()
    class ResultSummaryFailingArtifactService extends WarmupRunArtifactService {
      override async writeResultSummary(): Promise<string> {
        throw new Error('result summary disk failure')
      }
    }
    const artifactService = new ResultSummaryFailingArtifactService(harness.artifactRoot)
    const service = new WarmupClosureVerifierService({
      ...harness.deps,
      artifactService,
    } as never)

    const result = await service.run({ triggered_by_user_id: 'admin-1' })

    expect(result.summary.status).toBe('failed')
    expect(result.summary.top_diagnosis_code).toBe(result.top_diagnosis?.code ?? null)
    expect(result.summary.top_diagnosis_code).toBe(result.diagnoses[0]?.code ?? null)
    expect(result.diagnoses.map((item) => item.code)).toContain(
      'artifact.result_summary_write_failed',
    )
  })

  it('classifies dependency exceptions instead of collapsing them into artifact persistence', async () => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const { WarmupClosureVerifierService } = await import('../warmup-closure-verifier-service.js')
    const harness = createHarness({ throwOnAdmissionRead: true })
    const artifactService = new WarmupRunArtifactService(harness.artifactRoot)
    const service = new WarmupClosureVerifierService({
      ...harness.deps,
      artifactService,
    } as never)

      const result = await service.run({ triggered_by_user_id: 'admin-1' })

      expect(result.summary.status).toBe('failed')
      expect(result.summary.failed_phase).toBe('kickoff_resolution')
      expect(result.diagnoses.map((item) => item.code)).toContain(
        'kickoff_resolution.baseline_admission_read_failed',
      )
    expect(result.diagnoses.map((item) => item.code)).not.toContain(
      'verifier.admission read crashed',
    )
  })
})
