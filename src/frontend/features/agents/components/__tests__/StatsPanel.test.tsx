import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatsPanel } from '../StatsPanel'
import type { AgentStatsSnapshot, StatsAllocationPreview } from '@/api/types'
import {
  useAgentStats,
  useAgentStatsEvents,
  useAgentStateTimeline,
  usePreviewStatsAllocation,
  useAllocateStats,
} from '@/api/hooks'

vi.mock('@/api/hooks', () => ({
  useAgentStats: vi.fn(),
  useAgentStatsEvents: vi.fn(),
  useAgentStateTimeline: vi.fn(),
  usePreviewStatsAllocation: vi.fn(),
  useAllocateStats: vi.fn(),
}))

const useAgentStatsMock = vi.mocked(useAgentStats)
const useAgentStatsEventsMock = vi.mocked(useAgentStatsEvents)
const useAgentStateTimelineMock = vi.mocked(useAgentStateTimeline)
const usePreviewStatsAllocationMock = vi.mocked(usePreviewStatsAllocation)
const useAllocateStatsMock = vi.mocked(useAllocateStats)

function buildSnapshot(): AgentStatsSnapshot {
  return {
    stats: {
      granted_points_total: 3,
      unspent_points: 3,
      sociability: 0,
      curiosity: 0,
      assertiveness: 0,
      empathy: 0,
      brashness: 0,
      cynicism: 0,
      stubbornness: 0,
      volatility: 0,
      memory: 30,
      learning: 30,
      version: 7,
      created_at: '2026-02-27T00:00:00.000Z',
      updated_at: '2026-02-27T00:00:00.000Z',
    },
    state: {
      valence: 0,
      arousal: 0,
      confidence: 0,
      irritability: 0,
      fatigue: 0,
      last_updated_at: '2026-02-27T00:00:00.000Z',
    },
    derived: {
      participation: {
        participation_bias: 0,
        participation_multiplier: 1,
        exploration_noise_scale: 0.2,
        p_wander: 0.1,
        controversy_appetite: 0.2,
      },
      chat: {
        talkativeness_1_5: 3,
        chat_tick_multiplier: 1,
      },
      vote: {
        p_vote: 0.4,
        p_down_given_vote: 0.3,
      },
      relation_policy: {
        pos_multiplier: 1,
        neg_multiplier: 1,
        challenge_valence: 0,
        friend_on: 0.7,
        friend_off: 0.5,
        block_soft_on: 0.25,
        block_hard_on: 0.1,
        trust_on: 0.75,
        trust_off: 0.45,
      },
      memory: {
        top_k_ability: 16,
        budget_ability: 1400,
        effective_top_k: 12,
        effective_budget: 1200,
        decay_per_day: 0.02,
        forget_threshold: 0.3,
        callback_drive: 0.2,
      },
      learning: {
        digest_level: 2,
        importance_alpha: 1.1,
        min_tags: 2,
        max_tags: 6,
      },
      expression: {
        sarcasm_allowed: false,
        concession_rate: 0.2,
        caution_rate: 0.35,
        temperature: 0.7,
      },
      stats_hint: {
        participation_multiplier: 1,
        exploration_noise_scale: 0.2,
        controversy_appetite: 0.2,
        p_wander: 0.1,
      },
    },
  }
}

function buildPreview(snapshot: AgentStatsSnapshot): StatsAllocationPreview {
  return {
    before: snapshot.stats,
    after: { ...snapshot.stats, sociability: 4, unspent_points: 2, version: 8 },
    cost_points: 1,
    remaining_points: 2,
    derived: {
      ...snapshot.derived,
      chat: {
        ...snapshot.derived.chat,
        talkativeness_1_5: 4,
      },
      memory: {
        ...snapshot.derived.memory,
        effective_budget: 1250,
        effective_top_k: 13,
      },
    },
  }
}

interface HookSetupOptions {
  previewData?: StatsAllocationPreview
  previewError?: Error | null
  allocateError?: Error | null
}

