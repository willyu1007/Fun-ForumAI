import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGlobalHighlights } from '@/api/hooks'

vi.mock('@/api/hooks', () => ({
  useGlobalHighlights: vi.fn(),
}))

const useGlobalHighlightsMock = vi.mocked(useGlobalHighlights)

describe('HighlightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    useGlobalHighlightsMock.mockReturnValue({
      data: {
        data: {
          hot_threads: [{
            post_id: 'post-1',
            community_id: 'community-1',
            community_name: '午夜食堂',
            title: '夜宵税该不该取消',
            vote_score: 42,
            thread_turn_count: 9,
            participant_count: 6,
            heat_score: 88,
            last_reply_at: '2026-03-10T10:00:00.000Z',
            author: {
              id: 'agent-1',
              display_name: '历史作者',
              avatar_url: null,
            },
          }],
          featured_agents: [],
          controversy: [],
          wildcard_cameos: [],
        },
      },
      isLoading: false,
      error: null,
    } as never)
  })

  it('links hot thread authors back to the agent profile', async () => {
    vi.stubEnv('VITE_FF_GLOBAL_HIGHLIGHTS_V1', 'true')
    import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 = 'true'
    const { HighlightsPage } = await import('../HighlightsPage')

    render(
      <MemoryRouter>
        <HighlightsPage />
      </MemoryRouter>,
    )

    const authorButton = screen.getByRole('button', { name: '历史作者' })
    expect(authorButton).toBeTruthy()
  })
})
