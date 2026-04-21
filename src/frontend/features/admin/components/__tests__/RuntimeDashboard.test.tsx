import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RuntimeDashboard } from '../RuntimeDashboard'

const invalidateQueries = vi.fn()
const useQueryMock = vi.fn()
const useMutationMock = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
  useQueryClient: () => ({
    invalidateQueries,
  }),
}))

vi.mock('@/api/hooks', () => ({
  useRuntimeFeatures: () => ({
    data: {
      data: {
        counters: {},
        guidance: {
          flags: {
            guidance_v1: false,
            guidance_recall_v1: false,
          },
          bell: {
            unread_count: 0,
            active_count: 0,
          },
          per_reason: {},
          avg_delivery_delay_ms: null,
          suppression: {
            same_reason_count: 0,
            daily_cap_count: 0,
          },
          teaching_first_violation_count: 0,
        },
        provider_admission: {
          totals: { admitted: 0, shadow: 0, blocked: 0 },
          by_voice_line: [],
        },
      },
    },
  }),
}))

vi.mock('@/api/hooks/admin', () => ({
  useAdminMediaObservability: () => ({ data: null }),
  useAdminMediaRolloutController: () => ({
    data: {
      data: {
        effective_profile: {
          mode: 'AUTO',
          profile: 'conserve',
          reason: 'test',
          effective: {
            target_min_rate: 0.35,
            target_max_rate: 0.45,
            threshold_delta: 0.2,
            allow_generation: true,
            generation_tier: 'low',
            sync_generation_ms_budget: 1000,
            allow_private_runtime_projection: true,
            allow_private_inspired_generation: true,
            force_safe_mode: false,
            semantic_v3_enforced: true,
            strict_audit_enforced: true,
            lineage_required: true,
          },
        },
        active_override: null,
      },
    },
  }),
  usePatchAdminMediaRolloutController: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useReleaseAdminMediaRolloutController: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useRunMediaLifecycle: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
  }),
}))

vi.mock('@/app/sse-context', () => ({
  useSseStatus: () => ({
    connected: true,
    phase: 'connected',
    reconnectAttempts: 0,
    lastEventType: 'connected',
    nextRetryInMs: null,
    lastError: null,
  }),
}))

describe('RuntimeDashboard', () => {
  it('falls back to admin runtime stats when dev runtime status is unavailable', () => {
    useMutationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      data: null,
    })

    useQueryMock.mockImplementation((input: { queryKey: unknown[] }) => {
      const key = input.queryKey[0]
      if (key === 'admin') {
        return {
          data: {
            data: {
              runtime: {
                running: true,
                processing: false,
                queue_size: 0,
                llm_configured: true,
                node_env: 'production',
                baseline_admission: null,
              },
              scheduler: {
                lastPostAt: 0,
                postsToday: 0,
                postMaxPerDay: 50,
                postIntervalMs: 60000,
              },
              sse: {
                connected_clients: 0,
                subscribed_rooms: 0,
                subscribed_sessions: 0,
                broadcast_backend: 'redis',
                broadcast_published: 0,
                broadcast_received: 0,
                broadcast_dropped: 0,
                broadcast_last_error: null,
              },
              event_queue: {
                size: 0,
              },
            },
          },
        }
      }

      return {
        data: {
          data: null,
          meta: {
            disabled: true,
          },
        },
      }
    })

    render(<RuntimeDashboard />)

    expect(useQueryMock.mock.calls[1]?.[0]).toMatchObject({
      queryKey: ['dev', 'runtime-status'],
      enabled: false,
    })
    expect(screen.getByText('运行中')).toBeTruthy()
    expect(screen.getByText('LLM 已配置')).toBeTruthy()
    expect(
      screen.getByText(
        /当前部署未暴露 dev runtime controls；状态已回退为 admin\/runtime\/stats，启动、\s*手动 Tick 与触发发帖按钮在该环境中不可用。/,
      ),
    ).toBeTruthy()
    expect((screen.getByRole('button', { name: '停止 Runtime' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect((screen.getByRole('button', { name: '手动 Tick' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect((screen.getByRole('button', { name: '触发发帖' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})
