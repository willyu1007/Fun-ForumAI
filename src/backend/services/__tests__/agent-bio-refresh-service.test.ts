import { describe, expect, it, vi } from 'vitest'
import { InMemoryAgentBioRepository } from '../../repos/agent-bio-repository.js'
import { AgentBioRefreshService, resolveAgentBioMajorRefreshIntervalMs } from '../agent-bio-refresh-service.js'
import type { AgentBioRenderSet, AgentBioWorldviewModel } from '../../domain/agent-bio/index.js'

function buildWorldview(presence: AgentBioWorldviewModel['presence']): AgentBioWorldviewModel {
  return {
    identity: {
      display_name: '阿澈',
      persona_seed_label: '学者型',
      home_voice_line_id: 'qwen-social-v1',
      voice_line_label: 'Qwen Social v1',
      visible_style: '冷静',
      interests: ['旧地图'],
      mood: '偏中性',
    },
    projection: {
      public_projection_hint: '总会把旧地图拎回话头',
      banter_style: 'gentle',
      top_scene: 'ROUND_TABLE',
      signature_moves: ['回身总结'],
    },
    public_history: {
      badges: [],
      tagline: '会把旧地图讲得像新入口',
      top_chronicle_summaries: ['把旧地图讲得像新入口'],
    },
    owner_history: {
      chronicle_summaries: ['最近在整理一批旧地图'],
      private_memory_summaries: ['会回头拆解说不清的岔路'],
      dominant_private_sentiment: 'thoughtful',
    },
    relations: {
      following_effective: 1,
      followers_effective: 1,
      mutual_effective: 0,
      recent_state_tags: [],
    },
    persona_state: {
      maturity: 'steady',
      confidence: 0.7,
      drift_score: 0.22,
    },
    presence,
    source_clauses: {
      public_safe: ['旧地图'],
      owner_only: ['说不清的岔路'],
      private_header: ['整理一批旧地图'],
      private_guard: ['会回头拆解说不清的岔路'],
    },
  }
}

function makeRenderSet(overrides: Partial<AgentBioRenderSet> = {}): AgentBioRenderSet {
  return {
    public_bio: '阿澈会把旧地图讲得像新入口。',
    owner_bio: '阿澈最近把整理旧地图这件事放在了更前排。',
    private_header_bio: '阿澈这会儿正沿着旧地图往里想。',
    presence_note: '这会儿像刚从热闹里退半步',
    render_policy_json: {
      selected_families: {
        public: 'stance',
        owner: 'phase_shadow',
        private_header: 'stance',
      },
    },
    render_fingerprint: 'render-fingerprint',
    privacy_blocked: false,
    diagnostics: {
      mode: 'fallback',
      prompt_ref: null,
      llm_provider_id: null,
      llm_model_id: null,
      parse_success: null,
      error: null,
      recent_major_families: [],
      selected_families: {
        public: 'stance',
        owner: 'phase_shadow',
        private_header: 'stance',
      },
      candidate_rejections: [],
      privacy_violations: [],
    },
    ...overrides,
  }
}

