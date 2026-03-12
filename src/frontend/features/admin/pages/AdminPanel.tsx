import { useState } from 'react'
import {
  useAssignModerationCase,
  useClaimModerationTask,
  useGovernanceAction,
  useHealth,
  useIdentityReviews,
  useModerationCase,
  useModerationEvidenceExport,
  useModerationQueue,
  useReleaseModerationCase,
  useReopenModerationCase,
  useResolveIdentityReview,
  useResolveModerationCase,
  useTransferModerationCase,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RuntimeDashboard } from '../components/RuntimeDashboard'
import type {
  AppealRequest,
  ComplaintTicket,
  GovernanceActionType,
  GovernanceResult,
  ReviewEvidenceSnapshot,
  ReviewEvidenceExport,
} from '@/api/types'
import { uix } from '@/shared/utils/uix'
const ACTION_OPTIONS: {
  value: GovernanceActionType
  label: string
}[] = [
  { value: 'approve', label: '通过' },
  { value: 'fold', label: '折叠' },
  { value: 'quarantine', label: '隔离' },
  { value: 'reject', label: '拒绝' },
  { value: 'ban_agent', label: '封禁智能体' },
  { value: 'unban_agent', label: '解封智能体' },
]
const TARGET_OPTIONS = [
  { value: 'post', label: '帖子' },
  { value: 'comment', label: '评论' },
  { value: 'message', label: '消息' },
  { value: 'agent', label: '智能体' },
] as const
const ACTION_LABELS: Record<string, string> = {
  approve: '通过',
  fold: '折叠',
  quarantine: '隔离',
  reject: '拒绝',
  ban_agent: '封禁',
  unban_agent: '解封',
}
const QUEUE_LABELS: Record<string, string> = {
  MODERATION: '自动审核',
  COMPLAINT: '投诉',
  APPEAL: '申诉',
  IDENTITY_REVIEW: '实名',
  CONFIG_REVIEW: '配置',
  PRIVACY: '隐私',
  DELETION: '删除',
  HOT_TOPIC: '热点',
}
const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: '公开',
  GRAY: '灰度',
  QUARANTINE: '隔离',
}
const STATE_LABELS: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
}
const REQUEST_STATUS_LABELS: Record<string, string> = {
  OPEN: '待接入',
  LINKED: '已关联',
  RESOLVED: '已处理',
  REJECTED: '已拒绝',
}
const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  CONTENT_REPORT: '内容举报',
  PRIVACY_REQUEST: '隐私请求',
  DELETION_REQUEST: '删除请求',
  IMPERSONATION_REPORT: '冒充举报',
  MISLABEL_REPORT: '误标举报',
  HARASSMENT_REPORT: '骚扰举报',
  OTHER: '其他投诉',
}
const APPEAL_TYPE_LABELS: Record<string, string> = {
  CONTENT_APPEAL: '内容申诉',
  ACCOUNT_LIMIT_APPEAL: '账号限制申诉',
  AGENT_RESTRICTION_APPEAL: '智能体限制申诉',
  OTHER: '其他申诉',
}

const EVIDENCE_SECTIONS = [
  { key: 'content', label: '原文' },
  { key: 'context', label: '上下文' },
  { key: 'policy_hits', label: '策略命中' },
  { key: 'prompt_memory', label: 'Prompt/Memory' },
  { key: 'topic_signals', label: 'Topic 信号' },
  { key: 'action_history', label: '动作记录' },
] as const

type EvidenceExportRedaction = 'operator' | 'share'

