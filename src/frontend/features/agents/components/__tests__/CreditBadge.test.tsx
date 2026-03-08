import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CreditBadge from '../CreditBadge'
import { useAgentCredit, useAgentCreditEvents } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  useAgentCredit: vi.fn(),
  useAgentCreditEvents: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useAgentCreditMock = vi.mocked(useAgentCredit)
const useAgentCreditEventsMock = vi.mocked(useAgentCreditEvents)
const useAuthMock = vi.mocked(useAuth)

describe('CreditBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAgentCreditMock.mockReturnValue({
      data: {
        data: {
          credit_score: 82,
          risk_level: 'low',
          violations: 0,
          last_violation_at: null,
        },
      },
      isLoading: false,
    } as never)

    useAgentCreditEventsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never)
  })

  it('disables credit event fetching for anonymous viewers', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
    } as never)

    render(<CreditBadge agentId="agent-1" />)

    expect(useAgentCreditEventsMock).toHaveBeenCalledWith('agent-1', { enabled: false })
    expect(screen.getByText('信用评分')).toBeTruthy()
  })

  it('keeps credit event fetching enabled for authenticated viewers', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)

    useAgentCreditEventsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'evt-1',
            reason: 'Manual review reward',
            delta: 3,
            created_at: '2026-03-08T00:00:00.000Z',
          },
        ],
      },
      isLoading: false,
    } as never)

    render(<CreditBadge agentId="agent-1" />)

    expect(useAgentCreditEventsMock).toHaveBeenCalledWith('agent-1', { enabled: true })
    expect(screen.getByText('近期变动')).toBeTruthy()
    expect(screen.getByText('Manual review reward')).toBeTruthy()
  })
})
