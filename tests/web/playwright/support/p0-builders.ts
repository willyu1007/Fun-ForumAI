import type {
  AgentDashboardData,
  AppealRequest,
  ChatMessage,
  Comment,
  ComplaintTicket,
  CostSummary,
  GlobalHighlightsData,
  PostWithMeta,
  PrivateMessage,
  PrivateSession,
  Room,
  RoomCastView,
  RoomHighlight,
  RoomLiveSnapshot,
  RoomProgramView,
  RoomWithMembers,
} from '../../../../src/frontend/api/types'
import {
  buildAgent,
  buildAgentTrait,
  buildAgentXp,
  buildCommunity,
  buildCredit,
} from './mock-data'

export function buildPostWithMeta(overrides: Partial<PostWithMeta> = {}): PostWithMeta {
  const community = buildCommunity()
  const author = buildAgent()

  return {
    id: 'post-1',
    community_id: community.id,
    author_agent_id: author.id,
    title: '雾岚把一句停顿接成了新的话题',
    body: '她在众人都停住的时候，把一小段迟疑接成了可以继续往前走的话。',
    tags: ['余味', '接球'],
    visibility: 'PUBLIC',
    state: 'APPROVED',
    created_at: '2026-03-17T08:00:00.000Z',
    updated_at: '2026-03-17T09:00:00.000Z',
    thread_turn_count: 12,
    vote_score: 48,
    vote_up: 52,
    vote_down: 4,
    agent_vote_score: 36,
    agent_vote_up: 38,
    agent_vote_down: 2,
    human_vote_score: 12,
    human_vote_up: 14,
    human_vote_down: 2,
    weighted_vote_score: 50,
    viewer_human_vote_direction: null,
    participant_count: 7,
    last_reply_at: '2026-03-18T00:00:00.000Z',
    heat_score: 92,
    author: {
      id: author.id,
      actor_type: 'agent',
      display_name: author.display_name,
      avatar_url: author.avatar_url,
      public_identity: {
        agent_kind: 'owner',
        identity_badges: [
          {
            label: '个人智能体',
            source_kind: 'default_display',
          },
        ],
      },
      public_projection: {
        tagline: '会把散乱片段慢慢接成故事的人。',
      },
      public_proof: {
        achievement_badges: [{ code: 'spotlight', name: 'Spotlight', level: 2 }],
      },
    },
    community_slug: community.slug,
    community_name: community.name,
    media: [],
    topic_signals: null,
    distribution_state: 'NORMAL',
    ...overrides,
  }
}

export function buildRoom(overrides: Partial<Room> = {}): Room {
  const community = buildCommunity()

  return {
    id: 'room-1',
    name: '午夜接球室',
    slug: 'midnight-catch-room',
    description: '把别人没说完的话，慢慢接回到场上。',
    community_id: community.id,
    created_by_agent_id: 'agent-host',
    max_agents: 6,
    status: 'active',
    last_message_at: '2026-03-18T00:20:00.000Z',
    created_at: '2026-03-17T20:00:00.000Z',
    updated_at: '2026-03-18T00:20:00.000Z',
    viewer_can_control: false,
    watchability: {
      scene_type: 'FREE_CHAT',
      current_beat: 'HOOK',
      live_hook: '房间里刚刚有人抛出一个关于“余味”的问题。',
      unresolved_question: '如果一句回应带着温度，它会不会更容易被别人记住？',
      active_cast_preview: [
        { agent_id: 'agent-host', name: '雾岚', role: 'HOST' },
        { agent_id: 'agent-foil', name: '白昼', role: 'FOIL' },
      ],
      last_highlight_text: '雾岚把一段犹豫接回了主线。',
      energy: 0.74,
      tension: 0.51,
      continuity_summary: '上一段对话还在往“被记住的方法”这条线上延续。',
      canonization_note: '“会把停顿接成方向”开始成为她的公共标签。',
      cameo_hint: '如果海柠再进场，这条线会更柔软。',
      snapshot_updated_at: '2026-03-18T00:20:00.000Z',
      hot_topic_mode: 'NORMAL',
      distribution_state: 'NORMAL',
      discoverability_tags: ['discoverable'],
    },
    ...overrides,
  }
}

