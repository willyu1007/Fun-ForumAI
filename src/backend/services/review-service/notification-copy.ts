import { complaintAudienceLabel } from '../governance-request-copy.js'

export function complaintNotificationTitle(input: {
  complaintType: string | null | undefined
  reasonCode: string | null | undefined
  status: 'RESOLVED' | 'REJECTED' | 'LINKED'
}): string {
  const base = complaintAudienceLabel(input.complaintType, input.reasonCode)
  if (input.status === 'LINKED') return `${base}已重新进入审核`
  if (input.status === 'REJECTED') return `${base}已结案`
  return `${base}已处理`
}

export function appealNotificationTitle(
  appealType: string | null | undefined,
  status: 'RESOLVED' | 'REJECTED' | 'LINKED',
): string {
  const base = appealType === 'ACCOUNT_LIMIT_APPEAL'
    ? '你的账号限制申诉'
    : appealType === 'AGENT_RESTRICTION_APPEAL'
      ? '你的智能体限制申诉'
      : appealType === 'OTHER'
        ? '你的申诉'
        : '你的内容申诉'
  if (status === 'LINKED') return `${base}已重新进入审核`
  if (status === 'REJECTED') return `${base}已驳回`
  return `${base}已处理`
}

export function targetLabel(
  targetType: string | null | undefined,
  targetId: string | null | undefined,
): string {
  const base = targetType === 'post'
    ? '论坛帖子'
    : targetType === 'comment'
      ? '评论区回复'
      : targetType === 'message'
        ? '聊天室发言'
        : targetType === 'private_session'
          ? '私聊会话'
          : targetType === 'agent'
            ? '智能体主页'
            : targetType === 'config_revision'
              ? '配置修订'
              : targetType === 'complaint_ticket'
                ? '举报单'
                : targetType === 'appeal_request'
                  ? '申诉单'
                  : '治理对象'

  return targetId ? `${base} · ${targetId}` : base
}

export function resolutionNotificationBody(input: {
  caseId: string
  resolutionAction: string
  targetType: string | null | undefined
  targetId: string | null | undefined
}): string {
  return `目标对象 ${targetLabel(input.targetType, input.targetId)} · case ${input.caseId} · 动作 ${input.resolutionAction}`
}

export function reopenNotificationBody(input: {
  caseId: string
  openedReason: string
  targetType: string | null | undefined
  targetId: string | null | undefined
}): string {
  return `目标对象 ${targetLabel(input.targetType, input.targetId)} · case ${input.caseId} · 重开原因 ${input.openedReason}`
}
