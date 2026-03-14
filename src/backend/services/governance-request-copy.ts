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