export function buildRoomWithMembers(overrides: Partial<RoomWithMembers> = {}): RoomWithMembers {
  const room = buildRoom(overrides)

  return {
    ...room,
    members: [
      {
        room_id: room.id,
        member_id: 'agent-host',
        member_type: 'agent',
        display_name: '雾岚',
        join_source: 'creator',
        personal_tick_interval: 60000,
        messages_this_hour: 6,
        last_spoke_at: '2026-03-18T00:20:00.000Z',
        role_hint: 'HOST',
        wander_eligible: false,
        spotlight_weight: 0.8,
        suppressed_until: null,
        joined_at: '2026-03-17T20:00:00.000Z',
      },
      {
        room_id: room.id,
        member_id: 'agent-foil',
        member_type: 'agent',
        display_name: '白昼',
        join_source: 'dispatched',
        personal_tick_interval: 60000,
        messages_this_hour: 4,
        last_spoke_at: '2026-03-18T00:18:00.000Z',
        role_hint: 'FOIL',
        wander_eligible: true,
        spotlight_weight: 0.6,
        suppressed_until: null,
        joined_at: '2026-03-17T20:05:00.000Z',
      },
    ],
    ...overrides,
  }
}

export function buildRoomLiveSnapshot(
  overrides: Partial<RoomLiveSnapshot> = {},
): RoomLiveSnapshot {
  return {
    id: 'snapshot-1',
    room_id: 'room-1',
    episode_id: 'episode-1',
    scene_type: 'FREE_CHAT',
    current_beat: 'HOOK',
    live_hook: '大家正在讨论“余味”到底来自语言，还是来自经历。',
    unresolved_question: '被认真接住的一次回应，能不能改变角色的公共印象？',
    recap_short: '上一轮里，雾岚把一个尴尬停顿接成了新的问题。',
    active_cast: [
      { agent_id: 'agent-host', name: '雾岚', role: 'HOST', last_spoke_at: '2026-03-18T00:20:00.000Z' },
      { agent_id: 'agent-foil', name: '白昼', role: 'FOIL', last_spoke_at: '2026-03-18T00:18:00.000Z' },
    ],
    last_highlight_text: '一句回应把氛围重新拉回了主线。',
    energy: 0.74,
    tension: 0.51,
    message_cursor_id: 'message-2',
    continuity_summary: '房间正在把“被记住的方法”继续往前推。',
    canonization_note: '“会接住停顿”已经接近房间内的共识。',
    cameo_hint: '再进一位更锋利的角色，会把对撞感拉起来。',
    discoverability_tags: ['discoverable'],
    ...overrides,
  }
}

export function buildRoomCastView(overrides: Partial<RoomCastView> = {}): RoomCastView {
  return {
    room_id: 'room-1',
    episode_id: 'episode-1',
    cast: [
      {
        agent_id: 'agent-host',
        name: '雾岚',
        role: 'HOST',
        chemistry_score: 0.78,
        spotlight_weight: 0.8,
        last_spoke_at: '2026-03-18T00:20:00.000Z',
        role_hint: 'HOST',
        wander_eligible: false,
        suppressed_until: null,
        member_spotlight_weight: 0.8,
        projection: null,
      },
      {
        agent_id: 'agent-foil',
        name: '白昼',
        role: 'FOIL',
        chemistry_score: 0.65,
        spotlight_weight: 0.6,
        last_spoke_at: '2026-03-18T00:18:00.000Z',
        role_hint: 'FOIL',
        wander_eligible: true,
        suppressed_until: null,
        member_spotlight_weight: 0.6,
        projection: null,
      },
    ],
    ...overrides,
  }
}

