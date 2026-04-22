import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentBiographyBookViewModel } from '@/api/types'
import { BiographyBookPanel } from '../BiographyBookPanel'

const useAgentBiographyBookMock = vi.fn()
const useRecordAgentBiographyReadTelemetryMock = vi.fn()

const authState = {
  user: {
    id: 'owner-1',
  },
}

const modalState = {
  viewMode: 'manage' as 'manage' | 'readonly',
}

vi.mock('@/api/hooks', () => ({
  useAgentBiographyBook: (
    agentId: string,
    params?: { chapter_id?: string } | undefined,
  ) => useAgentBiographyBookMock(agentId, params),
  useRecordAgentBiographyReadTelemetry: (agentId: string) =>
    useRecordAgentBiographyReadTelemetryMock(agentId),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => authState,
}))

vi.mock('@/shared/stores/agent-modal-store', () => ({
  useAgentModalStore: () => modalState,
}))

function buildBook(): AgentBiographyBookViewModel {
  return {
    agent_id: 'agent-1',
    agent_name: '阿澈',
    book: {
      title: '阿澈 编年史',
      subtitle: '人物传记',
      agent_name: '阿澈',
      current_stage: '成形阶段',
      cover_line: '她的变化开始留下纸页一般的折痕。',
      visual_motif: {
        motif_type: 'PAPER',
        intensity: 'MEDIUM',
      },
    },
    current_chapter: {
      chapter_id: 'chapter-1',
      chapter_no: 1,
      title: '第一章 雨夜前的起势',
      subtitle: '关系与表达开始重新分配重心',
      status_label: '已发布',
      epigraph: '她那时真正绕不开的问题，其实是：怎样把热闹接成自己的声音。',
      opening: '她在反复经历里慢慢换了一种活法。',
      body_sections: [
        {
          title: '起势',
          text: '她第一次把公开场里的回声接成了自己的节奏。',
          visual_anchor: '夜场回声',
        },
      ],
      turning_point: {
        title: '转折',
        text: '那一夜之后，她开始把关系视为真正会改变自己的力量。',
      },
      afterword: '后来这股变化沉成了更稳定的表达方式。',
      closing_line: '这一章最后留下来的，是接梗的耐心。',
      trace_text: '这一章的纸边还留着关系线的痕迹。',
      margin_notes: [
        {
          anchor_section_index: 0,
          text: '这条线索后来反复出现。',
        },
      ],
      later_notes: [
        {
          note_id: 'later-note-1',
          text: '后来再看，这一段更早暴露了她正在学会收住锋芒。',
        },
      ],
    },
    chapters: [
      {
        chapter_id: 'chapter-1',
        chapter_no: 1,
        title: '第一章 雨夜前的起势',
        one_line_summary: '她在反复经历里慢慢换了一种活法。',
        status_label: '已发布',
        is_current: true,
      },
      {
        chapter_id: 'chapter-2',
        chapter_no: 2,
        title: '第二章 余温开始回流',
        one_line_summary: '更内里的波动开始反过来改变她的表达。',
        status_label: '补记',
        is_current: false,
      },
    ],
    footer_meta: {
      source_line: '由 chronicle、achievements、relation signals、private digest summary 与 personality narrative 编排。',
      generated_at: '2026-04-21T12:00:00.000Z',
      degraded: false,
    },
  }
}

describe('BiographyBookPanel', () => {
  const telemetryMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    authState.user.id = 'owner-1'
    modalState.viewMode = 'manage'
    useRecordAgentBiographyReadTelemetryMock.mockReturnValue({
      mutate: telemetryMutate,
    })
    useAgentBiographyBookMock.mockReturnValue({
      data: {
        data: buildBook(),
      },
      isLoading: false,
      isError: false,
    })
  })

  it('renders the book cover, persistent table of contents, chapter body and trace text', async () => {
    render(<BiographyBookPanel agentId="agent-1" />)

    expect(screen.getAllByText('阿澈 编年史').length).toBeGreaterThan(0)
    expect(screen.getAllByText('第一章 雨夜前的起势').length).toBeGreaterThan(0)
    expect(screen.getByText('她第一次把公开场里的回声接成了自己的节奏。')).toBeTruthy()
    expect(screen.queryByText(/这一章的纸边还留着关系线的痕迹。/)).toBeNull()

    const toc = screen.getByTestId('biography-toc')
    expect(within(toc).getByTestId('biography-toc-item-1')).toBeTruthy()
    expect(within(toc).getByTestId('biography-toc-item-2')).toBeTruthy()

    expect(screen.getByTestId('biography-page-header').textContent).toContain('第 1 章')
    expect(screen.getByTestId('biography-pager-progress').textContent).toContain('第 1 / 2 章')
    expect(
      (screen.getByTestId('biography-pager-prev') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByTestId('biography-pager-next') as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('fires history_book_opened and history_directory_opened when the book first loads', async () => {
    render(<BiographyBookPanel agentId="agent-1" />)

    await waitFor(() => {
      expect(telemetryMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          chapter_id: 'chapter-1',
          event_type: 'history_book_opened',
          is_owner_view: true,
          payload: {
            source_surface: 'agent_modal_history',
          },
        }),
      )
      expect(telemetryMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          chapter_id: 'chapter-1',
          event_type: 'history_directory_opened',
          is_owner_view: true,
          payload: { chapter_count: 2 },
        }),
      )
    })
  })

  it('tracks chapter revisit via TOC click and later note expansion via sticky-note toggle', async () => {
    render(<BiographyBookPanel agentId="agent-1" />)

    const laterNote = screen.getByTestId('biography-later-note-later-note-1')
    fireEvent.click(laterNote)

    fireEvent.click(screen.getByTestId('biography-toc-item-2'))
    fireEvent.click(screen.getByTestId('biography-toc-item-1'))

    await waitFor(() => {
      expect(telemetryMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          chapter_id: 'chapter-2',
          event_type: 'history_chapter_selected',
          payload: { revisited: false },
        }),
      )
      expect(telemetryMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          chapter_id: 'chapter-1',
          event_type: 'history_chapter_selected',
          payload: { revisited: true },
        }),
      )
      expect(telemetryMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          chapter_id: 'chapter-1',
          event_type: 'history_chapter_revisited',
        }),
      )
      expect(telemetryMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          chapter_id: 'chapter-1',
          event_type: 'history_later_note_opened',
          payload: { note_id: 'later-note-1' },
        }),
      )
    })

    expect(
      screen.getByText('后来再看，这一段更早暴露了她正在学会收住锋芒。'),
    ).toBeTruthy()
  })

  it('advances to next chapter via pager button', async () => {
    render(<BiographyBookPanel agentId="agent-1" />)

    fireEvent.click(screen.getByTestId('biography-pager-next'))

    await waitFor(() => {
      expect(telemetryMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          chapter_id: 'chapter-2',
          event_type: 'history_chapter_selected',
          payload: { revisited: false },
        }),
      )
    })
  })
})
