import { expect, test } from '@playwright/test'
import {
  expectPageSnapshot,
  fulfillOk,
  gotoAppPage,
  installApiMocks,
  prepareVisualPage,
  waitForApiResponse,
} from './support/helpers'
import {
  buildNotification,
  buildUser,
} from './support/mock-data'
import {
  buildAppealRequest,
  buildComplaintTicket,
} from './support/p0-builders'

function buildSafetyCommon() {
  return {
    auth: {
      user: buildUser({
        id: 'user-1',
        email: 'viewer@example.com',
        displayName: 'Viewer Echo',
      }),
    },
    communities: undefined,
    myAgents: [],
    notifications: [
      buildNotification({
        id: 'notification-gov-1',
        type: 'GOVERNANCE',
        title: '你提交的私聊治理已进入审核',
        body: '系统已建立 case，并补齐了关联证据快照。',
        target_type: 'private_session',
        target_id: 'session-1',
        read: false,
        created_at: '2026-03-18T00:08:00.000Z',
      }),
      buildNotification({
        id: 'notification-gov-2',
        type: 'AFTERSHOW_CALLOUT',
        title: '你的观众留言被收进了 aftershow',
        body: '这条留言已经成为回看入口的一部分。',
        target_type: 'AFTERSHOW_CALLOUT',
        target_id: 'post-1:aftershow-1:0',
        read: true,
        created_at: '2026-03-17T22:30:00.000Z',
      }),
    ],
  }
}

function buildAdminCommon() {
  return {
    auth: {
      user: buildUser({
        id: 'admin-1',
        email: 'admin@example.com',
        displayName: 'Admin Reed',
        role: 'admin',
      }),
    },
    communities: undefined,
    myAgents: [],
    notifications: [],
  }
}

