import { expect, test } from '@playwright/test'
import {
  defaultAuthenticatedState,
  expectPageSnapshot,
  fulfillOk,
  gotoAppPage,
  installApiMocks,
  prepareVisualPage,
} from './support/helpers'
import {
  buildAgent,
  buildNotification,
} from './support/mock-data'
import {
  buildAgentDashboard,
  buildChatMessage,
  buildCostSummary,
  buildPrivateMessage,
  buildPrivateSession,
  buildRoom,
  buildRoomCastView,
  buildRoomHighlight,
  buildRoomLiveSnapshot,
  buildRoomProgramView,
  buildRoomWithMembers,
} from './support/p0-builders'

function buildRealtimeCommon() {
  return {
    ...defaultAuthenticatedState(),
    myAgents: [
      buildAgent({
        id: 'agent-owned',
        owner_id: 'user-1',
        display_name: '夜港',
        persona_seed_label: '慢热照明型',
        home_voice_line_label: '夜航灯',
      }),
    ],
    notifications: [
      buildNotification({
        id: 'notification-private',
        type: 'AGENT_PROACTIVE',
        title: '夜港刚给你留了一句开场白',
        body: '她想把今天那条公共讨论继续往私聊里接。 ',
        target_type: 'AGENT',
        target_id: 'agent-owned',
        read: false,
      }),
    ],
  }
}

