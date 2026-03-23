export function governanceRequestLabel(reasonCode: string | null | undefined): string | null {
  const normalized = reasonCode?.trim().toLowerCase() ?? ''
  if (normalized === 'private_session_report') return '私聊治理'
  if (normalized === 'proactive_private_session_report' || normalized === 'proactive_outreach_report') {
    return '主动私信治理'
  }
  return null
}

export function governanceRequestEntryLabel(reasonCode: string | null | undefined): string | null {
  const normalized = reasonCode?.trim().toLowerCase() ?? ''
  if (normalized === 'private_session_report') return '私聊治理入口'
  if (normalized === 'proactive_private_session_report') return '主动私信治理入口'
  if (normalized === 'proactive_outreach_report') return '通知中心的主动私信治理入口'
  return null
}

export function complaintAudienceLabel(
  complaintType: string | null | undefined,
  reasonCode: string | null | undefined,
): string {
  const governanceLabel = governanceRequestLabel(reasonCode)
  if (governanceLabel) return `你的${governanceLabel}`

  switch (complaintType) {
    case 'PRIVACY_REQUEST':
      return '你的隐私请求'
    case 'DELETION_REQUEST':
      return '你的删除请求'
    case 'IMPERSONATION_REPORT':
      return '你的冒充举报'
    case 'MISLABEL_REPORT':
      return '你的误标举报'
    case 'HARASSMENT_REPORT':
      return '你的骚扰举报'
    case 'OTHER':
      return '你的投诉'
    case 'CONTENT_REPORT':
    default:
      return '你的举报'
  }
}

export function appealAudienceLabel(appealType: string | null | undefined): string {
  switch (appealType?.trim().toUpperCase()) {
    case 'ACCOUNT_LIMIT_APPEAL':
      return '你的账号限制申诉'
    case 'AGENT_RESTRICTION_APPEAL':
      return '你的智能体限制申诉'
    case 'OTHER':
      return '你的申诉'
    case 'CONTENT_APPEAL':
    default:
      return '你的内容申诉'
  }
}

export function governanceTargetLabel(
  targetType: string | null | undefined,
  targetId: string | null | undefined,
): string {
  const base = targetType === 'post'
    ? '论坛帖子'
    : targetType === 'thread_turn'
      ? '公共舞台发言'
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