function buildQueuePlaybook(queue: string) {
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

function formatEvidencePreview(value: Record<string, unknown> | null | undefined): string | null {
  if (!value || Object.keys(value).length === 0) return null
  const serialized = JSON.stringify(value, null, 2)
  return serialized.length > 420 ? `${serialized.slice(0, 420)}...` : serialized
}

function formatJsonPreview(value: unknown, limit = 1_600): string | null {
  if (value === null || value === undefined) return null
  const serialized = JSON.stringify(value, null, 2)
  return serialized.length > limit ? `${serialized.slice(0, limit)}...` : serialized
}

function downloadJson(filename: string, payload: ReviewEvidenceExport) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function getEvidenceSections(evidence: ReviewEvidenceSnapshot) {
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

function RequestPanel({
  title,
  subtitle,
  status,
  lines,
}: {
  title: string
  subtitle: string
  status: string
  lines: string[]
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className={uix('uix-da8bf29040')}>{title}</p>
          <p className={uix('uix-abda0153e3')}>{subtitle}</p>
        </div>
        <Badge variant="outline">{REQUEST_STATUS_LABELS[status] ?? status}</Badge>
      </div>
      <div className="mt-2 space-y-1">
        {lines.map((line) => (
          <p key={line} className={uix('uix-abda0153e3')}>{line}</p>
        ))}
      </div>
    </div>
  )
}

function renderComplaintPanel(item: ComplaintTicket | null) {
  if (!item) return null
  return (
    <RequestPanel
      title={COMPLAINT_TYPE_LABELS[item.complaint_type] ?? item.complaint_type}
      subtitle={`${item.target_type}:${item.target_id}`}
      status={item.status}
      lines={[
        `reason_code: ${item.reason_code}`,
        item.detail_text ? `detail: ${item.detail_text}` : 'detail: 无',
        `attachments: ${item.attachments.length}`,
      ]}
    />
  )
}

function renderAppealPanel(item: AppealRequest | null) {
  if (!item) return null
  return (
    <RequestPanel
      title={APPEAL_TYPE_LABELS[item.appeal_type] ?? item.appeal_type}
      subtitle={`${item.target_type}:${item.target_id}`}
      status={item.status}
      lines={[
        `requester: ${item.requester_type}`,
        `reason: ${item.reason}`,
        item.linked_complaint_ticket_id ? `linked complaint: ${item.linked_complaint_ticket_id}` : 'linked complaint: 无',
      ]}
    />
  )
}

export function AdminPanel() {
  const { currentIdentity, user } = useAuth()
  const governance = useGovernanceAction()
  const { data: healthData } = useHealth()
  const { data: queueData } = useModerationQueue()
  const { data: identityReviews } = useIdentityReviews({ limit: 20 })
  const assignCase = useAssignModerationCase()
  const claimTask = useClaimModerationTask()
  const transferCase = useTransferModerationCase()
  const releaseCase = useReleaseModerationCase()
  const resolveCase = useResolveModerationCase()
  const reopenCase = useReopenModerationCase()
  const resolveIdentity = useResolveIdentityReview()
  const [action, setAction] = useState<GovernanceActionType>('approve')
  const [targetType, setTargetType] = useState<string>('post')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [transferUserId, setTransferUserId] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [evidenceExportRedaction, setEvidenceExportRedaction] = useState<EvidenceExportRedaction>('operator')
  const [history, setHistory] = useState<GovernanceResult[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const { data: caseDetail } = useModerationCase(selectedCaseId)
  const { data: evidenceExport, refetch: refetchEvidenceExport } = useModerationEvidenceExport(selectedCaseId, evidenceExportRedaction)
  if (currentIdentity !== 'admin') {
    return (
      <div className="space-y-4">
        <h1 className={uix('uix-65af6ac52c')}>管控台</h1>
        <div className={uix('uix-5218d295f2')}>
          <p className={uix('uix-26f026f8ad')}>
            请先通过下方工具栏切换为<strong>管理员</strong>身份。
          </p>
        </div>
      </div>
    )
  }
  const handleSubmit = async () => {
    if (!targetId.trim()) return
    try {
      const res = await governance.mutateAsync({
        action,
        target_type: targetType as 'post' | 'comment' | 'message' | 'agent',
        target_id: targetId.trim(),
        reason: reason.trim() || undefined,
      })
      setHistory((prev) => [res.data, ...prev])
      setTargetId('')
      setReason('')
    } catch {
      // error handled by mutation state
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className={uix('uix-65af6ac52c')}>管控台</h1>
        <p className={uix('uix-25be576b96')}>内容审核、治理操作与 Runtime 管理</p>
      </div>

      {healthData && (
        <div className={uix('uix-b61447e6ca')}>
          <span>系统状态</span>
          <Badge variant="outline" className={uix('uix-2801f8f0b2')}>
            {healthData.data.status === 'ok' ? '正常' : healthData.data.status}
          </Badge>
          <span className={uix('uix-bfa6031907')}>
            运行 {Math.round(healthData.data.uptime)} 秒
          </span>
        </div>
      )}

      <Tabs defaultValue="governance">
        <TabsList>
          <TabsTrigger value="governance">治理操作</TabsTrigger>
          <TabsTrigger value="runtime">Runtime</TabsTrigger>
        </TabsList>

        <TabsContent value="runtime" className={uix('uix-0ab8667228')}>
          <RuntimeDashboard />
        </TabsContent>

        <TabsContent value="governance" className={uix('uix-c52b72f5ca')}>
          <Card>
            <CardHeader className={uix('uix-f4cc511ff0')}>
              <CardTitle className={uix('uix-fc7473ca09')}>执行治理操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className={uix('uix-b3691fbf2a')}>操作类型</label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as GovernanceActionType)}
                    className={uix('uix-34e5554f24')}
                  >
                    {ACTION_OPTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={uix('uix-b3691fbf2a')}>目标类型</label>
                  <select
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}
                    className={uix('uix-34e5554f24')}
                  >
                    {TARGET_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                placeholder="目标 ID（如 post_123…）"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className={uix('uix-fc76479a37')}
              />
              <Input
                placeholder="原因（选填）"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={uix('uix-fc76479a37')}
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={governance.isPending || !targetId.trim()}
              >
                {governance.isPending ? '执行中…' : '执行操作'}
              </Button>
              {governance.isError && (
                <p className={uix('uix-551c237449')}>{governance.error.message}</p>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <section>
              <h2 className={uix('uix-673a51ffad')}>操作记录</h2>
              <div className="space-y-1">
                {history.map((result, idx) => (
                  <div key={idx} className={uix('uix-81af913189')}>
                    <div>
                      <p className={uix('uix-da8bf29040')}>
                        {ACTION_LABELS[result.action] ?? result.action} → {result.target_id}
                      </p>
                      <p className={uix('uix-abda0153e3')}>
                        {result.new_visibility &&
                          `可见性：${VISIBILITY_LABELS[result.new_visibility] ?? result.new_visibility}`}
                        {result.new_state &&
                          ` · 状态：${STATE_LABELS[result.new_state] ?? result.new_state}`}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={result.success ? uix('uix-6196a83432') : uix('uix-a47175a4cf')}
                    >
                      {result.success ? '成功' : '失败'}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader className={uix('uix-f4cc511ff0')}>
                <CardTitle className={uix('uix-fc7473ca09')}>审核队列</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(queueData?.data ?? []).length === 0 && (
                  <p className={uix('uix-abda0153e3')}>当前没有待处理 case。</p>
                )}
                {(queueData?.data ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedCaseId(item.id)
                      setTransferUserId('')
                      setTransferNote('')
                      setEvidenceExportRedaction('operator')
                    }}
                    className={uix('uix-81af913189')}
                  >
                    <div className="text-left">
                      <p className={uix('uix-da8bf29040')}>
                        {item.case_type} · {item.summary_text ?? item.id}
                      </p>
                      <p className={uix('uix-abda0153e3')}>
                        {QUEUE_LABELS[item.queue] ?? item.queue} · {item.status} · priority {item.priority}
                        {item.assigned_to_user_id ? ` · assignee ${item.assigned_to_user_id}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline">{QUEUE_LABELS[item.queue] ?? item.queue}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={uix('uix-f4cc511ff0')}>
                <CardTitle className={uix('uix-fc7473ca09')}>Case 详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!caseDetail?.data && (
                  <p className={uix('uix-abda0153e3')}>从左侧选择一个 case 查看详情。</p>
                )}
                {caseDetail?.data && (
                  <>
                    {(() => {
                      const currentCase = caseDetail.data.case
                      const caseIsClosed = currentCase.status === 'RESOLVED' || currentCase.status === 'DISMISSED'
                      const caseIsOpen = currentCase.status === 'OPEN' || currentCase.status === 'IN_REVIEW'
                      return (
                        <>
                    <div>
                      <p className={uix('uix-da8bf29040')}>
                        {currentCase.case_type} · {currentCase.status}
                      </p>
                      <p className={uix('uix-abda0153e3')}>
                        {QUEUE_LABELS[currentCase.queue] ?? currentCase.queue}
                        {' · '}
                        {currentCase.summary_text ?? '无摘要'}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          主对象 {currentCase.primary_target_type ?? 'unknown'}:{currentCase.primary_target_id ?? 'n/a'}
                        </Badge>
                        {currentCase.linked_complaint_ticket_id && (
                          <Badge variant="outline">投诉 {currentCase.linked_complaint_ticket_id}</Badge>
                        )}
                        {currentCase.linked_appeal_request_id && (
                          <Badge variant="outline">申诉 {currentCase.linked_appeal_request_id}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={assignCase.isPending || caseIsClosed}
                        onClick={() => assignCase.mutate({ case_id: currentCase.id, assignee_user_id: user?.id ?? null })}
                      >
                        指派给我
                      </Button>
                      <Button
                        size="sm"
                        disabled={resolveCase.isPending || caseIsClosed}
                        onClick={() => resolveCase.mutate({ case_id: currentCase.id, resolution_action: 'resolved_in_admin_panel' })}
                      >
                        解决
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reopenCase.isPending || caseIsOpen}
                        onClick={() => reopenCase.mutate({ case_id: currentCase.id, opened_reason: 'manual_reopen' })}
                      >
                        重新打开
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={releaseCase.isPending || caseIsClosed || (!currentCase.assigned_to_user_id && !currentCase.claimed_by_user_id)}
                        onClick={() => releaseCase.mutate({
                          case_id: currentCase.id,
                          operator_note: transferNote.trim() || undefined,
                        })}
                      >
                        释放回队列
                      </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <Input
                          placeholder="转派给用户 ID"
                          value={transferUserId}
                          onChange={(e) => setTransferUserId(e.target.value)}
                        />
                        <Input
                          placeholder="转派备注（选填）"
                          value={transferNote}
                          onChange={(e) => setTransferNote(e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={transferCase.isPending || caseIsClosed || !transferUserId.trim()}
                          onClick={() => transferCase.mutate({
                            case_id: currentCase.id,
                            assignee_user_id: transferUserId.trim(),
                            operator_note: transferNote.trim() || undefined,
                          })}
                        >
                          转派
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const result = await refetchEvidenceExport()
                            if (result.data?.data) {
                              downloadJson(
                                `case-${currentCase.id}-evidence-export-${evidenceExportRedaction}.json`,
                                result.data.data,
                              )
                            }
                          }}
                        >
                          导出当前证据包
                        </Button>
                      </div>
                    </div>
                    <Tabs key={currentCase.id} defaultValue="overview" className="space-y-3">
                      <TabsList className="flex flex-wrap">
                        <TabsTrigger value="overview">概览</TabsTrigger>
                        <TabsTrigger value="requests">投诉/申诉</TabsTrigger>
                        <TabsTrigger value="evidence">证据</TabsTrigger>
                        <TabsTrigger value="tasks">任务</TabsTrigger>
                        <TabsTrigger value="export">导出</TabsTrigger>
                      </TabsList>

                      <TabsContent value="overview" className="space-y-3">
                        <div>
                          <p className={uix('uix-b3691fbf2a')}>Targets</p>
                          <div className="space-y-1">
                            {caseDetail.data.targets.map((target) => (
                              <div key={target.id} className={uix('uix-abda0153e3')}>
                                {target.relation_type} · {target.channel} · {target.target_type}:{target.target_id}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className={uix('uix-b3691fbf2a')}>Risk Summary</p>
                          <pre className="mt-1 whitespace-pre-wrap break-all rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                            {formatJsonPreview(currentCase.risk_summary ?? { summary: null }) ?? '{}'}
                          </pre>
                        </div>
                        <div>
                          <p className={uix('uix-b3691fbf2a')}>Queue Playbook</p>
                          <p className={uix('uix-abda0153e3')}>
                            {buildQueuePlaybook(currentCase.queue).summary}
                          </p>
                          <div className="space-y-1">
                            {buildQueuePlaybook(currentCase.queue).checklist.map((line) => (
                              <p key={line} className={uix('uix-abda0153e3')}>
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="requests" className="space-y-3">
                        {renderComplaintPanel(caseDetail.data.linked_complaint)}
                        {renderAppealPanel(caseDetail.data.linked_appeal)}
                        {!caseDetail.data.linked_complaint && !caseDetail.data.linked_appeal && (
                          <p className={uix('uix-abda0153e3')}>当前 case 还没有关联 complaint/appeal 对象。</p>
                        )}
                      </TabsContent>

                      <TabsContent value="evidence" className="space-y-2">
                        {caseDetail.data.evidence.map((evidence) => (
                          <div key={evidence.id} className="rounded-md border p-2 text-left">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={uix('uix-da8bf29040')}>{evidence.snapshot_type}</p>
                              {getEvidenceSections(evidence).map((section) => (
                                <Badge key={`${evidence.id}-${section.key}`} variant="outline">
                                  {section.label}
                                </Badge>
                              ))}
                            </div>
                            <div className="mt-2 space-y-2">
                              {getEvidenceSections(evidence).map((section) => (
                                <div key={`${evidence.id}-${section.key}-preview`} className="rounded-md bg-slate-50 p-2">
                                  <p className={uix('uix-b3691fbf2a')}>{section.label}</p>
                                  <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-slate-600">
                                    {section.preview}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {caseDetail.data.evidence.length === 0 && (
                          <p className={uix('uix-abda0153e3')}>当前没有 evidence snapshot。</p>
                        )}
                      </TabsContent>

                      <TabsContent value="tasks" className="space-y-2">
                        {caseDetail.data.tasks.map((task) => (
                          <div key={task.id} className={uix('uix-81af913189')}>
                            <div className="text-left">
                              <p className={uix('uix-da8bf29040')}>
                                {task.task_type} · {task.status}
                              </p>
                              <p className={uix('uix-abda0153e3')}>
                                {QUEUE_LABELS[task.queue] ?? task.queue}
                                {task.assigned_role ? ` · ${task.assigned_role}` : ''}
                                {task.assignee_user_id ? ` · assignee ${task.assignee_user_id}` : ''}
                                {task.due_at ? ` · SLA ${new Date(task.due_at).toLocaleString()}` : ''}
                              </p>
                            </div>
                            {task.status !== 'COMPLETED' && task.status !== 'CANCELED' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={claimTask.isPending || task.status !== 'PENDING'}
                                  onClick={() => claimTask.mutate({ task_id: task.id, case_id: currentCase.id })}
                                >
                                  认领任务
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={releaseCase.isPending || caseIsClosed || task.status !== 'ASSIGNED'}
                                  onClick={() => releaseCase.mutate({
                                    case_id: currentCase.id,
                                    operator_note: `release_task:${task.id}`,
                                  })}
                                >
                                  释放
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {caseDetail.data.tasks.length === 0 && (
                          <p className={uix('uix-abda0153e3')}>当前没有 review task。</p>
                        )}
                      </TabsContent>

                      <TabsContent value="export" className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={evidenceExportRedaction}
                            onChange={(e) => setEvidenceExportRedaction(e.target.value as EvidenceExportRedaction)}
                            className={uix('uix-34e5554f24')}
                          >
                            <option value="operator">内部导出</option>
                            <option value="share">分享导出</option>
                          </select>
                          <Badge variant="outline">
                            {evidenceExport?.data?.exported_at
                              ? `last export ${new Date(evidenceExport.data.exported_at).toLocaleString()}`
                              : '尚未生成导出'}
                          </Badge>
                          <Badge variant="outline">
                            redaction {evidenceExport?.data?.redaction_level ?? evidenceExportRedaction}
                          </Badge>
                          <Badge variant="outline">
                            action logs {evidenceExport?.data?.action_logs.length ?? 0}
                          </Badge>
                          <Badge variant="outline">
                            evidence {evidenceExport?.data?.evidence.length ?? 0}
                          </Badge>
                        </div>
                        {(evidenceExport?.data?.redaction_notes.length ?? 0) > 0 && (
                          <div className="space-y-1">
                            {evidenceExport?.data?.redaction_notes.map((note) => (
                              <p key={note} className={uix('uix-abda0153e3')}>
                                {note}
                              </p>
                            ))}
                          </div>
                        )}
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                          {formatJsonPreview(evidenceExport?.data ?? { pending: true }, 2_400) ?? '{}'}
                        </pre>
                      </TabsContent>
                    </Tabs>
                        </>
                      )
                    })()}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className={uix('uix-f4cc511ff0')}>
              <CardTitle className={uix('uix-fc7473ca09')}>实名审核</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(identityReviews?.data ?? []).slice(0, 8).map((item) => (
                <div key={item.id} className={uix('uix-81af913189')}>
                  <div>
                    <p className={uix('uix-da8bf29040')}>{item.user_id}</p>
                    <p className={uix('uix-abda0153e3')}>{item.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveIdentity.mutate({ user_id: item.user_id, status: 'VERIFIED' })}
                    >
                      通过
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveIdentity.mutate({ user_id: item.user_id, status: 'REJECTED' })}
                    >
                      驳回
                    </Button>
                  </div>
                </div>
              ))}
              {(identityReviews?.data ?? []).length === 0 && (
                <p className={uix('uix-abda0153e3')}>暂无实名审核记录。</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
