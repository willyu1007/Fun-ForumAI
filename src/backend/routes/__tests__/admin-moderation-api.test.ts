import { describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  adminToken,
  app,
  createTestCommunity,
  servicePost,
  setupFeatureFlagGuard,
  userToken,
} from './e2e-helpers.js'
import { createDevToken } from '../../middleware/human-auth.js'

setupFeatureFlagGuard()

const admin2Token = createDevToken({ userId: 'admin2', email: 'admin2@test.com', role: 'admin' })

describe('Admin moderation API', () => {
  it('lists queue entries, claims tasks, and resolves cases with metadata', async () => {
    const community = await createTestCommunity({
      name: 'Admin Moderation Queue Community',
      slug: `admin-moderation-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Admin Moderation Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: 'run-admin-moderation-1',
      community_id: community.id,
      title: 'Privacy complaint target',
      body: 'contains personal information',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const reportRes = await request(app)
      .post('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'post',
        target_id: postId,
        complaint_type: 'PRIVACY_REQUEST',
        detail_text: 'contains PII',
        attachments: [{ ref: 'evidence://privacy-claim-1', type: 'screenshot' }],
      })

    expect(reportRes.status).toBe(201)
    expect(reportRes.body.data.case.queue).toBe('PRIVACY')
    const caseId = reportRes.body.data.case.id as string

    const queueRes = await request(app)
      .get('/v1/admin/moderation/queue')
      .query({ queue: 'PRIVACY' })
      .set('Authorization', `Bearer ${adminToken}`)

    expect(queueRes.status).toBe(200)
    expect(queueRes.body.data.some((item: { id: string; queue: string }) => item.id === caseId && item.queue === 'PRIVACY')).toBe(true)

    const detailRes = await request(app)
      .get(`/v1/admin/moderation/cases/${caseId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(detailRes.status).toBe(200)
    expect(detailRes.body.data.case.primary_target_type).toBe('post')
    expect(detailRes.body.data.targets[0].relation_type).toBe('PRIMARY')
    expect(detailRes.body.data.tasks[0].queue).toBe('PRIVACY')
    expect(detailRes.body.data.tasks[0].assigned_role).toBe('privacy_reviewer')
    expect(detailRes.body.data.linked_complaint.complaint_type).toBe('PRIVACY_REQUEST')
    expect(detailRes.body.data.linked_appeal).toBeNull()
    const complaintEvidence = detailRes.body.data.evidence.find((item: { snapshot_type: string }) => item.snapshot_type === 'complaint_ticket')
    expect(complaintEvidence?.policy_hits).toEqual({
      complaint_type: 'PRIVACY_REQUEST',
      reason_code: 'privacy_request',
    })
    expect(complaintEvidence?.context).toMatchObject({
      target_type: 'post',
      target_id: postId,
    })

    const claimRes = await request(app)
      .post(`/v1/admin/moderation/tasks/${detailRes.body.data.tasks[0].id}/claim`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ operator_note: 'picked up by admin' })

    expect(claimRes.status).toBe(200)
    expect(claimRes.body.data.task.status).toBe('ASSIGNED')
    expect(claimRes.body.data.task.claimed_by_user_id).toBe('admin1')
    expect(claimRes.body.data.case.claimed_by_user_id).toBe('admin1')

    const duplicateClaimRes = await request(app)
      .post(`/v1/admin/moderation/tasks/${detailRes.body.data.tasks[0].id}/claim`)
      .set('Authorization', `Bearer ${admin2Token}`)
      .send({ operator_note: 'attempted steal' })

    expect(duplicateClaimRes.status).toBe(400)
    expect(duplicateClaimRes.body.error.code).toBe('VALIDATION_ERROR')
    expect(duplicateClaimRes.body.error.message).toBe('task is already claimed')

    const transferRes = await request(app)
      .post(`/v1/admin/moderation/cases/${caseId}/transfer`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assignee_user_id: 'admin2',
        operator_note: 'handoff to privacy desk',
      })

    expect(transferRes.status).toBe(200)
    expect(transferRes.body.data.case.assigned_to_user_id).toBe('admin2')
    expect(transferRes.body.data.task.assignee_user_id).toBe('admin2')
    expect(transferRes.body.data.task.status).toBe('ASSIGNED')

    const invalidExportRes = await request(app)
      .get(`/v1/admin/moderation/cases/${caseId}/evidence-export`)
      .query({ redaction: 'invalid' })
      .set('Authorization', `Bearer ${adminToken}`)

    expect(invalidExportRes.status).toBe(400)

    const releaseRes = await request(app)
      .post(`/v1/admin/moderation/cases/${caseId}/release`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        operator_note: 'waiting_on_scope_confirmation',
      })

    expect(releaseRes.status).toBe(200)
    expect(releaseRes.body.data.case.status).toBe('OPEN')
    expect(releaseRes.body.data.case.assigned_to_user_id).toBeNull()
    expect(releaseRes.body.data.tasks[0].status).toBe('PENDING')
    expect(releaseRes.body.data.tasks[0].assignee_user_id).toBeNull()

    const exportRes = await request(app)
      .get(`/v1/admin/moderation/cases/${caseId}/evidence-export`)
      .query({ redaction: 'share' })
      .set('Authorization', `Bearer ${adminToken}`)

    expect(exportRes.status).toBe(200)
    expect(exportRes.body.data.redaction_level).toBe('share')
    expect(exportRes.body.data.linked_complaint.complaint_type).toBe('PRIVACY_REQUEST')
    expect(exportRes.body.data.linked_complaint.reporter_user_id).toBe('[REDACTED]')
    expect(exportRes.body.data.linked_complaint.detail_text).toBe('[REDACTED]')
    const claimedAction = exportRes.body.data.action_logs.find((item: { action: string }) => item.action === 'review_task_claimed')
    expect(claimedAction?.result?.claim_token).toBe('[REDACTED]')
    const transferredAction = exportRes.body.data.action_logs.find((item: { action: string }) => item.action === 'case_transferred')
    expect(transferredAction?.result?.from_assignee_user_id).toBe('[REDACTED]')
    expect(transferredAction?.result?.to_assignee_user_id).toBe('[REDACTED]')
    expect(exportRes.body.data.action_logs.some((item: { action: string }) => item.action === 'case_transferred')).toBe(true)
    expect(exportRes.body.data.action_logs.some((item: { action: string }) => item.action === 'case_released')).toBe(true)
    expect(exportRes.body.data.evidence.some((item: { snapshot_type: string }) => item.snapshot_type === 'case_transferred')).toBe(true)
    expect(exportRes.body.data.evidence.some((item: { snapshot_type: string }) => item.snapshot_type === 'case_released')).toBe(true)
    const redactedComplaintEvidence = exportRes.body.data.evidence.find((item: { snapshot_type: string }) => item.snapshot_type === 'complaint_ticket')
    expect(redactedComplaintEvidence?.evidence_package?.content?.redacted).toBe(true)

    const resolveRes = await request(app)
      .post(`/v1/admin/moderation/cases/${caseId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        resolution_action: 'privacy_removed',
        resolution_note: 'removed personal data from the target',
      })

    expect(resolveRes.status).toBe(200)
    expect(resolveRes.body.data.status).toBe('RESOLVED')
    expect(resolveRes.body.data.resolved_by_user_id).toBe('admin1')
    expect(resolveRes.body.data.resolution_note).toBe('removed personal data from the target')

    const invalidAssignRes = await request(app)
      .post(`/v1/admin/moderation/cases/${caseId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignee_user_id: 'admin1' })

    expect(invalidAssignRes.status).toBe(400)
    expect(invalidAssignRes.body.error.code).toBe('VALIDATION_ERROR')
    expect(invalidAssignRes.body.error.message).toBe('case is not assignable')

    const resolvedDetailRes = await request(app)
      .get(`/v1/admin/moderation/cases/${caseId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(resolvedDetailRes.status).toBe(200)
    expect(resolvedDetailRes.body.data.tasks[0].status).toBe('COMPLETED')
    expect(resolvedDetailRes.body.data.tasks[0].resolution_code).toBe('privacy_removed')

    const myReportsRes = await request(app)
      .get('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)

    expect(myReportsRes.status).toBe(200)
    expect(myReportsRes.body.data.some((item: {
      linked_case_id: string | null
      status: string
      resolution: Record<string, unknown> | null
    }) =>
      item.linked_case_id === caseId
      && item.status === 'RESOLVED'
      && item.resolution?.resolution_action === 'privacy_removed')).toBe(true)

    const notificationsRes = await request(app)
      .get('/v1/me/notifications')
      .query({ read: false })
      .set('Authorization', `Bearer ${userToken}`)

    expect(notificationsRes.status).toBe(200)
    expect(notificationsRes.body.data.items.some((item: {
      type: string
      title: string
      target_type: string | null
    }) =>
      item.type === 'GOVERNANCE'
      && item.title === '你的隐私请求已处理'
      && item.target_type === 'complaint_ticket')).toBe(true)

    const reopenRes = await request(app)
      .post(`/v1/admin/moderation/cases/${caseId}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opened_reason: 'fresh_evidence' })

    expect(reopenRes.status).toBe(200)
    expect(reopenRes.body.data.status).toBe('OPEN')

    const duplicateReopenRes = await request(app)
      .post(`/v1/admin/moderation/cases/${caseId}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opened_reason: 'duplicate_reopen' })

    expect(duplicateReopenRes.status).toBe(400)
    expect(duplicateReopenRes.body.error.code).toBe('VALIDATION_ERROR')
    expect(duplicateReopenRes.body.error.message).toBe('case is already open')
  })
})
