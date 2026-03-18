import {
  appealAudienceLabel,
  complaintAudienceLabel,
  governanceTargetLabel,
} from '../governance-text.js'

type LinkedRequestStatus = 'RESOLVED' | 'REJECTED' | 'LINKED'

export function complaintLinkedRequestNotificationTitle(input: {
  complaintType: string | null | undefined
  reasonCode: string | null | undefined
  status: LinkedRequestStatus
}): string {
  const base = complaintAudienceLabel(input.complaintType, input.reasonCode)
  if (input.status === 'LINKED') return `${base}已重新进入审核`
  if (input.status === 'REJECTED') return `${base}已结案`
  return `${base}已处理`
}

export function appealLinkedRequestNotificationTitle(
  appealType: string | null | undefined,
  status: LinkedRequestStatus,
): string {
  const base = appealAudienceLabel(appealType)
  if (status === 'LINKED') return `${base}已重新进入审核`
  if (status === 'REJECTED') return `${base}已驳回`
  return `${base}已处理`
}

export function linkedRequestResolutionNotificationBody(input: {
  caseId: string
  resolutionAction: string
  targetType: string | null | undefined
  targetId: string | null | undefined
}): string {
  return `目标对象 ${governanceTargetLabel(input.targetType, input.targetId)} · case ${input.caseId} · 动作 ${input.resolutionAction}`
}

export function linkedRequestReopenNotificationBody(input: {
  caseId: string
  openedReason: string
  targetType: string | null | undefined
  targetId: string | null | undefined
}): string {
  return `目标对象 ${governanceTargetLabel(input.targetType, input.targetId)} · case ${input.caseId} · 重开原因 ${input.openedReason}`
}
