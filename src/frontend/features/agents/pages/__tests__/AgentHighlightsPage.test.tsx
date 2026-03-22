import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AgentHighlightsPage } from '../AgentHighlightsPage'
import { useAgentHighlights, useAgentProfile } from '@/api/hooks'

vi.mock('@/api/hooks', () => ({
  useAgentProfile: vi.fn(),
  useAgentHighlights: vi.fn(),
}))

const useAgentProfileMock = vi.mocked(useAgentProfile)
const useAgentHighlightsMock = vi.mocked(useAgentHighlights)

function renderPage(path = '/agents/agent-1/highlights') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agents/:agentId/highlights" element={<AgentHighlightsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AgentHighlightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'owner-1',
          display_name: 'Agent One',
        },
      },
      isLoading: false,
      error: null,
    } as never)
  })

  it('renders public chronicle visuals from the highlights contract', () => {
    useAgentHighlightsMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          badges: [{ code: 'spotlight', name: 'Spotlight', tier: 2 }],
          tagline: '公开场合总能接住梗。',
          top_chronicle: [
            {
              id: 'chronicle-1',
              title: '第一次把梗接成梗',
              summary: '它把观众抛出来的梗接住了。',
              occurred_at: '2026-03-10T00:00:00.000Z',
              importance_score: 0.8,
              visual: {
                asset_id: 'asset-1',
                media_url: 'https://example.com/chronicle-1.jpg',
                mime_type: 'image/jpeg',
                width: 1600,
                height: 900,
                alt_text: '公开编年史缩略图',
                public_caption: '从回梗现场截下来的缩略图',
                slot: 0,
                display_variant: 'original',
              },
            },
          ],
        },
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage()

    expect(screen.getByText('Agent One 的公开高光')).toBeTruthy()
    expect(screen.getByText('Spotlight T2')).toBeTruthy()
    expect(screen.getByText('公开场合总能接住梗。')).toBeTruthy()
    expect(screen.getByText('第一次把梗接成梗')).toBeTruthy()
    expect(screen.getByRole('img', { name: '公开编年史缩略图' }).getAttribute('src')).toBe(
      'https://example.com/chronicle-1.jpg',
    )
    expect(useAgentHighlightsMock).toHaveBeenCalledWith('agent-1', true)
  })

  it('renders an empty state when no public highlights are available', () => {
    useAgentHighlightsMock.mockReturnValue({
      data: {
        data: {
          agent_id: 'agent-1',
          badges: [],
          tagline: null,
          top_chronicle: [],
        },
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage()

    expect(screen.getByText('暂无公开高光')).toBeTruthy()
    expect(screen.getByText('该角色暂时还没有足够稳定的公开高光摘要。')).toBeTruthy()
  })
})
