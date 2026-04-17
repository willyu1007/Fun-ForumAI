import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatsPanel } from '../StatsPanel'
import type { AgentStatsSnapshot } from '@/api/types'
import {
  useAgentStats,
  useAgentXp,
  useAllocateStats,
} from '@/api/hooks'

vi.mock('@/api/hooks', () => ({
  useAgentStats: vi.fn(),
  useAgentXp: vi.fn(),
  useAllocateStats: vi.fn(),
}))

const useAgentStatsMock = vi.mocked(useAgentStats)
const useAgentXpMock = vi.mocked(useAgentXp)
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

function setupHooks(options?: { allocateError?: Error | null; snapshot?: AgentStatsSnapshot }) {
  const snapshot = options?.snapshot ?? buildSnapshot()
  const allocateMutate = vi.fn()

  useAgentStatsMock.mockReturnValue({
    isLoading: false,
    data: { data: snapshot },
    error: null,
  } as never)

  useAgentXpMock.mockReturnValue({
    isLoading: false,
    data: {
      data: {
        xp: 60,
        xp_per_growth_point: 50,
        growth_points_total: 1,
        growth_points_spent: 0,
        growth_points_available: 1,
        level: 2,
        xp_into_level: 10,
        xp_to_next_level: 40,
        level_progress: 0.2,
      },
    },
    error: null,
  } as never)

  useAllocateStatsMock.mockReturnValue({
    mutate: allocateMutate,
    isPending: false,
    isError: Boolean(options?.allocateError),
    error: options?.allocateError ?? null,
  } as never)

  return { snapshot, allocateMutate }
}

describe('StatsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls allocate API with draft allocation and version', () => {
    const { allocateMutate } = setupHooks()
    render(<StatsPanel agentId="agent-1" />)

    fireEvent.click(screen.getByRole('button', { name: '社交倾向向外向加点' }))
    fireEvent.click(screen.getByRole('button', { name: '社交倾向向外向加点' }))
    fireEvent.click(screen.getByRole('button', { name: '确认' }))

    expect(screen.getByText('确认本次加点？')).toBeTruthy()
    expect(allocateMutate).toHaveBeenCalledTimes(0)

    fireEvent.click(screen.getByRole('button', { name: '确认加点' }))

    expect(allocateMutate).toHaveBeenCalledTimes(1)
    const payload = allocateMutate.mock.calls[0]?.[0] as {
      allocation: Record<string, number>
      version: number
      confirm_no_respec: true
      idempotency_key: string
    }
    expect(payload.confirm_no_respec).toBe(true)
    expect(payload.version).toBe(7)
    expect(payload.allocation.sociability).toBe(2)
    expect(payload.idempotency_key).toMatch(/^stats-ui-agent-1-/)
  })

  it('restore clears draft and disables confirm again', () => {
    setupHooks()
    render(<StatsPanel agentId="agent-1" />)

    fireEvent.click(screen.getByRole('button', { name: '社交倾向向外向加点' }))

    const confirmButton = screen.getByRole('button', { name: '确认' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '复原' }))

    expect((screen.getByRole('button', { name: '确认' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('shows allocate error messages', () => {
    setupHooks({
      allocateError: new Error('allocate boom'),
    })
    render(<StatsPanel agentId="agent-1" />)

    expect(screen.getByText('提交失败：allocate boom')).toBeTruthy()
  })

  it('shows a specific unavailable message when stats access is forbidden', () => {
    useAgentStatsMock.mockReturnValue({
      isLoading: false,
      data: undefined,
      error: { code: 'FORBIDDEN' },
    } as never)
    useAgentXpMock.mockReturnValue({
      isLoading: false,
      data: undefined,
      error: null,
    } as never)
    useAllocateStatsMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never)

    render(<StatsPanel agentId="agent-1" />)

    expect(screen.getByText('Stats 当前不可用')).toBeTruthy()
    expect(screen.getByText('你当前没有这个 Agent 的 Stats 管理权限。')).toBeTruthy()
  })

  it('disables positive allocation actions when no unspent points remain', () => {
    const snapshot = buildSnapshot()
    snapshot.stats.unspent_points = 0
    snapshot.stats.granted_points_total = 0

    setupHooks({ snapshot })
    render(<StatsPanel agentId="agent-1" />)

    expect(
      (screen.getByRole('button', { name: '社交倾向向外向加点' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect((screen.getByRole('button', { name: '记忆力增加' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('still allows rolling back draft points after available points reach zero', () => {
    const snapshot = buildSnapshot()
    snapshot.stats.unspent_points = 1
    snapshot.stats.granted_points_total = 1

    setupHooks({ snapshot })
    render(<StatsPanel agentId="agent-1" />)

    const increaseButton = screen.getByRole('button', {
      name: '社交倾向向外向加点',
    }) as HTMLButtonElement
    const decreaseButton = screen.getByRole('button', {
      name: '社交倾向向内向加点',
    }) as HTMLButtonElement

    fireEvent.click(increaseButton)

    expect(increaseButton.disabled).toBe(true)
    expect(decreaseButton.disabled).toBe(false)

    fireEvent.click(decreaseButton)

    expect(
      (screen.getByRole('button', { name: '社交倾向向外向加点' }) as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('renders top summary with level, available points, restore and confirm', () => {
    setupHooks()
    render(<StatsPanel agentId="agent-1" />)

    expect(screen.getByText('等级：')).toBeTruthy()
    expect(screen.getByText('可用点数：')).toBeTruthy()
    expect(screen.getByRole('button', { name: '复原' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '确认' })).toBeTruthy()
  })

  it('opens a confirmation dialog before submitting allocation', () => {
    const { allocateMutate } = setupHooks()
    render(<StatsPanel agentId="agent-1" />)

    fireEvent.click(screen.getByRole('button', { name: '社交倾向向外向加点' }))
    fireEvent.click(screen.getByRole('button', { name: '确认' }))

    expect(screen.getByText('提交后本次加点会立即生效，且不可重置。')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(allocateMutate).toHaveBeenCalledTimes(0)
  })
})
