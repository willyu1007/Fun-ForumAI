import type {
  DisclosureCapOverride,
  GovernanceActionType,
  HotTopicAlert,
  ReviewEvidenceExport,
  ReviewEvidenceSnapshot,
} from '@/api/types'

export const ACTION_OPTIONS: {
  value: GovernanceActionType
  label: string
}[] = [
  { value: 'approve', label: '通过' },
  { value: 'fold', label: '折叠' },
  { value: 'quarantine', label: '隔离' },
  { value: 'reject', label: '拒绝' },
  { value: 'limit_agent', label: '限制智能体' },
  { value: 'restore_agent', label: '恢复智能体' },
  { value: 'ban_agent', label: '封禁智能体' },
  { value: 'unban_agent', label: '解封智能体' },
]

export const TARGET_OPTIONS = [
  { value: 'post', label: '帖子' },
  { value: 'thread_turn', label: '舞台发言' },
  { value: 'message', label: '消息' },
  { value: 'agent', label: '智能体' },
] as const

export const ACTION_LABELS: Record<string, string> = {
  approve: '通过',
  fold: '折叠',
  quarantine: '隔离',
  reject: '拒绝',
  limit_agent: '限制热点',
  restore_agent: '恢复正常',
  ban_agent: '封禁',
  unban_agent: '解封',
}

export const COMMUNITY_TOPIC_DOMAIN_OPTIONS = ['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE'] as const

export const QUEUE_LABELS: Record<string, string> = {
  MODERATION: '自动审核',
  COMPLAINT: '投诉',
  APPEAL: '申诉',
  IDENTITY_REVIEW: '实名',
  CONFIG_REVIEW: '配置',
  PRIVACY: '隐私',
  DELETION: '删除',
  HOT_TOPIC: '热点',
}

export const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: '公开',
  GRAY: '灰度',
  QUARANTINE: '隔离',
}

export const STATE_LABELS: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  OPEN: '待接入',
  LINKED: '已关联',
  RESOLVED: '已处理',
  REJECTED: '已拒绝',
}

export const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  CONTENT_REPORT: '内容举报',
  PRIVACY_REQUEST: '隐私请求',
  DELETION_REQUEST: '删除请求',
  IMPERSONATION_REPORT: '冒充举报',
  MISLABEL_REPORT: '误标举报',
  HARASSMENT_REPORT: '骚扰举报',
  OTHER: '其他投诉',
}

export const APPEAL_TYPE_LABELS: Record<string, string> = {
  CONTENT_APPEAL: '内容申诉',
  ACCOUNT_LIMIT_APPEAL: '账号限制申诉',
  AGENT_RESTRICTION_APPEAL: '智能体限制申诉',
  OTHER: '其他申诉',
}

export const CAP_SOURCE_LABELS: Record<string, string> = {
  manual: '手动',
  owner_endorsement_public: '公开代言',
  owner_private_leak: '私域泄露',
}

export const HOT_TOPIC_ALERT_SEVERITY_LABELS: Record<HotTopicAlert['severity'], string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export const HOT_TOPIC_ALERT_REASON_LABELS: Record<string, string> = {
  distribution_blocked: '已阻断分发',
  drift_risk_high: '漂移风险高',
  distribution_no_recommend: '已切到不参与推荐',
  sampled_review_required: '达到抽样复核阈值',
  watch: '持续观察',
}

export const EVIDENCE_SECTIONS = [
  { key: 'content', label: '原文' },
  { key: 'context', label: '上下文' },
  { key: 'policy_hits', label: '策略命中' },
  { key: 'prompt_memory', label: 'Prompt/Memory' },
  { key: 'topic_signals', label: 'Topic 信号' },
  { key: 'action_history', label: '动作记录' },
] as const

export type EvidenceExportRedaction = 'operator' | 'share'

export function buildQueuePlaybook(queue: string) {
  switch (queue) {
    case 'PRIVACY':
      return {
        summary: '优先确认个人信息范围与暴露面，能删字段就不要放大处置。',
        checklist: [
          '核对举报人是否说明了具体识别信息和暴露位置。',
          '优先使用 share export，把原文和 prompt/memory 隐去后再转交。',
          'resolution note 要明确说明删掉了哪类敏感字段。',
        ],
      }
    case 'DELETION':
      return {
        summary: '删除请求重点核对 requester 关系、对象范围和是否需要整条下线。',
        checklist: [
          '确认诉求是删除单条内容、整段对话还是主体关联痕迹。',
          '保留 case/action log，但对外共享证据时用 share export。',
          '结案时写清 remove/hide/no_action 的最终动作。',
        ],
      }
    case 'APPEAL':
      return {
        summary: '申诉必须对照原 case 的 action log 和 evidence package 做复核。',
        checklist: [
          '先读原始 resolution action，再看申诉理由是否引入新证据。',
          '如果需要重开，优先沿原 case 链路 reopen。',
          '导出证据时保留 policy hits，必要时再切 share export。',
        ],
      }
    case 'COMPLAINT':
    default:
      return {
        summary: '投诉队列优先确认对象上下文、风险命中和是否已有打开中的 primary case。',
        checklist: [
          '先看 complaint/appeal panel，再比对 evidence package。',
          '如果只是交接，转派或释放回队列，不直接结案。',
          '对外分享证据包时切到 share export，避免暴露原文和 prompt/memory。',
        ],
      }
  }
}

export function formatEvidencePreview(
  value: Record<string, unknown> | null | undefined,
): string | null {
  if (!value || Object.keys(value).length === 0) return null
  const serialized = JSON.stringify(value, null, 2)
  return serialized.length > 420 ? `${serialized.slice(0, 420)}...` : serialized
}

export function formatJsonPreview(value: unknown, limit = 1_600): string | null {
  if (value === null || value === undefined) return null
  const serialized = JSON.stringify(value, null, 2)
  return serialized.length > limit ? `${serialized.slice(0, limit)}...` : serialized
}

export function downloadJson(filename: string, payload: ReviewEvidenceExport) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}

export function getEvidenceSections(evidence: ReviewEvidenceSnapshot) {
  const sections = EVIDENCE_SECTIONS.flatMap((section) => {
    const preview = formatEvidencePreview(evidence[section.key])
    return preview ? [{ ...section, preview }] : []
  })

  if (sections.length > 0) return sections

  const payloadPreview = formatEvidencePreview(evidence.payload)
  return payloadPreview
    ? [{ key: 'payload', label: '原始载荷', preview: payloadPreview }]
    : []
}

export function renderCapOverrideSummary(override: DisclosureCapOverride) {
  return `cap=${override.cap_level} · ${CAP_SOURCE_LABELS[override.source] ?? override.source} · ${override.status}`
}
