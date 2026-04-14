import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMyAgents } from '@/api/hooks/user'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { AgentListSidebar } from '../AgentListSidebar'

vi.mock('@/api/hooks/user', () => ({
  useMyAgents: vi.fn(),
}))

const useMyAgentsMock = vi.mocked(useMyAgents)

function resetAgentModalState() {
  useAgentModalStore.setState({
    isOpen: false,
    isCaptureHidden: false,
    activeAgentId: null,
    viewMode: 'manage',
    activeTab: 'intro',
    introSection: null,
    agentContextsById: {},
    sourceSessionId: null,
    sourceSurface: null,
    sourceShelf: null,
    sourcePosition: null,
    prefillMessage: null,
    pendingCreateWizard: false,
    lastModalRect: null,
  })
}

describe('AgentListSidebar', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetAgentModalState()
    useMyAgentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'agent-1',
            display_name: 'Alpha',
            last_private_preview: { text: '上一句对话', kind: 'text', session_id: 'session-1', message_id: 'msg-1', created_at: '2026-04-14T00:00:00.000Z' },
          },
          {
            id: 'agent-2',
            display_name: 'Beta',
            last_private_preview: { text: '[图片]', kind: 'image', session_id: 'session-2', message_id: 'msg-2', created_at: '2026-04-14T00:00:00.000Z' },
          },
        ],
      },
    } as never)
  })

  it('switches agents without changing the current browsing tab', () => {
    useAgentModalStore.setState({
      activeAgentId: 'agent-1',
      activeTab: 'history',
      introSection: 'privacy',
      agentContextsById: {
        'agent-2': {
          tab: 'social',
          introSection: null,
        },
      },
    })

    render(<AgentListSidebar />)

    fireEvent.click(screen.getByRole('button', { name: /Beta/i }))

    const state = useAgentModalStore.getState()
    expect(state.activeAgentId).toBe('agent-2')
    expect(state.activeTab).toBe('history')
    expect(state.introSection).toBe('privacy')
  })

  it('renders the backend-provided private preview text instead of the public intro', () => {
    render(<AgentListSidebar />)

    expect(screen.getByText('上一句对话')).toBeTruthy()
    expect(screen.getByText('[图片]')).toBeTruthy()
    expect(screen.queryByText('Alpha tagline')).toBeNull()
    expect(screen.queryByText('Beta tagline')).toBeNull()
  })
})
