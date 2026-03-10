import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatRoomListPage } from '../ChatRoomListPage'
import { ChatRoomPage } from '../ChatRoomPage'
import {
  useCreateRoomCue,
  useCreateRoom,
  usePatchRoomMemberControl,
  usePatchRoomProgram,
  useRecallAgent,
  useRoom,
  useRoomCast,
  useRoomControlState,
  useRoomHighlights,
  useRoomLiveSnapshot,
  useRoomMessages,
  useRoomProgram,
  useRooms,
  useMyAgents,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { useChatRoomSse } from '../../hooks/use-chat-room-sse'

vi.mock('@/api/hooks', () => ({
  useRooms: vi.fn(),
  useCreateRoom: vi.fn(),
  useCreateRoomCue: vi.fn(),
  usePatchRoomMemberControl: vi.fn(),
  usePatchRoomProgram: vi.fn(),
  useRoom: vi.fn(),
  useRoomMessages: vi.fn(),
  useRoomLiveSnapshot: vi.fn(),
  useRoomCast: vi.fn(),
  useRoomControlState: vi.fn(),
  useRoomProgram: vi.fn(),
  useRoomHighlights: vi.fn(),
  useRecallAgent: vi.fn(),
  useMyAgents: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../hooks/use-chat-room-sse', () => ({
  useChatRoomSse: vi.fn(),
}))

const useRoomsMock = vi.mocked(useRooms)
const useCreateRoomMock = vi.mocked(useCreateRoom)
const useCreateRoomCueMock = vi.mocked(useCreateRoomCue)
const usePatchRoomMemberControlMock = vi.mocked(usePatchRoomMemberControl)
const usePatchRoomProgramMock = vi.mocked(usePatchRoomProgram)
const useRoomMock = vi.mocked(useRoom)
const useRoomMessagesMock = vi.mocked(useRoomMessages)
const useRoomLiveSnapshotMock = vi.mocked(useRoomLiveSnapshot)
const useRoomCastMock = vi.mocked(useRoomCast)
const useRoomControlStateMock = vi.mocked(useRoomControlState)
const useRoomProgramMock = vi.mocked(useRoomProgram)
const useRoomHighlightsMock = vi.mocked(useRoomHighlights)
const useRecallAgentMock = vi.mocked(useRecallAgent)
const useMyAgentsMock = vi.mocked(useMyAgents)
const useAuthMock = vi.mocked(useAuth)
const useChatRoomSseMock = vi.mocked(useChatRoomSse)

describe('chat room pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      isError: false,
    } as never)
    useCreateRoomCueMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    usePatchRoomMemberControlMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    usePatchRoomProgramMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never)
    useRoomControlStateMock.mockReturnValue({
      data: undefined,
    } as never)
    useMyAgentsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never)
  })

  it('renders current beat, continuity note, owner panel and message metadata on ChatRoomPage', () => {
    useAuthMock.mockReturnValue({
      user: { id: 'user1', email: 'user@test.com', role: 'user' },
    } as never)
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
          viewer_can_control: true,
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
          author_id: 'agent-9',
          author_display_name: '历史作者',
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
          continuity_summary: '旧梗已经重新连上主线。',
          canonization_note: '这场夜宵税讨论已经沉淀出公共 canon。',
          cameo_hint: null,
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
          wander_policy: {
            enabled: true,
            entry_cooldown_ms: 180000,
            max_parallel_rooms: 2,
            min_discoverability_score: 0.25,
          },
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
    useRoomControlStateMock.mockReturnValue({
      data: {
        data: {
          room_id: 'room-1',
          room_status: 'active',
          program: {
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
            wander_policy: {
              enabled: true,
              entry_cooldown_ms: 180000,
              max_parallel_rooms: 2,
              min_discoverability_score: 0.25,
            },
            discoverability: {
              tags: [],
              short_hook: '旧梗重新回来了',
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
          snapshot: null,
          cast: [],
          members: [{
            room_id: 'room-1',
            member_id: 'agent-2',
            member_type: 'agent',
            join_source: 'creator',
            personal_tick_interval: 20000,
            messages_this_hour: 1,
            last_spoke_at: '2026-03-10T10:00:01.000Z',
            role_hint: 'FOIL',
            wander_eligible: true,
            spotlight_weight: 1,
            suppressed_until: null,
            joined_at: '2026-03-10T10:00:00.000Z',
            name: 'Foil',
            projection: {
              id: 'proj-1',
              agent_id: 'agent-2',
              scene_affinity_json: { FREE_CHAT: 0.7 },
              banter_style: 'playful',
              conflict_threshold: 0.3,
              callback_habit: 0.8,
              signature_moves_json: ['接住旧梗'],
              disclosure_policy_json: {},
              follow_targets_json: [],
              avoid_targets_json: [],
              role_tendency: 'FOIL',
              spotlight_preference: 'HIGH',
              public_projection_hint: '更适合 FREE_CHAT · 常站 FOIL',
              created_at: '2026-03-10T10:00:00.000Z',
              updated_at: '2026-03-10T10:00:00.000Z',
            },
          }],
          recent_highlights: [],
          recent_program_events: [],
          recent_shared_memory: [],
          alerts: [],
        },
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
    expect(screen.getAllByText('对撞').length).toBeGreaterThan(0)
    expect(screen.getByText('历史作者')).toBeTruthy()
    expect(screen.getByText(/连续性：旧梗已经重新连上主线/)).toBeTruthy()
    expect(screen.getByText('Owner Control')).toBeTruthy()
    expect(screen.getByText('手动 Cue')).toBeTruthy()
    expect(useRoomControlStateMock).toHaveBeenLastCalledWith('room-1', { enabled: true })
  })

  it('keeps owner control query disabled for public viewers', () => {
    useRoomMock.mockReturnValue({
      data: {
        data: {
          id: 'room-1',
          name: '公开房间',
          slug: 'room-1',
          description: '围观用房间',
          community_id: null,
          created_by_agent_id: 'agent-1',
          max_agents: 4,
          status: 'active',
          last_message_at: '2026-03-10T10:00:00.000Z',
          created_at: '2026-03-10T10:00:00.000Z',
          updated_at: '2026-03-10T10:00:00.000Z',
          viewer_can_control: false,
          members: [],
          watchability: null,
        },
      },
      isLoading: false,
    } as never)
    useRoomMessagesMock.mockReturnValue({ data: { data: [] } } as never)
    useRoomLiveSnapshotMock.mockReturnValue({ data: { data: null } } as never)
    useRoomCastMock.mockReturnValue({ data: { data: { room_id: 'room-1', episode_id: null, cast: [] } } } as never)
    useRoomProgramMock.mockReturnValue({
      data: {
        data: {
          room_id: 'room-1',
          enabled: false,
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
          wander_policy: {
            enabled: false,
            entry_cooldown_ms: 180000,
            max_parallel_rooms: 2,
            min_discoverability_score: 0.25,
          },
          discoverability: {
            tags: [],
            short_hook: null,
            default_view: 'live',
          },
          current_episode: null,
        },
      },
    } as never)
    useRoomHighlightsMock.mockReturnValue({ data: { data: [] } } as never)

    render(
      <MemoryRouter initialEntries={['/rooms/room-1']}>
        <Routes>
          <Route path="/rooms/:roomId" element={<ChatRoomPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(useRoomControlStateMock).toHaveBeenLastCalledWith('room-1', { enabled: false })
    expect(screen.queryByText('Owner Control')).toBeNull()
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
            continuity_summary: '旧梗重新接上了主线。',
            canonization_note: '这场讨论已经生成 canon。',
            cameo_hint: null,
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
    expect(screen.getByText(/连续性：旧梗重新接上了主线/)).toBeTruthy()
    expect(screen.getByText(/Canon：这场讨论已经生成 canon/)).toBeTruthy()
  })

  it('creates rooms with a real owned agent id instead of fabricating one from the user id', async () => {
    const mutate = vi.fn()
    useAuthMock.mockReturnValue({
      user: { id: 'dev-user-001', email: 'dev-user@test.com', role: 'user' },
    } as never)
    useRoomsMock.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    } as never)
    useMyAgentsMock.mockReturnValue({
      data: {
        data: [{
          id: 'agent-real-1',
          owner_id: 'dev-user-001',
          display_name: '真实 Agent',
          avatar_url: null,
          model: 'qwen-flash',
          config_json: {},
          status: 'ACTIVE',
          created_at: '2026-03-10T10:00:00.000Z',
          updated_at: '2026-03-10T10:00:00.000Z',
        }],
      },
      isLoading: false,
    } as never)
    useCreateRoomMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    } as never)

    render(
      <MemoryRouter>
        <ChatRoomListPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '创建聊天室' }))
    fireEvent.change(screen.getByPlaceholderText('房间名称'), { target: { value: '真实建房 smoke' } })
    fireEvent.change(screen.getByPlaceholderText('描述（可选）'), { target: { value: '验证 agent 选择' } })

    await waitFor(() => {
      const createButtons = screen.getAllByRole('button', { name: '创建' })
      fireEvent.click(createButtons[createButtons.length - 1]!)
      expect(mutate).toHaveBeenCalledWith(
        {
          name: '真实建房 smoke',
          description: '验证 agent 选择',
          created_by_agent_id: 'agent-real-1',
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      )
    })
  })
})
