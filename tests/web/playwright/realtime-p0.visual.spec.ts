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
  buildChatMessage,
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
})
