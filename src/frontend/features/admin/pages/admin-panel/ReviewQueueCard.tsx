import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildQueuePlaybook,
  downloadJson,
  formatJsonPreview,
  getEvidenceSections,
  QUEUE_LABELS,
} from './constants'
import { AppealPanel, ComplaintPanel } from './request-panels'
import { useReviewController } from './use-review-controller'
import { useAuth } from '@/shared/hooks/use-auth'

export function ReviewQueueCard() {
  const auth = useAuth()
  const review = useReviewController()
  const detail = review.caseDetail?.data
  const currentCase = detail?.case ?? null
  const caseIsClosed =
    currentCase?.status === 'RESOLVED' || currentCase?.status === 'DISMISSED'
  const caseIsOpen = currentCase?.status === 'OPEN' || currentCase?.status === 'IN_REVIEW'

  return (
    <div data-ui="grid" data-gap="5" className="lg:grid-cols-[1.1fr_0.9fr]">
      <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
        <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">人工审核队列</h2>
        <div data-ui="stack" data-direction="col" data-gap="4">
          {(review.queueData?.data ?? []).length === 0 && (
            <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">当前没有待处理 case。</p>
          )}
          <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
            {(review.queueData?.data ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    review.setSelectedCaseId(item.id)
                    review.setTransferUserId('')
                    review.setTransferNote('')
                    review.setEvidenceExportRedaction('operator')
                  }}
                  className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                >
                  <div className="text-left">
                    <p data-ui="text" data-variant="caption" className="font-medium">
                      {item.case_type} · {item.summary_text ?? item.id}
                    </p>
                    <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
                      {QUEUE_LABELS[item.queue] ?? item.queue} · {item.status} · priority{' '}
                      {item.priority}
                      {item.assigned_to_user_id ? ` · assignee ${item.assigned_to_user_id}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline">{QUEUE_LABELS[item.queue] ?? item.queue}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
        <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">Case 详情</h2>
        <div data-ui="stack" data-direction="col" data-gap="4">
          {!detail && <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">从左侧选择一个 case 查看详情。</p>}
          {detail && currentCase && (
            <>
              <div>
                <p className={"text-xs font-medium"}>
                  {currentCase.case_type} · {currentCase.status}
                </p>
                <p className={"text-[10px] text-muted-foreground"}>
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
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        disabled={review.resolveCase.isPending || caseIsClosed}
                      >
                        解决
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>确认解决 Case</DialogTitle>
                        <DialogDescription>
                          您确定要将此 Case 标记为已解决吗？
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">取消</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button
                            onClick={() =>
                              review.resolveCase.mutate({
                                case_id: currentCase.id,
                                resolution_action: 'resolved_in_admin_panel',
                              })
                            }
                          >
                            确认解决
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                <div className={"grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"}>
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

              <Tabs key={currentCase.id} defaultValue="overview" className="space-y-4">
                <TabsList className="flex flex-wrap">
                  <TabsTrigger value="overview">概览</TabsTrigger>
                  <TabsTrigger value="requests">投诉/申诉</TabsTrigger>
                  <TabsTrigger value="evidence">证据</TabsTrigger>
                  <TabsTrigger value="tasks">任务</TabsTrigger>
                  <TabsTrigger value="export">导出</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div>
                    <p className="mb-1 block text-sm font-medium text-muted-foreground">审核目标</p>
                    <div data-ui="stack" data-direction="col" data-gap="1">
                      {detail.targets.map((target) => (
                        <div key={target.id} className="text-[10px] text-muted-foreground">
                          {target.relation_type} · {target.channel} · {target.target_type}:
                          {target.target_id}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 block text-sm font-medium text-muted-foreground">风险摘要</p>
                    <pre className="mt-1 whitespace-pre-wrap break-all rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
                      {formatJsonPreview(currentCase.risk_summary ?? { summary: null }) ?? '{}'}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 block text-sm font-medium text-muted-foreground">审核处理指南</p>
                    <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
                      {buildQueuePlaybook(currentCase.queue).summary}
                    </p>
                    <div className="space-y-1 mt-2">
                      {buildQueuePlaybook(currentCase.queue).checklist.map((line) => (
                        <p key={line} className="text-[10px] text-muted-foreground">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="requests" className="space-y-4">
                  <ComplaintPanel item={detail.linked_complaint} />
                  <AppealPanel item={detail.linked_appeal} />
                  {!detail.linked_complaint && !detail.linked_appeal && (
                    <p data-ui="text" data-variant="caption" data-tone="muted">
                      当前 case 还没有关联 complaint/appeal 对象。
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="evidence" className="space-y-4">
                  {detail.evidence.map((evidence) => (
                    <div key={evidence.id} className="rounded-md border p-3 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <p data-ui="text" data-variant="caption" className="font-medium">{evidence.snapshot_type}</p>
                        {getEvidenceSections(evidence).map((section) => (
                          <Badge key={`${evidence.id}-${section.key}`} variant="outline">
                            {section.label}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-3 space-y-3">
                        {getEvidenceSections(evidence).map((section) => (
                          <div
                            key={`${evidence.id}-${section.key}-preview`}
                            className="rounded-md bg-muted/30 p-2"
                          >
                            <p className="mb-1 block text-sm font-medium text-muted-foreground">{section.label}</p>
                            <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-muted-foreground">{section.preview}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {detail.evidence.length === 0 && (
                    <p data-ui="text" data-variant="caption" data-tone="muted">当前没有 evidence snapshot。</p>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4">
                  <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
                    {detail.tasks.map((task) => (
                      <li key={task.id} data-ui="card" data-variant="outlined" data-padding="sm" className="flex items-center justify-between">
                        <div className="text-left">
                          <p data-ui="text" data-variant="caption" className="font-medium">
                            {task.task_type} · {task.status}
                          </p>
                          <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
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
                      </li>
                    ))}
                  </ul>
                  {detail.tasks.length === 0 && (
                    <p data-ui="text" data-variant="caption" data-tone="muted">当前没有 review task。</p>
                  )}
                </TabsContent>

                <TabsContent value="export" className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={review.evidenceExportRedaction}
                      onValueChange={(value) =>
                        review.setEvidenceExportRedaction(value as 'operator' | 'share')
                      }
                    >
                      <SelectTrigger className="h-8 w-[120px]" aria-label="导出类型">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operator">内部导出</SelectItem>
                        <SelectItem value="share">分享导出</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <div data-ui="stack" data-direction="col" data-gap="1">
                      {review.evidenceExport?.data?.redaction_notes.map((note) => (
                        <p key={note} className="text-[10px] text-muted-foreground">
                          {note}
                        </p>
                      ))}
                    </div>
                  )}
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
                    {formatJsonPreview(review.evidenceExport?.data ?? { pending: true }, 2_400) ??
                      '{}'}
                  </pre>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
