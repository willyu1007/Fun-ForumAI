import { expect, test } from '@playwright/test'
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
import { buildAgentSearchItem } from './support/mock-data'

test.describe('AgentDirectoryPage visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page)
  })

  test('loading state', async ({ page }) => {
    const gate = createDeferred()
    const common = defaultAuthenticatedState()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents',
        handle: async ({ route }) => {
          await gate.promise
          await fulfillOk(route, [
            buildAgentSearchItem({ id: 'agent-loading', display_name: '加载后出现的雾岚' }),
          ])
        },
      },
    ])

    await gotoAppPage(page, '/agents', common.auth)
    await expect(page.getByTestId('agent-directory-loading')).toBeVisible()
    await expectPageSnapshot(page, 'agents-loading.png')

    gate.resolve()
    await expect(page.getByTestId('agent-directory-results')).toBeVisible()
  })

  test('error state', async ({ page }) => {
    const common = defaultAuthenticatedState()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents',
        handle: ({ route }) =>
          fulfillError(route, 500, 'AGENT_SEARCH_FAILED', '搜索索引暂时不可用'),
      },
    ])

    await gotoAppPage(page, '/agents', common.auth)
    await expect(page.getByTestId('agent-directory-error')).toBeVisible()
    await expectPageSnapshot(page, 'agents-error.png')
  })

  test('empty state', async ({ page }) => {
    const common = defaultAuthenticatedState()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents',
        handle: ({ route }) => fulfillOk(route, []),
      },
    ])

    await gotoAppPage(page, '/agents', common.auth)
    await expect(page.getByTestId('agent-directory-empty')).toBeVisible()
    await expectPageSnapshot(page, 'agents-empty.png')
  })

  test('happy path', async ({ page }) => {
    const common = defaultAuthenticatedState()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildAgentSearchItem({
              id: 'agent-spring',
              display_name: '柳昼',
              persona_seed_label: '春日观察者',
              home_voice_line_label: '风信子',
            }),
            buildAgentSearchItem({
              id: 'agent-fjord',
              display_name: '白礁',
              persona_seed_label: '冷静整理型',
              home_voice_line_label: '海风档案',
              is_followed: true,
            }),
            buildAgentSearchItem({
              id: 'agent-cinder',
              display_name: '炉声',
              status: 'LIMITED',
              persona_seed_label: '火光慢炖型',
              home_voice_line_label: '夜炉',
            }),
          ]),
      },
    ])

    await gotoAppPage(page, '/agents', common.auth)
    await expect(page.getByTestId('agent-directory-results')).toBeVisible()
    await expect(page.getByText('柳昼')).toBeVisible()
    await expectPageSnapshot(page, 'agents-happy-path.png')
  })

  test('filtered long-content state', async ({ page }) => {
    const common = defaultAuthenticatedState()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/agents',
        handle: ({ route, searchParams }) => {
          const query = searchParams.get('q')
          if (query === '长内容') {
            return fulfillOk(route, [
              buildAgentSearchItem({
                id: 'agent-long',
                display_name: '长内容长旅程观察者联合体',
                persona_seed_label: '超长标签人格演化观察样板',
                home_voice_line_label: '把细节留成余味的长标题声线',
              }),
              buildAgentSearchItem({
                id: 'agent-long-2',
                display_name: '二级叙事缓冲与回声拼接器',
                persona_seed_label: '多段叙事拼贴',
                home_voice_line_label: '慢慢把零散感受拢起来',
                is_followed: true,
              }),
            ])
          }

          return fulfillOk(route, [
            buildAgentSearchItem({ id: 'agent-default', display_name: '雾岚' }),
            buildAgentSearchItem({ id: 'agent-default-2', display_name: '海柠' }),
          ])
        },
      },
    ])

    await gotoAppPage(page, '/agents', common.auth)
    await expect(page.getByTestId('agent-directory-results')).toBeVisible()

    const filteredResponse = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        response.request().method() === 'GET' &&
        url.pathname === '/v1/agents' &&
        url.searchParams.get('q') === '长内容'
      )
    })

    await page
      .getByPlaceholder('输入名称关键词，例如：历史、科技、哲学')
      .fill('长内容')
    await page.getByRole('button', { name: '搜索' }).click()
    await filteredResponse

    await expect(page.getByTestId('agent-directory-results')).toContainText(
      '长内容长旅程观察者联合体',
    )
    await expectPageSnapshot(page, 'agents-filtered-long-content.png', { fullPage: true })
  })
})
