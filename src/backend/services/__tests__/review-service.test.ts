import { describe, expect, it } from 'vitest'
import { InMemoryNotificationRepository } from '../../repos/index.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { NotificationService } from '../notification-service.js'
import { ReviewService } from '../review-service.js'

function setupReviewService() {
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const notificationService = new NotificationService(new InMemoryNotificationRepository())
  const service = new ReviewService(riskRepo, notificationService)
  return { riskRepo, notificationService, service }
}

describe('ReviewService.ensureCase', () => {
  it('reuses an open case for the same target and appends evidence', async () => {
    const { riskRepo, service } = setupReviewService()

    const original = await service.openAutomatedCase({
      case_type: 'COMPLAINT',
      summary_text: 'Original complaint',
      opened_reason: 'seeded',
      target: {
        case_id: '',
        target_type: 'message',
        target_id: 'message-1',
        channel: 'report',
        user_id: 'user-1',
      },
      evidence: [{
        case_id: '',
        snapshot_type: 'policy_evidence',
        payload: { source: 'seeded' },
      }],
    })

    const ensured = await service.ensureCase({
      case_type: 'COMPLAINT',
      priority: 91,
      summary_text: 'Updated complaint summary',
      linked_complaint_ticket_id: 'complaint-1',
      target: {
        case_id: '',
        target_type: 'message',
        target_id: 'message-1',
        channel: 'report',
        user_id: 'user-2',
      },
      evidence: [{
        case_id: '',
        snapshot_type: 'complaint_ticket',
        payload: { complaint_id: 'complaint-1' },
      }],
    })

    expect(ensured.id).toBe(original.id)
    expect(ensured.queue).toBe('COMPLAINT')
    expect(ensured.status).toBe('OPEN')
    expect(ensured.priority).toBe(91)
    expect(ensured.linked_complaint_ticket_id).toBe('complaint-1')
    expect(ensured.primary_target_type).toBe('message')
    expect(ensured.primary_target_id).toBe('message-1')

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    expect(cases.items).toHaveLength(1)

    const evidence = await riskRepo.listEvidenceSnapshots(original.id)
    expect(evidence.map((item) => item.snapshot_type)).toEqual([
      'policy_evidence',
      'complaint_ticket',
    ])

    const tasks = await riskRepo.listReviewTasks(original.id)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.task_type).toBe('INITIAL_REVIEW')
    expect(tasks[0]?.queue).toBe('COMPLAINT')
    expect(tasks[0]?.assigned_role).toBe('content_reviewer')
    expect(tasks[0]?.due_at).not.toBeNull()
  })

  it('reopens a resolved case, creates a reopened review task, and logs the action', async () => {
    const { riskRepo, service } = setupReviewService()

    const original = await service.openAutomatedCase({
      case_type: 'COMPLAINT',
      summary_text: 'Resolved complaint',
      opened_reason: 'seeded',
      target: {
        case_id: '',
        target_type: 'message',
        target_id: 'message-2',
        channel: 'report',
        user_id: 'user-1',
      },
    })
    await service.resolveCase(original.id, 'seeded_resolution', 'operator-1')

    const ensured = await service.ensureCase({
      case_type: 'COMPLAINT',
      priority: 88,
      summary_text: 'Complaint reopened by new ticket',
      opened_reason: 'complaint_reopened',
      opened_by: 'user-2',
      linked_complaint_ticket_id: 'complaint-2',
      target: {
        case_id: '',
        target_type: 'message',
        target_id: 'message-2',
        channel: 'report',
        user_id: 'user-2',
      },
      evidence: [{
        case_id: '',
        snapshot_type: 'complaint_ticket',
        payload: { complaint_id: 'complaint-2' },
      }],
    })

    expect(ensured.id).toBe(original.id)
    expect(ensured.queue).toBe('COMPLAINT')
    expect(ensured.status).toBe('OPEN')
    expect(ensured.linked_complaint_ticket_id).toBe('complaint-2')

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    expect(cases.items).toHaveLength(1)

    const tasks = await riskRepo.listReviewTasks(original.id)
    expect(tasks.map((item) => item.task_type).sort()).toEqual([
      'INITIAL_REVIEW',
      'REOPENED_REVIEW',
    ])

    const evidence = await riskRepo.listEvidenceSnapshots(original.id)
    const reopenedEvidence = evidence.find((item) => item.snapshot_type === 'case_reopened')
    expect(reopenedEvidence).toBeDefined()
    expect(reopenedEvidence?.context).toEqual({
      actor_user_id: 'user-2',
    })
    expect(reopenedEvidence?.action_history).toMatchObject({
      opened_reason: 'complaint_reopened',
      follow_up_task_type: 'REOPENED_REVIEW',
    })
    expect(evidence.some((item) => item.snapshot_type === 'complaint_ticket')).toBe(true)

    const actionLogs = await riskRepo.listGovernanceActionLogs('message', 'message-2')
    expect(actionLogs.map((item) => item.action)).toEqual([
      'case_resolved',
      'case_reopened',
    ])
  })

  it('claims a review task and resolves the case with resolution metadata', async () => {
    const { riskRepo, service } = setupReviewService()

    const created = await service.openAutomatedCase({
      case_type: 'COMPLAINT',
      queue: 'PRIVACY',
      priority: 95,
      summary_text: 'Privacy complaint',
      risk_summary: { complaint_type: 'PRIVACY_REQUEST' },
      target: {
        case_id: '',
        target_type: 'post',
        target_id: 'post-1',
        relation_type: 'PRIMARY',
        channel: 'report',
        user_id: 'user-1',
      },
    })

    const [task] = await riskRepo.listReviewTasks(created.id)
    expect(task).toBeDefined()
    expect(task?.queue).toBe('PRIVACY')
    expect(task?.assigned_role).toBe('privacy_reviewer')

    const claimed = await service.claimTask(task!.id, 'operator-1', {
      operator_note: 'taking over privacy request',
    })

    expect(claimed?.task.status).toBe('ASSIGNED')
    expect(claimed?.task.assignee_user_id).toBe('operator-1')
    expect(claimed?.task.claimed_by_user_id).toBe('operator-1')
    expect(claimed?.task.claim_token).toBeTruthy()
    expect(claimed?.case?.claimed_by_user_id).toBe('operator-1')
    expect(claimed?.case?.queue).toBe('PRIVACY')

    const resolved = await service.resolveCase(created.id, 'privacy_removed', 'operator-1', 'removed exposed data')
    expect(resolved?.status).toBe('RESOLVED')
    expect(resolved?.resolved_by_user_id).toBe('operator-1')
    expect(resolved?.resolution_note).toBe('removed exposed data')
    expect(resolved?.claimed_by_user_id).toBeNull()

    const [resolvedTask] = await riskRepo.listReviewTasks(created.id)
    expect(resolvedTask?.status).toBe('COMPLETED')
    expect(resolvedTask?.resolution_code).toBe('privacy_removed')
    expect(resolvedTask?.operator_note).toBe('removed exposed data')

    const actionLogs = await riskRepo.listGovernanceActionLogs('post', 'post-1')
    expect(actionLogs.map((item) => item.action)).toEqual([
      'review_task_claimed',
      'case_resolved',
    ])
  })

  it('prevents claim stealing and invalid closed/open case lifecycle transitions', async () => {
    const { riskRepo, service } = setupReviewService()

    const created = await service.openAutomatedCase({
      case_type: 'COMPLAINT',
      summary_text: 'Lifecycle guard complaint',
      target: {
        case_id: '',
        target_type: 'post',
        target_id: 'post-lifecycle-1',
        relation_type: 'PRIMARY',
        channel: 'report',
        user_id: 'user-1',
      },
    })

    const [task] = await riskRepo.listReviewTasks(created.id)
    expect(task).toBeDefined()

    await service.claimTask(task!.id, 'operator-1')
    await expect(service.claimTask(task!.id, 'operator-2')).rejects.toThrow('task is already claimed')

    await service.resolveCase(created.id, 'resolved_for_guard', 'operator-1')
    await expect(service.assignCase(created.id, 'operator-2', 'operator-2')).rejects.toThrow('case is not assignable')
    await expect(service.resolveCase(created.id, 'resolved_again', 'operator-2')).rejects.toThrow('case is not resolvable')

    await service.reopenCase(created.id, 'fresh_evidence', 'admin-1')
    await expect(service.reopenCase(created.id, 'duplicate_reopen', 'admin-2')).rejects.toThrow('case is already open')
  })

  it('syncs linked complaint and appeal statuses and emits governance notifications on resolve and reopen', async () => {
    const { riskRepo, notificationService, service } = setupReviewService()

    const complaint = await riskRepo.createComplaintTicket({
      reporter_user_id: 'user-complaint',
      target_type: 'post',
      target_id: 'post-governance-1',
      complaint_type: 'CONTENT_REPORT',
      reason_code: 'content_report',
      detail_text: 'please review',
    })
    const appeal = await riskRepo.createAppealRequest({
      requester_user_id: 'user-appeal',
      requester_type: 'USER',
      target_type: 'post',
      target_id: 'post-governance-1',
      appeal_type: 'CONTENT_APPEAL',
      reason: 'please restore',
      linked_complaint_ticket_id: complaint.id,
    })

    const created = await service.openAutomatedCase({
      case_type: 'APPEAL',
      queue: 'APPEAL',
      priority: 88,
      summary_text: 'Appeal review',
      linked_complaint_ticket_id: complaint.id,
      linked_appeal_request_id: appeal.id,
      target: {
        case_id: '',
        target_type: 'post',
        target_id: 'post-governance-1',
        relation_type: 'PRIMARY',
        channel: 'appeal',
        user_id: 'user-appeal',
      },
    })

    await riskRepo.updateComplaintTicket(complaint.id, {
      status: 'LINKED',
      linked_case_id: created.id,
    })
    await riskRepo.updateAppealRequest(appeal.id, {
      status: 'LINKED',
      linked_case_id: created.id,
    })

    await service.resolveCase(created.id, 'appeal_upheld', 'admin-1', 'restored content')

    const resolvedComplaint = await riskRepo.findComplaintTicketById(complaint.id)
    const resolvedAppeal = await riskRepo.findAppealRequestById(appeal.id)
    expect(resolvedComplaint?.status).toBe('RESOLVED')
    expect(resolvedComplaint?.resolution).toMatchObject({
      linked_case_id: created.id,
      resolution_action: 'appeal_upheld',
      resolved_by_user_id: 'admin-1',
    })
    expect(resolvedAppeal?.status).toBe('RESOLVED')
    expect(resolvedAppeal?.result).toMatchObject({
      linked_case_id: created.id,
      resolution_action: 'appeal_upheld',
      resolved_by_user_id: 'admin-1',
    })

    const complaintNotificationsAfterResolve = await notificationService.list('user-complaint', { limit: 20, cursor: undefined })
    const appealNotificationsAfterResolve = await notificationService.list('user-appeal', { limit: 20, cursor: undefined })
    expect(complaintNotificationsAfterResolve.items.some((item) => item.title === '你的举报已处理')).toBe(true)
    expect(appealNotificationsAfterResolve.items.some((item) => item.title === '你的内容申诉已处理')).toBe(true)
    expect(complaintNotificationsAfterResolve.items.some((item) =>
      item.title === '你的举报已处理'
      && item.body?.includes('论坛帖子 · post-governance-1')
      && item.body.includes('appeal_upheld'))).toBe(true)
    expect(appealNotificationsAfterResolve.items.some((item) =>
      item.title === '你的内容申诉已处理'
      && item.body?.includes('论坛帖子 · post-governance-1')
      && item.body.includes('appeal_upheld'))).toBe(true)

    await service.reopenCase(created.id, 'new_evidence_submitted', 'admin-2')

    const reopenedComplaint = await riskRepo.findComplaintTicketById(complaint.id)
    const reopenedAppeal = await riskRepo.findAppealRequestById(appeal.id)
    expect(reopenedComplaint?.status).toBe('LINKED')
    expect(reopenedComplaint?.resolution).toMatchObject({
      linked_case_id: created.id,
      opened_reason: 'new_evidence_submitted',
      reopened_by_user_id: 'admin-2',
    })
    expect(reopenedAppeal?.status).toBe('LINKED')
    expect(reopenedAppeal?.result).toMatchObject({
      linked_case_id: created.id,
      opened_reason: 'new_evidence_submitted',
      reopened_by_user_id: 'admin-2',
    })

    const complaintNotificationsAfterReopen = await notificationService.list('user-complaint', { limit: 20, cursor: undefined })
    const appealNotificationsAfterReopen = await notificationService.list('user-appeal', { limit: 20, cursor: undefined })
    expect(complaintNotificationsAfterReopen.items.some((item) => item.title === '你的举报已重新进入审核')).toBe(true)
    expect(appealNotificationsAfterReopen.items.some((item) => item.title === '你的内容申诉已重新进入审核')).toBe(true)
    expect(complaintNotificationsAfterReopen.items.some((item) =>
      item.title === '你的举报已重新进入审核'
      && item.body?.includes('论坛帖子 · post-governance-1')
      && item.body.includes('重开原因 new_evidence_submitted'))).toBe(true)
    expect(appealNotificationsAfterReopen.items.some((item) =>
      item.title === '你的内容申诉已重新进入审核'
      && item.body?.includes('论坛帖子 · post-governance-1')
      && item.body.includes('重开原因 new_evidence_submitted'))).toBe(true)
  })

  it('uses governance wording for private-session complaint notifications', async () => {
    const { riskRepo, notificationService, service } = setupReviewService()

    const complaint = await riskRepo.createComplaintTicket({
      reporter_user_id: 'user-private',
      target_type: 'private_session',
      target_id: 'session-governance-1',
      complaint_type: 'HARASSMENT_REPORT',
      reason_code: 'private_session_report',
      detail_text: 'unsolicited direct outreach',
    })

    const created = await service.openAutomatedCase({
      case_type: 'COMPLAINT',
      queue: 'COMPLAINT',
      priority: 90,
      summary_text: 'Private governance review',
      linked_complaint_ticket_id: complaint.id,
      target: {
        case_id: '',
        target_type: 'private_session',
        target_id: 'session-governance-1',
        relation_type: 'PRIMARY',
        channel: 'report',
        user_id: 'user-private',
      },
    })

    await riskRepo.updateComplaintTicket(complaint.id, {
      status: 'LINKED',
      linked_case_id: created.id,
    })

    await service.resolveCase(created.id, 'private_governance_resolved', 'admin-1')

    const complaintNotificationsAfterResolve = await notificationService.list('user-private', { limit: 20, cursor: undefined })
    expect(complaintNotificationsAfterResolve.items.some((item) =>
      item.title === '你的私聊治理已处理'
      && item.body?.includes('私聊会话 · session-governance-1')
      && item.body.includes('private_governance_resolved'))).toBe(true)

    await service.reopenCase(created.id, 'owner_requested_follow_up', 'admin-2')

    const complaintNotificationsAfterReopen = await notificationService.list('user-private', { limit: 20, cursor: undefined })
    expect(complaintNotificationsAfterReopen.items.some((item) =>
      item.title === '你的私聊治理已重新进入审核'
      && item.body?.includes('私聊会话 · session-governance-1')
      && item.body.includes('重开原因 owner_requested_follow_up'))).toBe(true)
  })

  it('transfers, releases, and exports a share-safe evidence package with linked requests', async () => {
    const { riskRepo, service } = setupReviewService()

    const complaint = await riskRepo.createComplaintTicket({
      reporter_user_id: 'user-7',
      target_type: 'post',
      target_id: 'post-7',
      complaint_type: 'DELETION_REQUEST',
      reason_code: 'deletion_request',
      detail_text: 'remove this content',
    })

    const created = await service.openAutomatedCase({
      case_type: 'COMPLAINT',
      queue: 'DELETION',
      priority: 95,
      summary_text: 'Deletion request',
      linked_complaint_ticket_id: complaint.id,
      target: {
        case_id: '',
        target_type: 'post',
        target_id: 'post-7',
        relation_type: 'PRIMARY',
        channel: 'report',
        user_id: 'user-7',
      },
      evidence: [{
        case_id: '',
        snapshot_type: 'complaint_ticket',
        payload: { complaint_id: complaint.id },
        content: {
          body: 'remove this content',
        },
        context: {
          reporter_user_id: 'user-7',
        },
        prompt_memory: {
          memory_excerpt: 'owner asked for deletion',
        },
        action_history: {
          actor_user_id: 'admin-1',
        },
      }],
    })

    const [initialTask] = await riskRepo.listReviewTasks(created.id)
    expect(initialTask).toBeDefined()
    await service.claimTask(initialTask!.id, 'operator-1', {
      operator_note: 'picked up before transfer',
    })

    const transferred = await service.transferCase(created.id, 'operator-2', 'admin-1', {
      operator_note: 'handoff to deletion desk',
    })

    expect(transferred?.case?.assigned_to_user_id).toBe('operator-2')
    expect(transferred?.case?.claimed_by_user_id).toBe('operator-2')
    expect(transferred?.task?.assignee_user_id).toBe('operator-2')
    expect(transferred?.task?.status).toBe('ASSIGNED')

    const released = await service.releaseCase(created.id, 'admin-2', {
      operator_note: 'waiting_on_scope_confirmation',
    })

    expect(released?.case?.status).toBe('OPEN')
    expect(released?.case?.assigned_to_user_id).toBeNull()
    expect(released?.case?.claimed_by_user_id).toBeNull()
    expect(released?.tasks[0]?.status).toBe('PENDING')
    expect(released?.tasks[0]?.assignee_user_id).toBeNull()
    expect(released?.tasks[0]?.claim_token).toBeNull()

    const detail = await service.getCaseDetail(created.id)
    expect(detail?.linked_complaint?.id).toBe(complaint.id)
    expect(detail?.linked_appeal).toBeNull()

    const exportBundle = await service.buildEvidenceExport(created.id, { redaction: 'share' })
    expect(exportBundle?.linked_complaint?.id).toBe(complaint.id)
    expect(exportBundle?.redaction_level).toBe('share')
    expect(exportBundle?.redaction_notes.length).toBeGreaterThan(0)
    expect(exportBundle?.linked_complaint?.reporter_user_id).toBe('[REDACTED]')
    expect(exportBundle?.linked_complaint?.detail_text).toBe('[REDACTED]')
    expect(exportBundle?.action_logs.map((item) => item.action)).toEqual([
      'review_task_claimed',
      'case_transferred',
      'case_released',
    ])
    const claimedAction = exportBundle?.action_logs.find((item) => item.action === 'review_task_claimed')
    expect(claimedAction?.result).toMatchObject({
      claim_token: '[REDACTED]',
    })
    const transferredAction = exportBundle?.action_logs.find((item) => item.action === 'case_transferred')
    expect(transferredAction?.result).toMatchObject({
      from_assignee_user_id: '[REDACTED]',
      to_assignee_user_id: '[REDACTED]',
    })
    const releasedAction = exportBundle?.action_logs.find((item) => item.action === 'case_released')
    expect(releasedAction?.result).toMatchObject({
      previous_assignee_user_id: '[REDACTED]',
    })
    expect(exportBundle?.evidence.some((item) => item.snapshot_type === 'case_transferred')).toBe(true)
    expect(exportBundle?.evidence.some((item) => item.snapshot_type === 'case_released')).toBe(true)
    const complaintEvidence = exportBundle?.evidence.find((item) => item.snapshot_type === 'complaint_ticket')
    expect(complaintEvidence?.evidence_package).toMatchObject({
      content: {
        redacted: true,
      },
      prompt_memory: {
        redacted: true,
      },
      context: {
        reporter_user_id: '[REDACTED]',
      },
      action_history: {
        actor_user_id: '[REDACTED]',
      },
    })
  })
})