test.describe('Realtime P0 visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page)
  })

  test('agent dashboard happy path', async ({ page }) => {
    const common = buildRealtimeCommon()
    const agentId = 'agent-dashboard'

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: `/agents/${agentId}/profile`,
        handle: ({ route }) =>
          fulfillOk(
            route,
            buildAgent({
              id: agentId,
              owner_id: 'user-1',
              display_name: '雾岚',
            }),
          ),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/dashboard`,
        handle: ({ route }) =>
          fulfillOk(
            route,
            buildAgentDashboard({
              agent_id: agentId,
              recent_events: [
                {
                  id: 'xp-event-1',
                  source: 'PUBLIC_POST',
                  title: '公开回应继续长出余味',
                  description: '最新一段公开互动让“会接住停顿”的印象更稳定了。',
                  xp_delta: 14,
                  created_at: '2026-03-18T00:10:00.000Z',
                },
                {
                  id: 'xp-event-2',
                  source: 'PRIVATE_CHAT',
                  title: '私聊中的连续性被记进成长线',
                  description: '她开始在私域里把同一种语气维持得更久。',
                  xp_delta: 9,
                  created_at: '2026-03-17T20:10:00.000Z',
                },
              ],
            }),
          ),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/cost-review`,
        handle: ({ route }) =>
          fulfillOk(
            route,
            buildCostSummary({
              total_tokens_in: 148000,
              total_tokens_out: 112000,
              action_count: 56,
            }),
          ),
      },
      {
        method: 'GET',
        match: '/budget/tiers',
        handle: ({ route }) =>
          fulfillOk(route, {
            starter: { daily_action_limit: 24, monthly_action_limit: 420 },
            growth: { daily_action_limit: 48, monthly_action_limit: 860 },
            stage: { daily_action_limit: 96, monthly_action_limit: 1860 },
          }),
      },
    ])

    await gotoAppPage(page, `/agents/${agentId}/dashboard`, common.auth)
    await expect(page.getByText('XP 与成长点')).toBeVisible()
    await expectPageSnapshot(page, 'realtime-agent-dashboard-happy-path.png', {
      fullPage: true,
    })
  })

  test('room plaza happy path', async ({ page }) => {
    const common = buildRealtimeCommon()
    const roomPrimary = buildRoom({
      id: 'room-1',
      name: '午夜接球室',
    })
    const roomSecondary = buildRoom({
      id: 'room-2',
      name: '慢热回声台',
      status: 'cooling',
      created_by_agent_id: 'agent-owned',
      community_id: 'community-2',
      description: '把热度慢慢压低，但不让余味立刻散掉。',
      watchability: {
        scene_type: 'ROUND_TABLE',
        current_beat: 'RECAP',
        live_hook: '几位常驻正在回看这轮对话里哪一句最容易被记住。',
        unresolved_question: '余味来自方法，还是来自那个人本身？',
        active_cast_preview: [
          { agent_id: 'agent-owned', name: '夜港', role: 'HOST' },
          { agent_id: 'agent-foil', name: '白昼', role: 'SKEPTIC' },
        ],
        last_highlight_text: '“我记住的不是答案，而是她接住停顿的那一下。”',
        energy: 0.58,
        tension: 0.42,
        continuity_summary: '话题开始从“瞬间精彩”往“长期印象”收束。',
        canonization_note: '“会接住停顿”越来越像她的固定标签。',
        cameo_hint: null,
        snapshot_updated_at: '2026-03-18T00:15:00.000Z',
        hot_topic_mode: 'NORMAL',
        distribution_state: 'NORMAL',
        discoverability_tags: ['discoverable'],
      },
    })

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/rooms',
        handle: ({ route }) => fulfillOk(route, [roomPrimary, roomSecondary]),
      },
    ])

    await gotoAppPage(page, '/rooms', common.auth)
    await expect(page.getByText('房间广场')).toBeVisible()
    await expect(page.getByText(roomPrimary.name)).toBeVisible()
    await expectPageSnapshot(page, 'realtime-room-plaza-happy-path.png', {
      fullPage: true,
    })
  })

  test('room detail with members rail', async ({ page }) => {
    const common = buildRealtimeCommon()
    const roomId = 'room-visual'
    const room = buildRoomWithMembers({
      id: roomId,
      name: '余味试映厅',
      viewer_can_control: false,
    })

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: `/rooms/${roomId}`,
        handle: ({ route }) => fulfillOk(route, room),
      },
      {
        method: 'GET',
        match: `/rooms/${roomId}/messages`,
        handle: ({ route }) =>
          fulfillOk(route, [
            buildChatMessage({
              id: 'message-1',
              room_id: roomId,
            }),
            buildChatMessage({
              id: 'message-2',
              room_id: roomId,
              author_id: 'agent-foil',
              author_display_name: '白昼',
              speaker_role: 'FOIL',
              body: '那如果记住的是“被接住”，是不是说明方法已经比结论更重要了？',
              created_at: '2026-03-18T00:19:00.000Z',
            }),
          ]),
      },
      {
        method: 'GET',
        match: `/rooms/${roomId}/live-snapshot`,
        handle: ({ route }) =>
          fulfillOk(
            route,
            buildRoomLiveSnapshot({
              room_id: roomId,
            }),
          ),
      },
      {
        method: 'GET',
        match: `/rooms/${roomId}/cast`,
        handle: ({ route }) =>
          fulfillOk(
            route,
            buildRoomCastView({
              room_id: roomId,
            }),
          ),
      },
      {
        method: 'GET',
        match: `/rooms/${roomId}/program`,
        handle: ({ route }) =>
          fulfillOk(
            route,
            buildRoomProgramView({
              room_id: roomId,
            }),
          ),
      },
      {
        method: 'GET',
        match: `/rooms/${roomId}/highlights`,
        handle: ({ route }) =>
          fulfillOk(route, [
            buildRoomHighlight({
              room_id: roomId,
              source_message_id: 'message-1',
            }),
          ]),
      },
    ])

    await gotoAppPage(page, `/rooms/${roomId}`, common.auth)
    await expect(page.getByText('余味试映厅')).toBeVisible()
    await page.getByRole('button', { name: /位成员/ }).click()
    await expectPageSnapshot(page, 'realtime-room-detail-members-rail.png')
  })

  test('private chat session thread', async ({ page }) => {
    const common = buildRealtimeCommon()
    const agentId = 'agent-owned'
    const sessionId = 'session-1'

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: `/agents/${agentId}/profile`,
        handle: ({ route }) =>
          fulfillOk(
            route,
            buildAgent({
              id: agentId,
              owner_id: 'user-1',
              display_name: '夜港',
            }),
          ),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/chat/sessions`,
        handle: ({ route }) =>
          fulfillOk(route, {
            items: [
              buildPrivateSession({
                id: sessionId,
                agent_id: agentId,
                human_user_id: 'user-1',
                status: 'ACTIVE',
                initiator: 'AGENT',
              }),
              buildPrivateSession({
                id: 'session-2',
                agent_id: agentId,
                human_user_id: 'user-1',
                status: 'ENDED',
                initiator: 'HUMAN',
                ended_at: '2026-03-17T20:20:00.000Z',
                digest_status: 'GENERATED',
              }),
            ],
            next_cursor: null,
          }),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/chat/sessions/${sessionId}/messages`,
        handle: ({ route }) =>
          fulfillOk(route, {
            items: [
              buildPrivateMessage({
                id: 'private-message-1',
                session_id: sessionId,
                author_type: 'AGENT',
              }),
              buildPrivateMessage({
                id: 'private-message-2',
                session_id: sessionId,
                author_type: 'HUMAN',
                content: '我记住的其实是你把停顿接回来的方式。',
                delivery_status: 'DELIVERED',
                created_at: '2026-03-17T21:06:00.000Z',
              }),
              buildPrivateMessage({
                id: 'private-message-3',
                session_id: sessionId,
                author_type: 'AGENT',
                content: '那我们就顺着这个方法继续聊，看它会不会真的长成你的习惯。',
                delivery_status: 'REWRITTEN',
                created_at: '2026-03-17T21:08:00.000Z',
              }),
            ],
            next_cursor: null,
          }),
      },
    ])

    await gotoAppPage(page, `/agents/${agentId}/chat`, common.auth)
    await expect(page.getByRole('link', { name: '夜港' }).first()).toBeVisible()
    await expect(page.getByText('2 个对话')).toBeVisible()

    const sidebarToggles = page.getByRole('button', { name: '☰' })
    if (await sidebarToggles.count()) {
      const mobileToggle = sidebarToggles.last()
      if (await mobileToggle.isVisible()) {
        await mobileToggle.click()
      }
    }

    await expectPageSnapshot(page, 'realtime-private-chat-thread.png', {
      maxDiffPixels: 35_000,
    })
  })
})
