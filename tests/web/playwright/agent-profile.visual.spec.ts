import { expect, test } from '@playwright/test'
import {
  createDeferred,
  expectPageSnapshot,
  fulfillError,
  fulfillOk,
  gotoAppPage,
  installApiMocks,
  prepareVisualPage,
} from './support/helpers'
import {
  buildAgent,
  buildAgentRun,
  buildAgentTrait,
  buildAgentXp,
  buildCredit,
  buildCreditEvent,
  buildOwnerLifeOverview,
  buildTraitDefinition,
  buildUser,
} from './support/mock-data'

function buildSpectatorCommon() {
  return {
    auth: {
      user: buildUser({
        id: 'spectator-1',
        email: 'spectator@example.com',
        displayName: 'Spectator Snow',
      }),
    },
    communities: undefined,
    myAgents: [],
    notifications: [],
  }
}

function buildOwnerCommon() {
  return {
    auth: {
      user: buildUser({
        id: 'owner-1',
        email: 'owner@example.com',
        displayName: 'Owner Echo',
      }),
    },
    communities: undefined,
    myAgents: [],
    notifications: [],
  }
}

test.describe('AgentProfilePage visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page)
  })

  test('loading state', async ({ page }) => {
    const gate = createDeferred()
    const common = buildSpectatorCommon()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents/agent-loading/profile',
        handle: async ({ route }) => {
          await gate.promise
          await fulfillOk(route, buildAgent({ id: 'agent-loading', display_name: '加载中的雾岚' }))
        },
      },
      {
        method: 'GET',
        match: '/agents/agent-loading/xp',
        handle: ({ route }) => fulfillOk(route, buildAgentXp()),
      },
      {
        method: 'GET',
        match: '/agents/agent-loading/traits',
        handle: ({ route }) => fulfillOk(route, [buildAgentTrait()]),
      },
      {
        method: 'GET',
        match: '/trait-definitions',
        handle: ({ route }) => fulfillOk(route, [buildTraitDefinition()]),
      },
      {
        method: 'GET',
        match: '/agents/agent-loading/credit',
        handle: ({ route }) => fulfillOk(route, buildCredit()),
      },
      {
        method: 'GET',
        match: '/agents/agent-loading/credit-events',
        handle: ({ route }) => fulfillOk(route, [buildCreditEvent()]),
      },
    ])

    await gotoAppPage(page, '/agents/agent-loading', common.auth)
    await expect(page.getByTestId('agent-profile-loading')).toBeVisible()
    await expectPageSnapshot(page, 'agent-profile-loading.png')

    gate.resolve()
  })

  test('error state', async ({ page }) => {
    const common = buildSpectatorCommon()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents/missing-agent/profile',
        handle: ({ route }) => fulfillError(route, 404, 'AGENT_NOT_FOUND', 'agent not found'),
      },
      {
        method: 'GET',
        match: '/agents/missing-agent/xp',
        handle: ({ route }) => fulfillOk(route, buildAgentXp()),
      },
    ])

    await gotoAppPage(page, '/agents/missing-agent', common.auth)
    await expect(page.getByTestId('agent-profile-error')).toBeVisible()
    await expectPageSnapshot(page, 'agent-profile-error.png')
  })

  test('spectator happy path', async ({ page }) => {
    const common = buildSpectatorCommon()
    const agent = buildAgent({
      id: 'agent-spectator',
      owner_id: 'owner-1',
      display_name: '雾岚',
      is_followed: true,
      personality_narrative: {
        summary: '她开始像一个会把犹豫接成方向的人。',
        bullets: [
          '最近两次公开回应都保留了温度，但不再拖长。',
          '会在别人停顿的地方补上一句能继续聊下去的话。',
        ],
        growthNote: '现在更适合给她一个能被陌生人看见的公共场景。',
        stageNote: '从“被看到”继续往“被记住”推进。',
        migrationNote: null,
      },
    })

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents/agent-spectator/profile',
        handle: ({ route }) => fulfillOk(route, agent),
      },
      {
        method: 'GET',
        match: '/agents/agent-spectator/xp',
        handle: ({ route }) =>
          fulfillOk(route, buildAgentXp({ xp: 72, growth_points_total: 3, growth_points_available: 2 })),
      },
      {
        method: 'GET',
        match: '/agents/agent-spectator/traits',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildAgentTrait(),
            buildAgentTrait({
              id: 'trait-system',
              trait_code: 'memory-anchor',
              category: 'system',
              status: 'equipped',
            }),
          ]),
      },
      {
        method: 'GET',
        match: '/trait-definitions',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildTraitDefinition(),
            buildTraitDefinition({
              code: 'memory-anchor',
              emoji: '🧷',
              name: '记忆锚点',
              category: 'system',
              promptFragment: '把关键互动留成稳定纹理。',
            }),
          ]),
      },
      {
        method: 'GET',
        match: '/agents/agent-spectator/credit',
        handle: ({ route }) => fulfillOk(route, buildCredit({ credit_score: 86 })),
      },
      {
        method: 'GET',
        match: '/agents/agent-spectator/credit-events',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildCreditEvent(),
            buildCreditEvent({
              id: 'credit-event-2',
              delta: 4,
              reason: '连续两次公开互动保持稳定余味',
              created_at: '2026-03-17T12:00:00.000Z',
            }),
          ]),
      },
    ])

    await gotoAppPage(page, '/agents/agent-spectator', common.auth)
    await expect(page.getByTestId('agent-profile-summary')).toBeVisible()
    await expect(page.getByTestId('agent-profile-narrative')).toBeVisible()
    await expectPageSnapshot(page, 'agent-profile-spectator-happy-path.png')
  })

  test('owner happy path', async ({ page }) => {
    const common = buildOwnerCommon()
    const agent = buildAgent({
      id: 'agent-owner',
      owner_id: 'owner-1',
      display_name: '雾岚',
      is_followed: false,
    })

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents/agent-owner/profile',
        handle: ({ route }) => fulfillOk(route, agent),
      },
      {
        method: 'GET',
        match: '/agents/agent-owner/xp',
        handle: ({ route }) => fulfillOk(route, buildAgentXp({ xp: 91, growth_points_total: 4 })),
      },
      {
        method: 'GET',
        match: '/agents/agent-owner/runs',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildAgentRun({ agent_id: 'agent-owner' }),
            buildAgentRun({
              id: 'run-2',
              agent_id: 'agent-owner',
              created_at: '2026-03-16T10:00:00.000Z',
              token_cost: 146,
            }),
          ]),
      },
      {
        method: 'GET',
        match: '/private/agents/agent-owner/life-overview',
        handle: ({ route }) => fulfillOk(route, buildOwnerLifeOverview('agent-owner')),
      },
    ])

    await gotoAppPage(page, '/agents/agent-owner', common.auth)
    await expect(page.getByTestId('agent-profile-summary')).toBeVisible()
    await expect(page.getByText('此刻')).toBeVisible()
    await expectPageSnapshot(page, 'agent-profile-owner-happy-path.png')
  })

  test('long-content and multi-tag state', async ({ page }) => {
    const common = buildSpectatorCommon()
    const agent = buildAgent({
      id: 'agent-long',
      display_name: '超长叙事余波观察与回声拼接联合体',
      identity_contract: {
        source: 'contract_v1',
        persona_seed_code: 'philosopher',
        persona_seed_label: '长文思辨型',
        home_voice_line_id: 'voice-long',
        home_voice_line_label: '把复杂情绪慢慢铺平的长回声',
        owner_style_pins: {
          formality: 4,
          verbosity: 5,
          mood: 'steady',
          habits: ['先接住情绪', '会在停顿处续上一句', '习惯把散乱线索织回故事里'],
          forum_activity: 4,
          interests: [
            '电影配乐',
            '城市夜路',
            '长谈',
            '人物观察',
            '舞台幕间',
            '慢节奏旅行',
            '纪录片',
            '旧照片',
            '街头声音',
          ],
        },
        visible_persona: {
          name: '超长叙事余波观察与回声拼接联合体',
          style: '像一个会把别人话里的停顿、迟疑和余味都轻轻收拢起来，再慢慢铺成整段情绪曲线的人。',
          interests: ['电影配乐', '城市夜路', '长谈', '人物观察', '舞台幕间', '慢节奏旅行'],
          language: 'zh-CN',
        },
      },
      personality_narrative: {
        summary: '她已经不再只是接住情绪，而是会把整段气氛保存下来。',
        bullets: [
          '最近的每一次回应都像先把空气里的犹豫拢住，再慢慢把话铺开。',
          '别人说到一半停住时，她会补上的不是信息，而是一种可以继续往前走的情绪方向。',
          '开始出现多段长句，但仍能保留节奏感，不会散成纯粹堆砌。',
        ],
        growthNote: '现在适合给她更长、更复杂但仍真实的互动场景。',
        stageNote: '从“有风格”继续走向“有连续性”。',
        migrationNote: '这类长内容尤其需要视觉回归兜底，避免标题、标签和说明区在窄屏里漂移。',
      },
      created_at: '2026-03-08T00:00:00.000Z',
    })

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents/agent-long/profile',
        handle: ({ route }) => fulfillOk(route, agent),
      },
      {
        method: 'GET',
        match: '/agents/agent-long/xp',
        handle: ({ route }) =>
          fulfillOk(route, buildAgentXp({ xp: 128, growth_points_total: 6, growth_points_available: 3 })),
      },
      {
        method: 'GET',
        match: '/agents/agent-long/traits',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildAgentTrait(),
            buildAgentTrait({
              id: 'trait-2',
              trait_code: 'slow-burn-echo',
              acquired_at: '2026-03-12T00:00:00.000Z',
            }),
          ]),
      },
      {
        method: 'GET',
        match: '/trait-definitions',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildTraitDefinition(),
            buildTraitDefinition({
              code: 'slow-burn-echo',
              emoji: '🌫️',
              name: '慢燃回声',
              category: 'adjustable',
              promptFragment: '保留余味，但不把句子写散。',
            }),
          ]),
      },
      {
        method: 'GET',
        match: '/agents/agent-long/credit',
        handle: ({ route }) =>
          fulfillOk(route, buildCredit({ credit_score: 79, risk_level: 'medium' })),
      },
      {
        method: 'GET',
        match: '/agents/agent-long/credit-events',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildCreditEvent({ delta: 8, reason: '长内容表达依旧保持可读性' }),
            buildCreditEvent({
              id: 'credit-event-2',
              delta: -2,
              reason: '一次长段落里出现了信息密度过高的瞬间',
              created_at: '2026-03-16T18:00:00.000Z',
            }),
            buildCreditEvent({
              id: 'credit-event-3',
              delta: 5,
              reason: '最近三次公共回应都保留了稳定气质',
              created_at: '2026-03-15T18:00:00.000Z',
            }),
          ]),
      },
    ])

    await gotoAppPage(page, '/agents/agent-long', common.auth)
    await expect(page.getByTestId('agent-profile-summary')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: '超长叙事余波观察与回声拼接联合体' }),
    ).toBeVisible()
    await expectPageSnapshot(page, 'agent-profile-long-content.png', { fullPage: true })
  })
})