test.describe('Governance and auth visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page)
  })

  test('safety center timeline state', async ({ page }) => {
    const common = buildSafetyCommon()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/reports',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildComplaintTicket({
              id: 'complaint-1',
              target_type: 'private_session',
              target_id: 'session-1',
              complaint_type: 'HARASSMENT_REPORT',
              reason_code: 'private_session_report',
              detail_text: '这轮私聊需要进入治理链路。',
              status: 'LINKED',
              linked_case_id: 'case-1',
            }),
            buildComplaintTicket({
              id: 'complaint-2',
              target_type: 'post',
              target_id: 'post-1',
              complaint_type: 'CONTENT_REPORT',
              reason_code: 'content_report',
              detail_text: '这条帖子需要补一轮上下文复核。',
              status: 'RESOLVED',
              linked_case_id: 'case-2',
              updated_at: '2026-03-17T18:30:00.000Z',
            }),
          ]),
      },
      {
        method: 'GET',
        match: '/appeals',
        handle: ({ route }) =>
          fulfillOk(route, [
            buildAppealRequest({
              id: 'appeal-1',
              target_type: 'post',
              target_id: 'post-1',
              status: 'OPEN',
              reason: '希望复核这条内容处理结果。',
            }),
          ]),
      },
    ])

    await gotoAppPage(page, '/safety', common.auth)
    await expect(page.getByText('举报与申诉')).toBeVisible()
    await expectPageSnapshot(page, 'governance-safety-center-timeline.png', {
      fullPage: true,
    })
  })

  test('admin governance dashboard', async ({ page }) => {
    const common = buildAdminCommon()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/health',
        handle: ({ route }) =>
          fulfillOk(route, {
            status: 'ok',
            timestamp: '2026-03-18T00:20:00.000Z',
            uptime: 92812,
          }),
      },
      {
        method: 'GET',
        match: '/admin/hot-topic/dashboard',
        handle: ({ route }) =>
          fulfillOk(route, [
            {
              target_type: 'post',
              target_id: 'post-1',
              title: '一句停顿为什么会留下余味',
              community_id: 'community-1',
              topic_domain: 'ENTERTAINMENT',
              hot_score: 96,
              drift_risk_score: 18,
              report_count_24h: 2,
              distribution_state: 'NORMAL',
              restriction_state: 'NORMAL',
              sampled_review_required: false,
              linked_case_id: 'case-hot-1',
              latest_event_at: '2026-03-18T00:10:00.000Z',
            },
          ]),
      },
      {
        method: 'GET',
        match: '/admin/hot-topic/alerts',
        handle: ({ route }) =>
          fulfillOk(route, [
            {
              severity: 'medium',
              reason: '讨论热度上升，建议继续观察是否出现漂移。',
              item: {
                target_type: 'post',
                target_id: 'post-1',
                title: '一句停顿为什么会留下余味',
                community_id: 'community-1',
                topic_domain: 'ENTERTAINMENT',
                hot_score: 96,
                drift_risk_score: 18,
                report_count_24h: 2,
                distribution_state: 'NORMAL',
                restriction_state: 'NORMAL',
                sampled_review_required: false,
                linked_case_id: 'case-hot-1',
                latest_event_at: '2026-03-18T00:10:00.000Z',
              },
            },
          ]),
      },
      {
        method: 'GET',
        match: '/admin/moderation/queue',
        handle: ({ route }) =>
          fulfillOk(route, [
            {
              id: 'case-1',
              case_type: 'COMPLAINT',
              queue: 'COMPLAINT',
              status: 'OPEN',
              priority: 80,
              summary_text: '主动私信治理请求进入复核。',
              risk_summary: null,
              opened_reason: 'private_session_report',
              opened_by: 'system',
              primary_target_type: 'private_session',
              primary_target_id: 'session-1',
              assigned_to_user_id: null,
              sla_due_at: '2026-03-19T04:00:00.000Z',
              claimed_by_user_id: null,
              claimed_at: null,
              linked_policy_snapshot_id: null,
              linked_complaint_ticket_id: 'complaint-1',
              linked_appeal_request_id: null,
              resolution_action: null,
              resolved_by_user_id: null,
              resolution_note: null,
              resolved_at: null,
              created_at: '2026-03-18T00:06:00.000Z',
              updated_at: '2026-03-18T00:06:00.000Z',
            },
            {
              id: 'case-2',
              case_type: 'APPEAL',
              queue: 'APPEAL',
              status: 'IN_REVIEW',
              priority: 62,
              summary_text: '帖子申诉等待人工复核结论。',
              risk_summary: null,
              opened_reason: 'owner_appeal_from_post_detail',
              opened_by: 'user-1',
              primary_target_type: 'post',
              primary_target_id: 'post-1',
              assigned_to_user_id: 'admin-1',
              sla_due_at: '2026-03-19T06:00:00.000Z',
              claimed_by_user_id: 'admin-1',
              claimed_at: '2026-03-18T00:09:00.000Z',
              linked_policy_snapshot_id: null,
              linked_complaint_ticket_id: null,
              linked_appeal_request_id: 'appeal-1',
              resolution_action: null,
              resolved_by_user_id: null,
              resolution_note: null,
              resolved_at: null,
              created_at: '2026-03-18T00:08:00.000Z',
              updated_at: '2026-03-18T00:09:00.000Z',
            },
          ]),
      },
      {
        method: 'GET',
        match: '/admin/identity-reviews',
        handle: ({ route }) =>
          fulfillOk(route, [
            {
              id: 'identity-review-1',
              user_id: 'user-42',
              status: 'PENDING',
              method: 'MANUAL_REVIEW',
              reviewed_by_user_id: null,
              reason: '需要继续核对实名材料。',
              submitted_at: '2026-03-17T20:00:00.000Z',
              reviewed_at: null,
              expires_at: '2026-03-20T20:00:00.000Z',
              meta: {
                region: 'CN',
              },
            },
          ]),
      },
    ])

    await gotoAppPage(page, '/admin', common.auth)
    await expect(page.getByRole('heading', { name: '管控台' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '治理操作' })).toBeVisible()
    await expectPageSnapshot(page, 'governance-admin-dashboard.png', {
      fullPage: true,
    })
  })

  test('login page default state', async ({ page }) => {
    const common = {
      auth: null,
      communities: undefined,
      myAgents: [],
      notifications: [],
    }

    await installApiMocks(page, common)
    const authMeResponse = waitForApiResponse(page, 'GET', '/auth/me')
    await page.goto('/login')
    await authMeResponse
    await expect(page.getByRole('link', { name: /AI TALKSHOW/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: '邮箱登录' })).toBeVisible()
    await expectPageSnapshot(page, 'auth-login-default-state.png')
  })

  test('register page default state', async ({ page }) => {
    const common = {
      auth: null,
      communities: undefined,
      myAgents: [],
      notifications: [],
    }

    await installApiMocks(page, common)
    const authMeResponse = waitForApiResponse(page, 'GET', '/auth/me')
    await page.goto('/register')
    await authMeResponse
    await expect(page.getByRole('tab', { name: '邮箱注册' })).toBeVisible()
    await expectPageSnapshot(page, 'auth-register-default-state.png')
  })
})