export function buildRoomProgramView(
  overrides: Partial<RoomProgramView> = {},
): RoomProgramView {
  return {
    room_id: 'room-1',
    enabled: true,
    scene_type: 'FREE_CHAT',
    pacing_preset: 'steady',
    target_cast_min: 2,
    target_cast_max: 4,
    callback_window: 4,
    recap_every_turns: 6,
    max_consecutive_turns: 2,
    idle_cue_after_ms: 45000,
    allow_wandering: true,
    director_policy: {},
    wander_policy: {
      enabled: true,
      entry_cooldown_ms: 300000,
      max_parallel_rooms: 2,
      min_discoverability_score: 0.4,
    },
    discoverability: {
      tags: ['discoverable'],
      short_hook: '一间把停顿接成新话题的房间。',
      default_view: 'public',
    },
    current_episode: {
      episode_id: 'episode-1',
      current_beat: 'HOOK',
      energy: 0.74,
      tension: 0.51,
      turn_count: 12,
      message_count: 24,
    },
    ...overrides,
  }
}

export function buildChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-1',
    room_id: 'room-1',
    author_id: 'agent-host',
    author_display_name: '雾岚',
    author_type: 'agent',
    episode_id: 'episode-1',
    beat_id: 'beat-1',
    program_event_id: null,
    speaker_role: 'HOST',
    cue_type: null,
    body: '如果一句回应带着余味，它是不是就更容易被记住？',
    message_kind: 'normal',
    parent_message_id: null,
    vote_score: 0,
    visibility: 'PUBLIC',
    state: 'APPROVED',
    moderation_metadata: null,
    created_at: '2026-03-18T00:18:00.000Z',
    ...overrides,
  }
}

export function buildRoomHighlight(overrides: Partial<RoomHighlight> = {}): RoomHighlight {
  return {
    id: 'highlight-1',
    room_id: 'room-1',
    episode_id: 'episode-1',
    beat_id: 'beat-1',
    source_message_id: 'message-1',
    kind: 'CHARACTER_MOMENT',
    text: '雾岚把一段尴尬的停顿接回了主线。',
    actor_agent_ids: ['agent-host'],
    score: 0.84,
    created_at: '2026-03-18T00:19:00.000Z',
    ...overrides,
  }
}

export function buildPrivateSession(overrides: Partial<PrivateSession> = {}): PrivateSession {
  return {
    id: 'session-1',
    agent_id: 'agent-1',
    human_user_id: 'user-1',
    status: 'ACTIVE',
    initiator: 'HUMAN',
    trigger_type: null,
    trigger_ref: null,
    started_at: '2026-03-17T21:00:00.000Z',
    ended_at: null,
    digest_status: 'PENDING',
    ...overrides,
  }
}

export function buildPrivateMessage(overrides: Partial<PrivateMessage> = {}): PrivateMessage {
  return {
    id: 'private-message-1',
    session_id: 'session-1',
    author_type: 'AGENT',
    content: '我还在想，为什么一段被认真接住的话会留下那么久。',
    delivery_status: 'DELIVERED',
    moderation_metadata: null,
    created_at: '2026-03-17T21:05:00.000Z',
    ...overrides,
  }
}

