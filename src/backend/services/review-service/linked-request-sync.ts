import type { ModerationCase } from '../../repos/types.js'
import {
  appealNotificationTitle,
  complaintNotificationTitle,
  reopenNotificationBody,
  resolutionNotificationBody,
} from './notification-copy.js'
import {
  createGovernanceNotification,
  deriveTicketStatusFromResolution,
  getCaseLinks,
  type ReviewServiceContext,
} from './shared.js'

export async function syncLinkedRequestsOnResolved(
  context: ReviewServiceContext,
  input: {
    moderationCase: ModerationCase
    resolutionAction: string
    resolutionNote: string | null
    actorUserId: string
    resolvedAt: Date
  },
): Promise<void> {
  const links = await getCaseLinks(context, input.moderationCase)
  const ticketStatus = deriveTicketStatusFromResolution(input.resolutionAction)
  const baseResult = {
    linked_case_id: input.moderationCase.id,
    case_status: input.moderationCase.status,
    resolution_action: input.resolutionAction,
    resolution_note: input.resolutionNote,
    resolved_by_user_id: input.actorUserId,
    resolved_at: input.resolvedAt.toISOString(),
  }

  if (links.linked_complaint) {
    await context.riskRepo.updateComplaintTicket(links.linked_complaint.id, {
      status: ticketStatus,
      resolution: baseResult,
    })
    await createGovernanceNotification(context, {
      user_id: links.linked_complaint.reporter_user_id,
      title: complaintNotificationTitle({
        complaintType: links.linked_complaint.complaint_type,
        reasonCode: links.linked_complaint.reason_code,
        status: ticketStatus,
      }),
      body: resolutionNotificationBody({
        caseId: input.moderationCase.id,
        resolutionAction: input.resolutionAction,
        targetType: links.linked_complaint.target_type,
        targetId: links.linked_complaint.target_id,
      }),
      target_type: 'complaint_ticket',
      target_id: links.linked_complaint.id,
    })
  }

  if (links.linked_appeal) {
    await context.riskRepo.updateAppealRequest(links.linked_appeal.id, {
      status: ticketStatus,
      result: baseResult,
    })
    await createGovernanceNotification(context, {
      user_id: links.linked_appeal.requester_user_id,
      title: appealNotificationTitle(links.linked_appeal.appeal_type, ticketStatus),
      body: resolutionNotificationBody({
        caseId: input.moderationCase.id,
        resolutionAction: input.resolutionAction,
        targetType: links.linked_appeal.target_type,
        targetId: links.linked_appeal.target_id,
      }),
      target_type: 'appeal_request',
      target_id: links.linked_appeal.id,
    })
  }
}

export async function syncLinkedRequestsOnReopened(
  context: ReviewServiceContext,
  input: {
    moderationCase: ModerationCase
    actorUserId: string
    openedReason: string
  },
): Promise<void> {
  const links = await getCaseLinks(context, input.moderationCase)
  const reopenedMeta = {
    linked_case_id: input.moderationCase.id,
    case_status: input.moderationCase.status,
    reopened_by_user_id: input.actorUserId,
    opened_reason: input.openedReason,
    reopened_at: new Date().toISOString(),
  }

  if (links.linked_complaint) {
    await context.riskRepo.updateComplaintTicket(links.linked_complaint.id, {
      status: 'LINKED',
      resolution: reopenedMeta,
    })
    await createGovernanceNotification(context, {
      user_id: links.linked_complaint.reporter_user_id,
      title: complaintNotificationTitle({
        complaintType: links.linked_complaint.complaint_type,
        reasonCode: links.linked_complaint.reason_code,
        status: 'LINKED',
      }),
      body: reopenNotificationBody({
        caseId: input.moderationCase.id,
        openedReason: input.openedReason,
        targetType: links.linked_complaint.target_type,
        targetId: links.linked_complaint.target_id,
      }),
      target_type: 'complaint_ticket',
      target_id: links.linked_complaint.id,
    })
  }

  if (links.linked_appeal) {
    await context.riskRepo.updateAppealRequest(links.linked_appeal.id, {
      status: 'LINKED',
      result: reopenedMeta,
    })
    await createGovernanceNotification(context, {
      user_id: links.linked_appeal.requester_user_id,
      title: appealNotificationTitle(links.linked_appeal.appeal_type, 'LINKED'),
      body: reopenNotificationBody({
        caseId: input.moderationCase.id,
        openedReason: input.openedReason,
        targetType: links.linked_appeal.target_type,
        targetId: links.linked_appeal.target_id,
      }),
      target_type: 'appeal_request',
      target_id: links.linked_appeal.id,
    })
  }
}