function setupHooks(options: HookSetupOptions = {}) {
  const snapshot = buildSnapshot()
  const previewMutate = vi.fn()
  const previewReset = vi.fn()
  const allocateMutate = vi.fn()

  useAgentStatsMock.mockReturnValue({
    isLoading: false,
    data: { data: snapshot },
  } as never)

  useAgentStatsEventsMock.mockReturnValue({
    data: {
      data: {
        items: [
          {
            id: 'evt-1',
            event_type: 'stats.allocate',
            source: 'owner',
            idempotency_key: 'idem-1',
            delta_json: {},
            created_at: '2026-02-27T00:00:00.000Z',
          },
        ],
        next_cursor: null,
      },
    },
  } as never)

  useAgentStateTimelineMock.mockReturnValue({
    data: {
      data: [
        {
          at: '2026-02-27T00:00:00.000Z',
          valence: 0,
          arousal: 0,
          confidence: 0,
          irritability: 0,
          fatigue: 0,
        },
      ],
    },
  } as never)

  usePreviewStatsAllocationMock.mockReturnValue({
    mutate: previewMutate,
    data: options.previewData ? { data: options.previewData } : undefined,
    isPending: false,
    isError: Boolean(options.previewError),
    error: options.previewError ?? null,
    reset: previewReset,
  } as never)

  useAllocateStatsMock.mockReturnValue({
    mutate: allocateMutate,
    isPending: false,
    isError: Boolean(options.allocateError),
    error: options.allocateError ?? null,
  } as never)

  return { snapshot, previewMutate, previewReset, allocateMutate }
}

describe('StatsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls preview API with draft allocation and version', () => {
    const { previewMutate } = setupHooks()
    render(<StatsPanel agentId="agent-1" />)

    const input = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: '预览分配' }))

    expect(previewMutate).toHaveBeenCalledTimes(1)
    expect(previewMutate).toHaveBeenCalledWith({
      allocation: expect.objectContaining({ sociability: 2 }),
      version: 7,
    })
  })

  it('enforces no-respec confirmation before allocate', () => {
    const snapshot = buildSnapshot()
    const previewData = buildPreview(snapshot)
    const { allocateMutate } = setupHooks({ previewData })
    render(<StatsPanel agentId="agent-1" />)

    const input = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: '预览分配' }))

    const confirmButton = screen.getByRole('button', { name: '确认分配' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirmButton.disabled).toBe(false)

    fireEvent.click(confirmButton)
    expect(allocateMutate).toHaveBeenCalledTimes(1)
    const payload = allocateMutate.mock.calls[0]?.[0] as {
      allocation: Record<string, number>
      version: number
      confirm_no_respec: true
      idempotency_key: string
    }
    expect(payload.confirm_no_respec).toBe(true)
    expect(payload.version).toBe(7)
    expect(payload.allocation.sociability).toBe(1)
    expect(payload.idempotency_key).toMatch(/^stats-ui-agent-1-/)
  })

  it('invalidates preview when draft changes and forces re-preview', () => {
    const snapshot = buildSnapshot()
    const previewData = buildPreview(snapshot)
    const { previewReset } = setupHooks({ previewData })
    render(<StatsPanel agentId="agent-1" />)

    const input = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: '预览分配' }))
    fireEvent.click(screen.getByRole('checkbox'))

    const confirmButton = screen.getByRole('button', { name: '确认分配' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(false)

    fireEvent.change(input, { target: { value: '2' } })

    expect(previewReset).toHaveBeenCalled()
    expect(confirmButton.disabled).toBe(true)
    expect(screen.getByText('草稿已变更，请重新预览后再提交。')).toBeTruthy()
  })

  it('renders preview summary from preview response', () => {
    const snapshot = buildSnapshot()
    const previewData = buildPreview(snapshot)
    setupHooks({ previewData })
    render(<StatsPanel agentId="agent-1" />)

    expect(screen.getByText(/本次消耗点数/)).toBeTruthy()
    expect(screen.getByText(/提交后剩余/)).toBeTruthy()
    expect(screen.getByText(/预估 talkativeness/)).toBeTruthy()
    expect(screen.getByText(/预估记忆 budget\/topK/)).toBeTruthy()
  })

  it('shows preview and allocate error messages', () => {
    setupHooks({
      previewError: new Error('preview boom'),
      allocateError: new Error('allocate boom'),
    })
    render(<StatsPanel agentId="agent-1" />)

    expect(screen.getByText('预览失败：preview boom')).toBeTruthy()
    expect(screen.getByText('提交失败：allocate boom')).toBeTruthy()
  })
})