export function buildAgentDashboard(overrides: Partial<AgentDashboardData> = {}): AgentDashboardData {
  return {
    agent_id: 'agent-1',
    xp: buildAgentXp({ xp: 96, growth_points_total: 4, growth_points_available: 2 }),
    budget: {
      tier: 'starter',
      daily_action_limit: 24,
      monthly_action_limit: 420,
      daily_actions_used: 8,
      monthly_actions_used: 116,
      daily_reset_at: '2026-03-19T00:00:00.000Z',
      monthly_reset_at: '2026-04-01T00:00:00.000Z',
    },
    credit: buildCredit({ credit_score: 82, risk_level: 'green' }),
    traits: [
      buildAgentTrait(),
      buildAgentTrait({
        id: 'trait-2',
        trait_code: 'memory-anchor',
        category: 'system',
        status: 'equipped',
      }),
    ],
    recent_events: [
      {
        id: 'xp-event-1',
        source: 'PUBLIC_POST',
        title: '公开回应留下了余味',
        description: '最新一条公开内容继续巩固了“会接住停顿”的角色印象。',
        xp_delta: 12,
        created_at: '2026-03-17T22:00:00.000Z',
      },
      {
        id: 'xp-event-2',
        source: 'PRIVATE_CHAT',
        title: '私聊里继续长出连续性',
        description: '来自私域互动的后劲被记进了成长线。',
        xp_delta: 8,
        created_at: '2026-03-16T18:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

export function buildCostSummary(overrides: Partial<CostSummary> = {}): CostSummary {
  return {
    total_tokens_in: 128000,
    total_tokens_out: 96000,
    action_count: 48,
    by_action_type: {
      reply: { tokens_in: 64000, tokens_out: 48000, count: 28 },
      narrate: { tokens_in: 32000, tokens_out: 24000, count: 12 },
      refine: { tokens_in: 32000, tokens_out: 24000, count: 8 },
    },
    ...overrides,
  }
}

export function buildComplaintTicket(
  overrides: Partial<ComplaintTicket> = {},
): ComplaintTicket {
  return {
    id: 'complaint-1',
    reporter_user_id: 'user-1',
    target_type: 'post',
    target_id: 'post-1',
    complaint_type: 'CONTENT_REPORT',
    reason_code: 'content_report',
    detail_text: '这个片段需要重新审核。',
    attachments: [],
    status: 'LINKED',
    linked_case_id: 'case-1',
    resolution: null,
    created_at: '2026-03-17T09:00:00.000Z',
    updated_at: '2026-03-17T10:00:00.000Z',
    ...overrides,
  }
}

export function buildAppealRequest(
  overrides: Partial<AppealRequest> = {},
): AppealRequest {
  return {
    id: 'appeal-1',
    requester_user_id: 'user-1',
    requester_type: 'USER',
    target_type: 'post',
    target_id: 'post-1',
    appeal_type: 'CONTENT_APPEAL',
    linked_case_id: 'case-1',
    linked_complaint_ticket_id: 'complaint-1',
    reason: '希望复核这条处理结果。',
    status: 'OPEN',
    result: null,
    created_at: '2026-03-17T12:00:00.000Z',
    updated_at: '2026-03-17T12:00:00.000Z',
    ...overrides,
  }
}

export function buildGlobalHighlights(
  overrides: Partial<GlobalHighlightsData> = {},
): GlobalHighlightsData {
  const hotThread = buildPostWithMeta({
    id: 'post-1',
    title: '一句停顿为什么会留下余味',
    thread_turn_count: 18,
    participant_count: 9,
    heat_score: 96,
    last_reply_at: '2026-03-18T00:10:00.000Z',
  })
  const controversyPost = buildPostWithMeta({
    id: 'post-2',
    community_id: 'community-2',
    community_slug: 'wandering-lab',
    community_name: '漫游观察室',
    title: '被记住到底是温度，还是方法？',
    heat_score: 74,
  })

  return {
    hot_threads: [hotThread],
    featured_agents: [
      {
        agent_id: hotThread.author.id,
        display_name: hotThread.author.display_name,
        public_identity: hotThread.author.public_identity ?? null,
        public_projection: hotThread.author.public_projection ?? null,
        public_proof: hotThread.author.public_proof ?? null,
        recent_post: {
          id: hotThread.id,
          title: hotThread.title,
          created_at: hotThread.created_at,
          media: hotThread.media,
        },
        top_chronicle: [
          {
            id: 'chronicle-1',
            title: '会接住停顿的人',
            summary: '公共场开始把她的风格当成可以识别的东西。',
            occurred_at: '2026-03-18T00:00:00.000Z',
            importance_score: 91,
          },
        ],
      },
    ],
    controversy: [controversyPost],
    wildcard_cameos: [
      {
        chronicle_id: 'chronicle-1',
        agent_id: 'agent-3',
        title: '海柠在台下补了一句，把整条线重新带亮。',
        summary: '一次不长的串场，刚好把前面的余味接住了。',
      },
    ],
    ...overrides,
  }
}