describe('AgentBioRefreshService', () => {
  it('keeps major refresh cadence above one day via staggered 10-15 day windows', () => {
    const intervalMs = resolveAgentBioMajorRefreshIntervalMs('agent-refresh-window')
    const days = intervalMs / (24 * 3_600_000)

    expect(days).toBeGreaterThanOrEqual(10)
    expect(days).toBeLessThanOrEqual(15)
  })

  it('minor_presence carries forward existing bios and only updates the presence note', async () => {
    const repo = new InMemoryAgentBioRepository()
    await repo.commitRefresh({
      worldview: {
        agent_id: 'agent-1',
        worldview_version: 1,
        phase_revision: 1,
        source_fingerprint: 'same-source',
        refresh_reason: 'bootstrap',
        presence_bucket: 'steady',
        worldview_json: { bucket: 'steady' },
        last_major_refreshed_at: new Date('2026-03-01T00:00:00.000Z'),
        last_minor_refreshed_at: null,
        last_compiled_at: new Date('2026-03-01T00:00:00.000Z'),
      },
      projection: {
        agent_id: 'agent-1',
        worldview_version: 1,
        phase_revision: 1,
        public_bio: '阿澈会把旧地图讲得像新入口。',
        owner_bio: '阿澈最近把整理旧地图这件事放在了更前排。',
        private_header_bio: '阿澈这会儿正沿着旧地图往里想。',
        presence_note: '先前的状态附注',
        render_fingerprint: 'seed-fp',
        render_policy_json: {
          selected_families: {
            public: 'stance',
          },
        },
        refreshed_at: new Date('2026-03-01T00:00:00.000Z'),
      },
      render_log: {
        agent_id: 'agent-1',
        refresh_kind: 'major',
        refresh_reason: 'bootstrap',
        dedup_key: 'seed',
        worldview_version: 1,
        phase_revision: 1,
        source_fingerprint: 'same-source',
        render_fingerprint: 'seed-fp',
        status: 'rendered',
        public_persisted: true,
        note_json: {
          selected_families: { public: 'stance' },
          selected_bios: { public: '阿澈会把旧地图讲得像新入口。' },
        },
      },
    })

    const renderService = {
      render: vi.fn(),
    }

    const refreshService = new AgentBioRefreshService({
      repo,
      agentRepo: {
        findById: vi.fn().mockReturnValue({ id: 'agent-1', display_name: '阿澈' }),
        findActive: vi.fn(),
      } as never,
      worldviewService: {
        compile: vi.fn().mockResolvedValue({
          worldview: buildWorldview({
            bucket: 'reflective',
            score: 0.58,
            note_seed: '这会儿更像在往回收',
            last_touch_at: new Date('2026-03-27T08:00:00.000Z').toISOString(),
          }),
          source_fingerprint: 'same-source',
        }),
      } as never,
      renderService: renderService as never,
    })

    const result = await refreshService.refresh('agent-1', {
      refresh_kind: 'minor_presence',
      reason: 'display_presence_refresh',
      now: new Date('2026-03-27T12:00:00.000Z'),
    })

    expect(renderService.render).not.toHaveBeenCalled()
    expect(result?.projection.public_bio).toBe('阿澈会把旧地图讲得像新入口。')
    expect(result?.projection.owner_bio).toBe('阿澈最近把整理旧地图这件事放在了更前排。')
    expect(result?.projection.private_header_bio).toBe('阿澈这会儿正沿着旧地图往里想。')
    expect(result?.projection.presence_note).toBe('这会儿更像在往回收')
    expect(result?.projection.render_policy_json.render_mode).toBe('carry_forward_minor')
  })

  it('major refresh sweep skips agents refreshed only one day ago', async () => {
    const repo = new InMemoryAgentBioRepository()
    await repo.commitRefresh({
      worldview: {
        agent_id: 'agent-2',
        worldview_version: 1,
        phase_revision: 1,
        source_fingerprint: 'same-source',
        refresh_reason: 'bootstrap',
        presence_bucket: 'steady',
        worldview_json: { bucket: 'steady' },
        last_major_refreshed_at: new Date('2026-03-26T00:00:00.000Z'),
        last_minor_refreshed_at: null,
        last_compiled_at: new Date('2026-03-26T00:00:00.000Z'),
      },
      projection: {
        agent_id: 'agent-2',
        worldview_version: 1,
        phase_revision: 1,
        public_bio: '阿澈会把旧地图讲得像新入口。',
        owner_bio: '阿澈最近把整理旧地图这件事放在了更前排。',
        private_header_bio: '阿澈这会儿正沿着旧地图往里想。',
        presence_note: '先前的状态附注',
        render_fingerprint: 'seed-fp-2',
        render_policy_json: {},
        refreshed_at: new Date('2026-03-26T00:00:00.000Z'),
      },
      render_log: {
        agent_id: 'agent-2',
        refresh_kind: 'major',
        refresh_reason: 'bootstrap',
        dedup_key: 'seed-2',
        worldview_version: 1,
        phase_revision: 1,
        source_fingerprint: 'same-source',
        render_fingerprint: 'seed-fp-2',
        status: 'rendered',
        public_persisted: true,
      },
    })

    const renderService = {
      render: vi.fn().mockResolvedValue(makeRenderSet()),
    }

    const refreshService = new AgentBioRefreshService({
      repo,
      agentRepo: {
        findById: vi.fn().mockReturnValue({ id: 'agent-2', display_name: '阿澈' }),
        findActive: vi.fn().mockReturnValue({
          items: [{ id: 'agent-2', display_name: '阿澈' }],
          next_cursor: null,
        }),
      } as never,
      worldviewService: {
        compile: vi.fn().mockResolvedValue({
          worldview: buildWorldview({
            bucket: 'steady',
            score: 0.66,
            note_seed: '这会儿像已经站稳了',
            last_touch_at: new Date('2026-03-27T08:00:00.000Z').toISOString(),
          }),
          source_fingerprint: 'same-source',
        }),
      } as never,
      renderService: renderService as never,
    })

    const summary = await refreshService.processMajorRefreshSweep({
      now: new Date('2026-03-27T00:00:00.000Z'),
      limit: 10,
      page_size: 20,
    })

    expect(summary.refreshed).toBe(0)
    expect(summary.skipped).toBe(1)
    expect(renderService.render).not.toHaveBeenCalled()
  })

  it('force major refresh sweep rerenders recently refreshed agents for rollout backfill', async () => {
    const repo = new InMemoryAgentBioRepository()
    await repo.commitRefresh({
      worldview: {
        agent_id: 'agent-force',
        worldview_version: 1,
        phase_revision: 1,
        source_fingerprint: 'same-source',
        refresh_reason: 'bootstrap',
        presence_bucket: 'steady',
        worldview_json: { bucket: 'steady' },
        last_major_refreshed_at: new Date('2026-03-26T00:00:00.000Z'),
        last_minor_refreshed_at: null,
        last_compiled_at: new Date('2026-03-26T00:00:00.000Z'),
      },
      projection: {
        agent_id: 'agent-force',
        worldview_version: 1,
        phase_revision: 1,
        public_bio: '旧简介。',
        owner_bio: '旧 owner 简介。',
        private_header_bio: '旧私聊头部。',
        presence_note: '旧状态附注',
        render_fingerprint: 'seed-fp-force',
        render_policy_json: {},
        refreshed_at: new Date('2026-03-26T00:00:00.000Z'),
      },
      render_log: {
        agent_id: 'agent-force',
        refresh_kind: 'major',
        refresh_reason: 'bootstrap',
        dedup_key: 'seed-force',
        worldview_version: 1,
        phase_revision: 1,
        source_fingerprint: 'same-source',
        render_fingerprint: 'seed-fp-force',
        status: 'rendered',
        public_persisted: true,
      },
    })

    const renderService = {
      render: vi.fn().mockResolvedValue(makeRenderSet({
        render_fingerprint: 'force-fp',
      })),
    }

    const refreshService = new AgentBioRefreshService({
      repo,
      agentRepo: {
        findById: vi.fn().mockImplementation((agentId: string) => ({ id: agentId, display_name: '阿澈' })),
        findActive: vi.fn().mockReturnValue({
          items: [{ id: 'agent-force', display_name: '阿澈' }],
          next_cursor: null,
        }),
      } as never,
      worldviewService: {
        compile: vi.fn().mockResolvedValue({
          worldview: buildWorldview({
            bucket: 'steady',
            score: 0.66,
            note_seed: '这会儿像已经站稳了',
            last_touch_at: new Date('2026-03-27T08:00:00.000Z').toISOString(),
          }),
          source_fingerprint: 'source-force',
        }),
      } as never,
      renderService: renderService as never,
    })

    const summary = await refreshService.processMajorRefreshSweep({
      now: new Date('2026-03-27T00:00:00.000Z'),
      limit: 10,
      page_size: 20,
      force: true,
    })

    expect(summary.refreshed).toBe(1)
    expect(summary.skipped).toBe(0)
    expect(renderService.render).toHaveBeenCalledTimes(1)
  })

  it('tracks committed refreshes and privacy blocks in observability counters', async () => {
    const repo = new InMemoryAgentBioRepository()
    const refreshService = new AgentBioRefreshService({
      repo,
      agentRepo: {
        findById: vi.fn().mockReturnValue({ id: 'agent-3', display_name: '阿澈' }),
        findActive: vi.fn(),
      } as never,
      worldviewService: {
        compile: vi.fn().mockResolvedValue({
          worldview: buildWorldview({
            bucket: 'steady',
            score: 0.62,
            note_seed: '这会儿像已经站稳了',
            last_touch_at: new Date('2026-03-27T08:00:00.000Z').toISOString(),
          }),
          source_fingerprint: 'source-3',
        }),
      } as never,
      renderService: {
        render: vi.fn().mockResolvedValue(
          makeRenderSet({
            public_bio: null,
            privacy_blocked: true,
            diagnostics: {
              ...makeRenderSet().diagnostics,
              privacy_violations: ['owner_private_leak'],
            },
          }),
        ),
      } as never,
    })

    await refreshService.refresh('agent-3', {
      refresh_kind: 'bootstrap',
      reason: 'test_observability',
      now: new Date('2026-03-27T12:00:00.000Z'),
    })

    expect(refreshService.inspectObservability()).toMatchObject({
      counts: {
        attempted: 1,
        committed: 1,
        deduped: 0,
        conflicts: 0,
        privacy_blocked: 1,
        errors: 0,
      },
      by_kind: {
        bootstrap: {
          attempted: 1,
          committed: 1,
          privacy_blocked: 1,
        },
      },
      last_refresh_kind: 'bootstrap',
      last_reason: 'test_observability',
    })
  })

  it('deduplicates concurrent bootstrap refreshes per agent', async () => {
    const repo = new InMemoryAgentBioRepository()
    let releaseRender: ((value: AgentBioRenderSet) => void) | null = null
    const renderGate = new Promise<AgentBioRenderSet>((resolve) => {
      releaseRender = resolve
    })
    const renderService = {
      render: vi.fn().mockImplementation(async () => renderGate),
    }

    const refreshService = new AgentBioRefreshService({
      repo,
      agentRepo: {
        findById: vi.fn().mockReturnValue({ id: 'agent-concurrent', display_name: '阿澈' }),
        findActive: vi.fn(),
      } as never,
      worldviewService: {
        compile: vi.fn().mockResolvedValue({
          worldview: buildWorldview({
            bucket: 'steady',
            score: 0.62,
            note_seed: '这会儿像已经站稳了',
            last_touch_at: new Date('2026-03-27T08:00:00.000Z').toISOString(),
          }),
          source_fingerprint: 'source-concurrent',
        }),
      } as never,
      renderService: renderService as never,
    })

    const first = refreshService.getProjection('agent-concurrent', {
      build_if_missing: true,
      allow_minor_refresh: false,
    })
    const second = refreshService.getProjection('agent-concurrent', {
      build_if_missing: true,
      allow_minor_refresh: false,
    })

    await vi.waitFor(() => {
      expect(renderService.render).toHaveBeenCalledTimes(1)
    })

    expect(releaseRender).not.toBeNull()
    releaseRender!(makeRenderSet({
      render_fingerprint: 'render-fingerprint-concurrent',
    }))

    const [firstProjection, secondProjection] = await Promise.all([first, second])

    expect(renderService.render).toHaveBeenCalledTimes(1)
    expect(firstProjection?.public_bio).toBe(secondProjection?.public_bio)
    const logs = await repo.listRenderLogs('agent-concurrent', { limit: 5 })
    expect(logs).toHaveLength(1)
  })
})
