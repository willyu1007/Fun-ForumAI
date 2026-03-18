import { expect, test } from '@playwright/test'
import {
  defaultAuthenticatedState,
  expectPageSnapshot,
  fulfillError,
  fulfillOk,
  gotoAppPage,
  installApiMocks,
  prepareVisualPage,
} from './support/helpers'
import { buildAgent, buildUser } from './support/mock-data'

function buildManageUserState() {
  return {
    ...defaultAuthenticatedState(),
    auth: {
      user: buildUser({
        id: 'user-1',
        email: 'builder@example.com',
        displayName: 'Builder Reed',
      }),
    },
  }
}

test.describe('AgentManagePage visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page)
  })

  test('anonymous gate', async ({ page }) => {
    const common = {
      auth: null,
      communities: undefined,
      myAgents: [],
      notifications: [],
    }

    await installApiMocks(page, common)
    await gotoAppPage(page, '/agents/manage', common.auth)
    await expect(page.getByTestId('agent-manage-anonymous')).toBeVisible()
    await expectPageSnapshot(page, 'agent-manage-anonymous-gate.png')
  })

  test('authenticated empty form', async ({ page }) => {
    const common = buildManageUserState()

    await installApiMocks(page, common)
    await gotoAppPage(page, '/agents/manage', common.auth)
    await expect(page.getByTestId('agent-manage-form')).toBeVisible()
    await expectPageSnapshot(page, 'agent-manage-empty-form.png')
  })

  test('mutation error', async ({ page }) => {
    const common = buildManageUserState()

    await installApiMocks(page, common, [
      {
        method: 'POST',
        match: '/agents',
        handle: ({ route }) =>
          fulfillError(route, 500, 'AGENT_CREATE_FAILED', '创建失败，请稍后再试。'),
      },
    ])

    await gotoAppPage(page, '/agents/manage', common.auth)
    await expect(page.getByTestId('agent-manage-form')).toBeVisible()

    const createResponse = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return response.request().method() === 'POST' && url.pathname === '/v1/agents'
    })

    await page.getByPlaceholder('显示名称').fill('测试失败场景')
    await page
      .getByTestId('agent-manage-form')
      .getByRole('button', { name: '创建', exact: true })
      .click()
    await createResponse

    await expect(page.getByTestId('agent-manage-error')).toBeVisible()
    await expectPageSnapshot(page, 'agent-manage-mutation-error.png')
  })

  test('create success with created list', async ({ page }) => {
    const createdAgent = buildAgent({
      id: 'agent-created',
      owner_id: 'user-1',
      display_name: '晨港',
      persona_seed_code: 'scholar',
      persona_seed_label: '理性探索型',
      home_voice_line_label: '晨雾档案',
    })
    const common = buildManageUserState()

    await installApiMocks(page, common, [
      {
        method: 'POST',
        match: '/agents',
        handle: ({ route }) => fulfillOk(route, createdAgent, { status: 201 }),
      },
    ])

    await gotoAppPage(page, '/agents/manage', common.auth)
    await expect(page.getByTestId('agent-manage-form')).toBeVisible()

    const createResponse = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return response.request().method() === 'POST' && url.pathname === '/v1/agents'
    })

    await page.getByPlaceholder('显示名称').fill('晨港')
    await page
      .getByTestId('agent-manage-form')
      .getByRole('button', { name: '创建', exact: true })
      .click()
    await createResponse

    await expect(page.getByTestId('agent-manage-created')).toBeVisible()
    await expect(page.getByText('晨港')).toBeVisible()
    await expectPageSnapshot(page, 'agent-manage-create-success.png')
  })

  test('wizard open overlay', async ({ page }) => {
    const common = buildManageUserState()

    await installApiMocks(page, common)
    await gotoAppPage(page, '/agents/manage', common.auth)
    await expect(page.getByTestId('agent-manage-form')).toBeVisible()

    await page.getByRole('button', { name: '引导式创建' }).click()
    await expect(page.getByTestId('agent-create-wizard')).toBeVisible()
    await expectPageSnapshot(page, 'agent-manage-wizard-overlay.png')
  })
})
