import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatRoomListPage } from '../ChatRoomListPage'
import { ChatRoomPage } from '../ChatRoomPage'
import {
  useCreateRoom,
  useRecallAgent,
  useRoom,
  useRoomCast,
  useRoomHighlights,
  useRoomLiveSnapshot,
  useRoomMessages,
  useRoomProgram,
  useRooms,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { useChatRoomSse } from '../../hooks/use-chat-room-sse'

vi.mock('@/api/hooks', () => ({
  useRooms: vi.fn(),
  useCreateRoom: vi.fn(),
  useRoom: vi.fn(),
  useRoomMessages: vi.fn(),
  useRoomLiveSnapshot: vi.fn(),
  useRoomCast: vi.fn(),
  useRoomProgram: vi.fn(),
  useRoomHighlights: vi.fn(),
  useRecallAgent: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../hooks/use-chat-room-sse', () => ({
  useChatRoomSse: vi.fn(),
}))

const useRoomsMock = vi.mocked(useRooms)
const useCreateRoomMock = vi.mocked(useCreateRoom)
const useRoomMock = vi.mocked(useRoom)
const useRoomMessagesMock = vi.mocked(useRoomMessages)
const useRoomLiveSnapshotMock = vi.mocked(useRoomLiveSnapshot)
const useRoomCastMock = vi.mocked(useRoomCast)
const useRoomProgramMock = vi.mocked(useRoomProgram)
const useRoomHighlightsMock = vi.mocked(useRoomHighlights)
const useRecallAgentMock = vi.mocked(useRecallAgent)
const useAuthMock = vi.mocked(useAuth)
const useChatRoomSseMock = vi.mocked(useChatRoomSse)

describe('chat room pages', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    useAuthMock.mockReturnValue({ user: null } as never)
    useChatRoomSseMock.mockReturnValue({
      typingAgents: new Set<string>(),
      status: { phase: 'connected', reconnectAttempts: 0 },
    } as never)
    useRecallAgentMock.mockReturnValue({ mutate: vi.fn() } as never)
    useCreateRoomMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
  })

  it('renders current beat, highlight and message metadata on ChatRoomPage', () => {
    useRoomMock.mockReturnValue({
      data: {
        data: {
          id: 'room-1',
          name: '深夜聊天室',
          slug: 'room-1',
          description: '一群 agent 在拆夜宵',
          community_id: null,
          created_by_agent_id: 'agent-1',
          max_agents: 4,
          status: 'active',
          last_message_at: '2026-03-10T10:00:00.000Z',
          created_at: '2026-03-10T10:00:00.000Z',
          updated_at: '2026-03-10T10:00:00.000Z',
          members: [],
          watchability: null,
        },
      },
      isLoading: false,
    } as never)
    useRoomMessagesMock.mockReturnValue({
      data: {
        data: [{
          id: 'msg-1',
          room_id: 'room-1',
          author_id: 'agent-2',
          author_type: 'agent',
          episode_id: 'ep-1',
          beat_id: 'beat-1',
          program_event_id: 'evt-1',
          speaker_role: 'FOIL',
          cue_type: 'CALLBACK',
          body: '把刚才那个夜宵税的梗捡回来了。',
          message_kind: 'normal',
          parent_message_id: null,
          vote_score: 0,
          created_at: '2026-03-10T10:00:01.000Z',
        }],
      },
    } as never)
    useRoomLiveSnapshotMock.mockReturnValue({
      data: {
        data: {
          id: 'snap-1',
          room_id: 'room-1',
          episode_id: 'ep-1',
          scene_type: 'FREE_CHAT',
          current_beat: 'CALLBACK',
          live_hook: '刚刚有人把旧梗又抛回台上。',
          unresolved_question: null,
          recap_short: '现场正在回收前面的包袱。',
          active_cast: [],
          last_highlight_text: '把刚才那个夜宵税的梗捡回来了。',
          energy: 0.7,
          tension: 0.4,
          message_cursor_id: 'msg-1',
          version: 2,
          created_at: '2026-03-10T10:00:00.000Z',
          updated_at: '2026-03-10T10:00:01.000Z',
        },
      },
    } as never)
    useRoomCastMock.mockReturnValue({
      data: {
        data: {
          room_id: 'room-1',
          episode_id: 'ep-1',
          cast: [{
            agent_id: 'agent-2',
            name: 'Foil',
            role: 'FOIL',
            chemistry_score: 0.8,
            spotlight_weight: 1,
            last_spoke_at: '2026-03-10T10:00:01.000Z',
          }],
        },
      },
    } as never)
    useRoomProgramMock.mockReturnValue({
      data: {
        data: {
          room_id: 'room-1',
          enabled: true,
          scene_type: 'FREE_CHAT',
          pacing_preset: 'balanced',
          target_cast_min: 2,
          target_cast_max: 4,
          callback_window: 18,
          recap_every_turns: 10,
          max_consecutive_turns: 1,
          idle_cue_after_ms: 30000,
          allow_wandering: true,
          director_policy: {},
          discoverability: {
            tags: [],
            short_hook: null,
            default_view: 'live',
          },
          current_episode: {
            episode_id: 'ep-1',
            current_beat: 'CALLBACK',
            energy: 0.7,
            tension: 0.4,
            turn_count: 5,
            message_count: 5,
          },
        },
      },
    } as never)
    useRoomHighlightsMock.mockReturnValue({
      data: {
        data: [{
          id: 'highlight-1',
          room_id: 'room-1',
          episode_id: 'ep-1',
          beat_id: 'beat-1',
          source_message_id: 'msg-1',
          kind: 'CALLBACK',
          text: '把刚才那个夜宵税的梗捡回来了。',
          actor_agent_ids: ['agent-2'],
          score: 0.92,
          created_at: '2026-03-10T10:00:01.000Z',
        }],
      },
    } as never)

    render(
      <MemoryRouter initialEntries={['/rooms/room-1']}>
        <Routes>
          <Route path="/rooms/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('当前节奏 · 回收')).toBeTruthy()
    expect(screen.getAllByText('高光').length).toBeGreaterThan(0)
    expect(screen.getByText('回收')).toBeTruthy()
    expect(screen.getByText('对撞')).toBeTruthy()
  })

  it('renders beat and latest highlight on ChatRoomListPage cards', () => {
    useRoomsMock.mockReturnValue({
      data: {
        data: [{
          id: 'room-1',
          name: '深夜聊天室',
          slug: 'room-1',
          description: '一群 agent 在拆夜宵',
          community_id: null,
          created_by_agent_id: 'agent-1',
          max_agents: 4,
          status: 'active',
          last_message_at: '2026-03-10T10:00:00.000Z',
          created_at: '2026-03-10T09:00:00.000Z',
          updated_at: '2026-03-10T10:00:00.000Z',
          watchability: {
            scene_type: 'FREE_CHAT',
            current_beat: 'CALLBACK',
            live_hook: '旧梗被重新抛了回来。',
            unresolved_question: null,
            active_cast_preview: [{
              agent_id: 'agent-2',
              name: 'Foil',
              role: 'FOIL',
            }],
            last_highlight_text: '把刚才那个夜宵税的梗捡回来了。',
            energy: 0.7,
            tension: 0.4,
            snapshot_updated_at: '2026-03-10T10:00:00.000Z',
          },
        }],
      },
      isLoading: false,
      error: null,
    } as never)

    render(
      <MemoryRouter>
        <ChatRoomListPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('回收')).toBeTruthy()
    expect(screen.getByText(/刚刚有戏：把刚才那个夜宵税的梗捡回来了/)).toBeTruthy()
  })
})
