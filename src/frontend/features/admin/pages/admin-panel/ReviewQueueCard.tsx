import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { uix } from '@/shared/utils/uix'
import {
  buildQueuePlaybook,
  downloadJson,
  formatJsonPreview,
  getEvidenceSections,
  QUEUE_LABELS,
} from './constants'
import { AppealPanel, ComplaintPanel } from './request-panels'
import type { AdminPanelController } from './use-admin-panel-controller'

type AuthSlice = AdminPanelController['auth']
type ReviewSlice = AdminPanelController['review']

export function ReviewQueueCard({ auth, review }: { auth: AuthSlice; review: ReviewSlice }) {
  const detail = review.caseDetail?.data
  const currentCase = detail?.case ?? null
  const caseIsClosed =
    currentCase?.status === 'RESOLVED' || currentCase?.status === 'DISMISSED'
  const caseIsOpen = currentCase?.status === 'OPEN' || currentCase?.status === 'IN_REVIEW'

  return (
    <div className={uix('uix-4933602967')}>
      <Card>
        <CardHeader className={uix('uix-f4cc511ff0')}>
          <CardTitle className={uix('uix-fc7473ca09')}>审核队列</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(review.queueData?.data ?? []).length === 0 && (
            <p className={uix('uix-abda0153e3')}>当前没有待处理 case。</p>
          )}
          {(review.queueData?.data ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                review.setSelectedCaseId(item.id)
                review.setTransferUserId('')
                review.setTransferNote('')
                review.setEvidenceExportRedaction('operator')
              }}
              className={uix('uix-81af913189')}
            >
              <div className={uix('uix-938390cb99')}>
                <p className={uix('uix-da8bf29040')}>
                  {item.case_type} · {item.summary_text ?? item.id}
                </p>
                <p className={uix('uix-abda0153e3')}>
                  {QUEUE_LABELS[item.queue] ?? item.queue} · {item.status} · priority{' '}
                  {item.priority}
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
          {!detail && <p className={uix('uix-abda0153e3')}>从左侧选择一个 case 查看详情。</p>}
          {detail && currentCase && (
            <>
              <div>
                <p className={uix('uix-da8bf29040')}>
                  {currentCase.case_type} · {currentCase.status}
                </p>
                <p className={uix('uix-abda0153e3')}>
                  {QUEUE_LABELS[currentCase.queue] ?? currentCase.queue} ·{' '}
                  {currentCase.summary_text ?? '无摘要'}
                </p>
              </div>
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    主对象 {currentCase.primary_target_type ?? 'unknown'}:
                    {currentCase.primary_target_id ?? 'n/a'}
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
                    disabled={review.assignCase.isPending || caseIsClosed}
                    onClick={() =>
                      review.assignCase.mutate({
                        case_id: currentCase.id,
                        assignee_user_id: auth.user?.id ?? null,
                      })
                    }
                  >
                    指派给我
                  </Button>
                  <Button
                    size="sm"
                    disabled={review.resolveCase.isPending || caseIsClosed}
                    onClick={() =>
                      review.resolveCase.mutate({
                        case_id: currentCase.id,
                        resolution_action: 'resolved_in_admin_panel',
                      })
                    }
                  >
                    解决
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={review.reopenCase.isPending || caseIsOpen}
                    onClick={() =>
                      review.reopenCase.mutate({
                        case_id: currentCase.id,
                        opened_reason: 'manual_reopen',
                      })
                    }
                  >
                    重新打开
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      review.releaseCase.isPending ||
                      caseIsClosed ||
                      (!currentCase.assigned_to_user_id && !currentCase.claimed_by_user_id)
                    }
                    onClick={() =>
                      review.releaseCase.mutate({
                        case_id: currentCase.id,
                        operator_note: review.transferNote.trim() || undefined,
                      })
                    }
                  >
                    释放回队列
                  </Button>
                </div>
                <div className={uix('uix-ce55a4e3e0')}>
                  <Input
                    placeholder="转派给用户 ID"
                    value={review.transferUserId}
                    onChange={(event) => review.setTransferUserId(event.target.value)}
                  />
                  <Input
                    placeholder="转派备注（选填）"
                    value={review.transferNote}
                    onChange={(event) => review.setTransferNote(event.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      review.transferCase.isPending ||
                      caseIsClosed ||
                      !review.transferUserId.trim()
                    }
                    onClick={() =>
                      review.transferCase.mutate({
                        case_id: currentCase.id,
                        assignee_user_id: review.transferUserId.trim(),
                        operator_note: review.transferNote.trim() || undefined,
                      })
                    }
                  >
                    转派
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const result = await review.refetchEvidenceExport()
                      if (result.data?.data) {
                        downloadJson(
                          `case-${currentCase.id}-evidence-export-${review.evidenceExportRedaction}.json`,
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
                      {detail.targets.map((target) => (
                        <div key={target.id} className={uix('uix-abda0153e3')}>
                          {target.relation_type} · {target.channel} · {target.target_type}:
                          {target.target_id}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={uix('uix-b3691fbf2a')}>Risk Summary</p>
                    <pre className={uix('uix-0f17a55f63')}>
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
                  <ComplaintPanel item={detail.linked_complaint} />
                  <AppealPanel item={detail.linked_appeal} />
                  {!detail.linked_complaint && !detail.linked_appeal && (
                    <p className={uix('uix-abda0153e3')}>
                      当前 case 还没有关联 complaint/appeal 对象。
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="evidence" className="space-y-2">
                  {detail.evidence.map((evidence) => (
                    <div key={evidence.id} className={uix('uix-aa56c9aa01')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={uix('uix-da8bf29040')}>{evidence.snapshot_type}</p>
                        {getEvidenceSections(evidence).map((section) => (
                          <Badge key={`${evidence.id}-${section.key}`} variant="outline">
                            {section.label}
                          </Badge>
                        ))}
                      </div>
                      <div className={uix('uix-f4f6a4f40e')}>
                        {getEvidenceSections(evidence).map((section) => (
                          <div
                            key={`${evidence.id}-${section.key}-preview`}
                            className={uix('uix-f2389d4df1')}
                          >
                            <p className={uix('uix-b3691fbf2a')}>{section.label}</p>
                            <pre className={uix('uix-4fdc9d7d12')}>{section.preview}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {detail.evidence.length === 0 && (
                    <p className={uix('uix-abda0153e3')}>当前没有 evidence snapshot。</p>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="space-y-2">
                  {detail.tasks.map((task) => (
                    <div key={task.id} className={uix('uix-81af913189')}>
                      <div className={uix('uix-938390cb99')}>
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
                            disabled={review.claimTask.isPending || task.status !== 'PENDING'}
                            onClick={() =>
                              review.claimTask.mutate({
                                task_id: task.id,
                                case_id: currentCase.id,
                              })
                            }
                          >
                            认领任务
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              review.releaseCase.isPending ||
                              caseIsClosed ||
                              task.status !== 'ASSIGNED'
                            }
                            onClick={() =>
                              review.releaseCase.mutate({
                                case_id: currentCase.id,
                                operator_note: `release_task:${task.id}`,
                              })
                            }
                          >
                            释放
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {detail.tasks.length === 0 && (
                    <p className={uix('uix-abda0153e3')}>当前没有 review task。</p>
                  )}
                </TabsContent>

                <TabsContent value="export" className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={review.evidenceExportRedaction}
                      onChange={(event) =>
                        review.setEvidenceExportRedaction(
                          event.target.value as 'operator' | 'share',
                        )
                      }
                      className={uix('uix-34e5554f24')}
                    >
                      <option value="operator">内部导出</option>
                      <option value="share">分享导出</option>
                    </select>
                    <Badge variant="outline">
                      {review.evidenceExport?.data?.exported_at
                        ? `last export ${new Date(
                            review.evidenceExport.data.exported_at,
                          ).toLocaleString()}`
                        : '尚未生成导出'}
                    </Badge>
                    <Badge variant="outline">
                      redaction{' '}
                      {review.evidenceExport?.data?.redaction_level ??
                        review.evidenceExportRedaction}
                    </Badge>
                    <Badge variant="outline">
                      action logs {review.evidenceExport?.data?.action_logs.length ?? 0}
                    </Badge>
                    <Badge variant="outline">
                      evidence {review.evidenceExport?.data?.evidence.length ?? 0}
                    </Badge>
                  </div>
                  {(review.evidenceExport?.data?.redaction_notes.length ?? 0) > 0 && (
                    <div className="space-y-1">
                      {review.evidenceExport?.data?.redaction_notes.map((note) => (
                        <p key={note} className={uix('uix-abda0153e3')}>
                          {note}
                        </p>
                      ))}
                    </div>
                  )}
                  <pre className={uix('uix-6e2e4af21f')}>
                    {formatJsonPreview(review.evidenceExport?.data ?? { pending: true }, 2_400) ??
                      '{}'}
                  </pre>
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
