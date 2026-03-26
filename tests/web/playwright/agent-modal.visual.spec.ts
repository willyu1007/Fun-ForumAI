import { expect, test } from '@playwright/test'
import { buildAgentTarget } from '../../../src/shared/agent-target.js'
import {
  createDeferred,
  defaultAuthenticatedState,
  expectPageSnapshot,
  fulfillError,
  fulfillOk,
  gotoAppPage,
  installApiMocks,
  prepareVisualPage,
} from './support/helpers'
import {
  buildAgent,
  buildAgentSearchItem,
  buildAgentTrait,
  buildAgentXp,
  buildCredit,
  buildCreditEvent,
  buildOwnerLifeOverview,
  buildTraitDefinition,
} from './support/mock-data'

test.describe('Agent modal visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page)
  })

  test('search result opens readonly profile modal', async ({ page }) => {
    const common = defaultAuthenticatedState()
    const agentId = 'agent-spectator'

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/feed',
        handle: ({ route }) => fulfillOk(route, [], { meta: { cursor: null } }),
      },
      {
        method: 'GET',
        match: '/search',
        handle: ({ route, searchParams }) =>
          fulfillOk(route, {
            query: searchParams.get('q') ?? '',
            normalized_query: searchParams.get('q') ?? '',
            current_tab: 'agents',
            counts: {
              posts: 0,
              communities: 0,
              agents: 1,
              threads: 0,
            },
            items: [
              {
                ...buildAgentSearchItem({
                  id: agentId,
                  display_name: '雾岚',
                  persona_seed_label: '温柔接住型',
                  home_voice_line_label: '夜航人',
                }),
                type: 'agent',
                href: buildAgentTarget({
                  agentId,
                  mode: 'readonly',
                }),
                tagline: '会把散乱片段慢慢接成故事的人。',
                badges: [{ code: 'host', name: '主持', tier: 2 }],
                active_communities: [{ id: 'community-1', name: '创作热身场', slug: 'creative-warmup' }],
                public_activity_score: 4.5,
                score: 1.25,
                snippet: '更适合 TALK_SHOW · 常站 HOST · 在 talk show 里接住爆梗',
                highlights: [{ field: 'projection', snippet: '更适合 TALK_SHOW · 常站 HOST' }],
                match_reasons: ['命中公域投射', '命中公共经历'],
                match_reason_codes: ['projection', 'chronicle'],
              },
            ],
            discovery: null,
            cursor: null,
            took_ms: 12,
          }),
      },
      {
        method: 'POST',
        match: '/search/telemetry',
        handle: ({ route }) => fulfillOk(route, { accepted: true }),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/profile`,
        handle: ({ route }) =>
          fulfillOk(
            route,
            buildAgent({
              id: agentId,
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
            }),
          ),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/xp`,
        handle: ({ route }) =>
          fulfillOk(route, buildAgentXp({ xp: 72, growth_points_total: 3, growth_points_available: 2 })),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/traits`,
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
        match: `/agents/${agentId}/credit`,
        handle: ({ route }) => fulfillOk(route, buildCredit({ credit_score: 86 })),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/credit-events`,
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

    await gotoAppPage(page, '/search?q=talk%20show&tab=agents', common.auth)
    await expect(page.getByTestId('search-page')).toBeVisible()
    await page.getByRole('button', { name: '雾岚' }).click()

    await expect(page.getByTestId('agent-profile-summary')).toBeVisible()
    await expect(page.getByTestId('agent-profile-narrative')).toBeVisible()
    await expectPageSnapshot(page, 'agent-modal-readonly-profile.png')
  })

  test('search result keeps the readonly modal loading state visible while profile is pending', async ({ page }) => {
    const common = defaultAuthenticatedState()
    const agentId = 'agent-loading'
    const profileGate = createDeferred<void>()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/search',
        handle: ({ route, searchParams }) =>
          fulfillOk(route, {
            query: searchParams.get('q') ?? '',
            normalized_query: searchParams.get('q') ?? '',
            current_tab: 'agents',
            counts: {
              posts: 0,
              communities: 0,
              agents: 1,
              threads: 0,
            },
            items: [
              {
                ...buildAgentSearchItem({
                  id: agentId,
                  display_name: '迟迟',
                }),
                type: 'agent',
                href: buildAgentTarget({
                  agentId,
                  mode: 'readonly',
                }),
                tagline: '还在加载中的角色。',
                badges: [],
                active_communities: [],
                public_activity_score: 1.4,
                score: 0.82,
                snippet: '等待角色档案返回时，modal 应继续保持稳定骨架。',
                highlights: [],
                match_reasons: ['命中名称'],
                match_reason_codes: ['name'],
              },
            ],
            discovery: null,
            cursor: null,
            took_ms: 8,
          }),
      },
      {
        method: 'POST',
        match: '/search/telemetry',
        handle: ({ route }) => fulfillOk(route, { accepted: true }),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/profile`,
        handle: async ({ route }) => {
          await profileGate.promise
          await fulfillOk(
            route,
            buildAgent({
              id: agentId,
              display_name: '迟迟',
            }),
          )
        },
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/xp`,
        handle: ({ route }) => fulfillOk(route, buildAgentXp()),
      },
    ])

    await gotoAppPage(page, '/search?q=loading&tab=agents', common.auth)
    await page.getByRole('button', { name: '迟迟' }).click()

    await expect(page.getByTestId('agent-profile-loading')).toBeVisible()
    await expectPageSnapshot(page, 'agent-modal-readonly-loading.png')

    profileGate.resolve()
  })

  test('search result renders the readonly modal error state when the profile fetch fails', async ({ page }) => {
    const common = defaultAuthenticatedState()
    const agentId = 'agent-missing'

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/search',
        handle: ({ route, searchParams }) =>
          fulfillOk(route, {
            query: searchParams.get('q') ?? '',
            normalized_query: searchParams.get('q') ?? '',
            current_tab: 'agents',
            counts: {
              posts: 0,
              communities: 0,
              agents: 1,
              threads: 0,
            },
            items: [
              {
                ...buildAgentSearchItem({
                  id: agentId,
                  display_name: '失联',
                }),
                type: 'agent',
                href: buildAgentTarget({
                  agentId,
                  mode: 'readonly',
                }),
                tagline: '一个已经失效的入口。',
                badges: [],
                active_communities: [],
                public_activity_score: 0.8,
                score: 0.51,
                snippet: 'profile 失败时，modal 应停在当前 error state。',
                highlights: [],
                match_reasons: ['命中名称'],
                match_reason_codes: ['name'],
              },
            ],
            discovery: null,
            cursor: null,
            took_ms: 9,
          }),
      },
      {
        method: 'POST',
        match: '/search/telemetry',
        handle: ({ route }) => fulfillOk(route, { accepted: true }),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/profile`,
        handle: ({ route }) => fulfillError(route, 404, 'NOT_FOUND', 'Agent missing'),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/xp`,
        handle: ({ route }) => fulfillOk(route, buildAgentXp()),
      },
    ])

    await gotoAppPage(page, '/search?q=missing&tab=agents', common.auth)
    await page.getByRole('button', { name: '失联' }).click()

    await expect(page.getByTestId('agent-profile-error')).toBeVisible()
    await expectPageSnapshot(page, 'agent-modal-readonly-error.png')
  })

  test('manage modal supports wizard flow from current activity page', async ({ page }) => {
    const common = defaultAuthenticatedState()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/feed',
        handle: ({ route }) => fulfillOk(route, [], { meta: { cursor: null } }),
      },
    ])
    await gotoAppPage(page, '/my/activity', common.auth)
    await expect(page.getByRole('button', { name: '智能体管理' })).toBeVisible()

    await page.getByRole('button', { name: '智能体管理' }).click()
    await page.getByTitle('创建智能体').click()
    await expect(page.getByTestId('agent-create-wizard')).toBeVisible()
    await expectPageSnapshot(page, 'agent-modal-manage-wizard.png')
  })

  test('manage modal keeps owner surfaces covered across active tabs', async ({ page }) => {
    const agentId = 'agent-owner'
    const common = {
      ...defaultAuthenticatedState(),
      myAgents: [
        buildAgent({
          id: agentId,
          owner_id: 'user-1',
          display_name: '雾岚',
          tagline: '把停顿接成故事的人。',
        }),
      ],
    }

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
        match: `/agents/${agentId}/xp`,
        handle: ({ route }) =>
          fulfillOk(route, buildAgentXp({ xp: 72, growth_points_total: 3, growth_points_available: 2 })),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/runs`,
        handle: ({ route }) => fulfillOk(route, []),
      },
      {
        method: 'GET',
        match: `/private/agents/${agentId}/life-overview`,
        handle: ({ route }) => fulfillOk(route, buildOwnerLifeOverview(agentId)),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/chat/sessions`,
        handle: ({ route }) =>
          fulfillOk(route, {
            items: [],
            next_cursor: null,
          }),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/highlights`,
        handle: ({ route }) =>
          fulfillOk(route, {
            agent_id: agentId,
            badges: [{ code: 'host', name: '主持', tier: 2 }],
            tagline: '会把零散情绪收成稳定节奏。',
            top_chronicle: [],
          }),
      },
      {
        method: 'GET',
        match: `/private/agents/${agentId}/chronicle-feed`,
        handle: ({ route }) =>
          fulfillOk(route, {
            chapter: null,
            items: [],
          }),
      },
      {
        method: 'GET',
        match: `/private/agents/${agentId}/nurture-suggestions`,
        handle: ({ route }) =>
          fulfillOk(route, {
            items: [],
          }),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/relations/summary`,
        handle: ({ route }) =>
          fulfillOk(route, {
            following: { shadow: 1, effective: 2, inactive: 0, blocked: 0 },
            followers: { shadow: 0, effective: 1, inactive: 0, blocked: 0 },
            friends: 1,
          }),
      },
      {
        method: 'GET',
        match: `/agents/${agentId}/relations`,
        handle: ({ route }) =>
          fulfillOk(route, {
            items: [],
            next_cursor: null,
          }),
      },
    ])

    await gotoAppPage(page, '/my/activity', common.auth)
    await page.getByRole('button', { name: /^雾岚/ }).click()

    await expect(page.getByTestId('agent-profile-summary')).toBeVisible()
    await expectPageSnapshot(page, 'agent-modal-manage-owner-intro.png')

    await page.getByTestId('agent-modal-tab-chat').click()
    await expect(page.getByTestId('private-chat-empty-state')).toBeVisible()
    await expectPageSnapshot(page, 'agent-modal-manage-chat-empty.png')

    await page.getByTestId('agent-modal-tab-moments').click()
    await expect(page.getByTestId('agent-highlights-page')).toBeVisible()
    await expectPageSnapshot(page, 'agent-modal-manage-moments.png')

    await page.getByTestId('agent-modal-tab-history').click()
    await expect(page.getByText('筛选这条人生线')).toBeVisible()
    await expectPageSnapshot(page, 'agent-modal-manage-history.png')

    await page.getByTestId('agent-modal-tab-social').click()
    await expect(page.getByText('关系列表')).toBeVisible()
    await expectPageSnapshot(page, 'agent-modal-manage-social.png')
  })
})
