import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { uix } from '@/shared/utils/uix'
import type { AdminPanelController } from './use-admin-panel-controller'
import {
  buildQueuePlaybook,
  downloadJson,
  formatJsonPreview,
  getEvidenceSections,
  QUEUE_LABELS,
  renderCapOverrideSummary,
} from './constants'
import { AppealPanel, ComplaintPanel } from './request-panels'

export function AgentRiskProfileCard({
  controller,
}: {
  controller: AdminPanelController
}) {
  return (
    <Card>
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>Agent 风险画像</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Agent ID"
            value={controller.riskProfileAgentId}
            onChange={(event) => controller.setRiskProfileAgentId(event.target.value)}
          />
        </div>
        {!controller.riskProfile?.data && (
          <p className={uix('uix-abda0153e3')}>
            输入 Agent ID 后查看 spillover、provenance 与 cap 历史。
          </p>
        )}
        {controller.riskProfile?.data && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                status {controller.riskProfile.data.agent.status}
              </Badge>
              <Badge variant="outline">
                effective cap {controller.riskProfile.data.effective_disclosure_cap ?? 'none'}
              </Badge>
              <Badge variant="outline">
                spillover events {controller.riskProfile.data.spillover_events.length}
              </Badge>
              <Badge variant="outline">
                active caps {controller.riskProfile.data.active_cap_overrides.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  controller.governance.isPending ||
                  controller.riskProfile.data.agent.status === 'LIMITED'
                }
                onClick={async () => {
                  const result = await controller.governance.mutateAsync({
                    action: 'limit_agent',
                    target_type: 'agent',
                    target_id: controller.riskProfile!.data.agent.id,
                    reason: 'hot_topic_manual_review_only',
                  })
                  controller.pushGovernanceResult(result.data)
                }}
              >
                限制当前 Agent
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  controller.governance.isPending ||
                  controller.riskProfile.data.agent.status === 'ACTIVE'
                }
                onClick={async () => {
                  const result = await controller.governance.mutateAsync({
                    action: 'restore_agent',
                    target_type: 'agent',
                    target_id: controller.riskProfile!.data.agent.id,
                    reason: 'restore_hot_topic_policy',
                  })
                  controller.pushGovernanceResult(result.data)
                }}
              >
                恢复当前 Agent
              </Button>
            </div>
            <div className="space-y-2">
              <p className={uix('uix-da8bf29040')}>Recent Provenance</p>
              {controller.riskProfile.data.recent_private_provenance.slice(0, 3).map((item) => (
                <div key={item.run_id} className={uix('uix-3ff7f9f76c')}>
                  <p className={uix('uix-da8bf29040')}>{item.run_id}</p>
                  <p className={uix('uix-abda0153e3')}>
                    requested {item.requested_disclosure_level} → effective{' '}
                    {item.effective_disclosure_level} · {item.cap_source}
                  </p>
                  <p className={uix('uix-abda0153e3')}>
                    server caps:{' '}
                    {item.server_cap_sources
                      .map((source) => `${source.source_type}:${source.cap_level}`)
                      .join(', ') || 'none'}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className={uix('uix-da8bf29040')}>Recent Spillover Events</p>
              {controller.riskProfile.data.spillover_events.slice(0, 3).map((event) => (
                <div key={event.id} className={uix('uix-3ff7f9f76c')}>
                  <p className={uix('uix-da8bf29040')}>
                    {event.detail_text ?? event.event_type}
                  </p>
                  <p className={uix('uix-abda0153e3')}>
                    {event.action} · {event.risk_level ?? 'n/a'} ·{' '}
                    {event.risk_categories.join(', ') || 'none'}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className={uix('uix-da8bf29040')}>Recent Config Actions</p>
              {controller.riskProfile.data.recent_config_actions.slice(0, 3).map((item) => (
                <div key={item.id} className={uix('uix-3ff7f9f76c')}>
                  <p className={uix('uix-da8bf29040')}>{item.action}</p>
                  <p className={uix('uix-abda0153e3')}>{item.reason ?? '无备注'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DisclosureCapCard({ controller }: { controller: AdminPanelController }) {
  return (
    <Card>
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>Disclosure Cap 管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            value={controller.capScopeType}
            onChange={(event) =>
              controller.setCapScopeType(event.target.value as 'agent' | 'community')
            }
            className={uix('uix-34e5554f24')}
          >
            <option value="agent">agent</option>
            <option value="community">community</option>
          </select>
          <Input
            placeholder="scope id"
            value={controller.capScopeId}
            onChange={(event) => controller.setCapScopeId(event.target.value)}
          />
          <select
            value={controller.capLevel}
            onChange={(event) => controller.setCapLevel(event.target.value)}
            className={uix('uix-34e5554f24')}
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <Input
          placeholder="设置原因（选填）"
          value={controller.capReason}
          onChange={(event) => controller.setCapReason(event.target.value)}
        />
        <Button
          size="sm"
          onClick={() => {
            void controller.handleCreateCapOverride()
          }}
          disabled={controller.createDisclosureCap.isPending || !controller.capScopeId.trim()}
        >
          {controller.createDisclosureCap.isPending ? '设置中…' : '设置 Cap Override'}
        </Button>
        <Input
          placeholder="释放原因（选填）"
          value={controller.releaseCapReason}
          onChange={(event) => controller.setReleaseCapReason(event.target.value)}
        />
        {controller.disclosureCaps?.data?.active_override && (
          <div className={uix('uix-3ff7f9f76c')}>
            <p className={uix('uix-da8bf29040')}>Active Override</p>
            <p className={uix('uix-abda0153e3')}>
              {renderCapOverrideSummary(controller.disclosureCaps.data.active_override)}
            </p>
            <Button
              size="sm"
              variant="outline"
              className={uix('uix-4d2deea2bf')}
              onClick={() =>
                controller.handleReleaseCapOverride(
                  controller.disclosureCaps!.data.active_override!.id,
                )
              }
              disabled={controller.releaseDisclosureCap.isPending}
            >
              {controller.releaseDisclosureCap.isPending ? '释放中…' : '释放当前 Override'}
            </Button>
          </div>
        )}
        <div className="space-y-2">
          <p className={uix('uix-da8bf29040')}>Recent Override History</p>
          {(controller.disclosureCaps?.data?.history ?? []).slice(0, 4).map((item) => (
            <div key={item.id} className={uix('uix-3ff7f9f76c')}>
              <p className={uix('uix-da8bf29040')}>{renderCapOverrideSummary(item)}</p>
              <p className={uix('uix-abda0153e3')}>{item.reason ?? '无原因'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ReviewQueueCard({ controller }: { controller: AdminPanelController }) {
  const detail = controller.caseDetail?.data
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
          {(controller.queueData?.data ?? []).length === 0 && (
            <p className={uix('uix-abda0153e3')}>当前没有待处理 case。</p>
          )}
          {(controller.queueData?.data ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                controller.setSelectedCaseId(item.id)
                controller.setTransferUserId('')
                controller.setTransferNote('')
                controller.setEvidenceExportRedaction('operator')
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
                    <Badge variant="outline">
                      投诉 {currentCase.linked_complaint_ticket_id}
                    </Badge>
                  )}
                  {currentCase.linked_appeal_request_id && (
                    <Badge variant="outline">申诉 {currentCase.linked_appeal_request_id}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={controller.assignCase.isPending || caseIsClosed}
                    onClick={() =>
                      controller.assignCase.mutate({
                        case_id: currentCase.id,
                        assignee_user_id: controller.user?.id ?? null,
                      })
                    }
                  >
                    指派给我
                  </Button>
                  <Button
                    size="sm"
                    disabled={controller.resolveCase.isPending || caseIsClosed}
                    onClick={() =>
                      controller.resolveCase.mutate({
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
                    disabled={controller.reopenCase.isPending || caseIsOpen}
                    onClick={() =>
                      controller.reopenCase.mutate({
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
                      controller.releaseCase.isPending ||
                      caseIsClosed ||
                      (!currentCase.assigned_to_user_id && !currentCase.claimed_by_user_id)
                    }
                    onClick={() =>
                      controller.releaseCase.mutate({
                        case_id: currentCase.id,
                        operator_note: controller.transferNote.trim() || undefined,
                      })
                    }
                  >
                    释放回队列
                  </Button>
                </div>
                <div className={uix('uix-ce55a4e3e0')}>
                  <Input
                    placeholder="转派给用户 ID"
                    value={controller.transferUserId}
                    onChange={(event) => controller.setTransferUserId(event.target.value)}
                  />
                  <Input
                    placeholder="转派备注（选填）"
                    value={controller.transferNote}
                    onChange={(event) => controller.setTransferNote(event.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      controller.transferCase.isPending ||
                      caseIsClosed ||
                      !controller.transferUserId.trim()
                    }
                    onClick={() =>
                      controller.transferCase.mutate({
                        case_id: currentCase.id,
                        assignee_user_id: controller.transferUserId.trim(),
                        operator_note: controller.transferNote.trim() || undefined,
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
                      const result = await controller.refetchEvidenceExport()
                      if (result.data?.data) {
                        downloadJson(
                          `case-${currentCase.id}-evidence-export-${controller.evidenceExportRedaction}.json`,
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
                            <pre className={uix('uix-4fdc9d7d12')}>
                              {section.preview}
                            </pre>
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
                          {task.due_at
                            ? ` · SLA ${new Date(task.due_at).toLocaleString()}`
                            : ''}
                        </p>
                      </div>
                      {task.status !== 'COMPLETED' && task.status !== 'CANCELED' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              controller.claimTask.isPending || task.status !== 'PENDING'
                            }
                            onClick={() =>
                              controller.claimTask.mutate({
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
                              controller.releaseCase.isPending ||
                              caseIsClosed ||
                              task.status !== 'ASSIGNED'
                            }
                            onClick={() =>
                              controller.releaseCase.mutate({
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
                      value={controller.evidenceExportRedaction}
                      onChange={(event) =>
                        controller.setEvidenceExportRedaction(
                          event.target.value as 'operator' | 'share',
                        )
                      }
                      className={uix('uix-34e5554f24')}
                    >
                      <option value="operator">内部导出</option>
                      <option value="share">分享导出</option>
                    </select>
                    <Badge variant="outline">
                      {controller.evidenceExport?.data?.exported_at
                        ? `last export ${new Date(
                            controller.evidenceExport.data.exported_at,
                          ).toLocaleString()}`
                        : '尚未生成导出'}
                    </Badge>
                    <Badge variant="outline">
                      redaction{' '}
                      {controller.evidenceExport?.data?.redaction_level ??
                        controller.evidenceExportRedaction}
                    </Badge>
                    <Badge variant="outline">
                      action logs {controller.evidenceExport?.data?.action_logs.length ?? 0}
                    </Badge>
                    <Badge variant="outline">
                      evidence {controller.evidenceExport?.data?.evidence.length ?? 0}
                    </Badge>
                  </div>
                  {(controller.evidenceExport?.data?.redaction_notes.length ?? 0) > 0 && (
                    <div className="space-y-1">
                      {controller.evidenceExport?.data?.redaction_notes.map((note) => (
                        <p key={note} className={uix('uix-abda0153e3')}>
                          {note}
                        </p>
                      ))}
                    </div>
                  )}
                  <pre className={uix('uix-6e2e4af21f')}>
                    {formatJsonPreview(
                      controller.evidenceExport?.data ?? { pending: true },
                      2_400,
                    ) ?? '{}'}
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

export function IdentityReviewCard({ controller }: { controller: AdminPanelController }) {
  return (
    <Card>
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>实名审核</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(controller.identityReviews?.data ?? []).slice(0, 8).map((item) => (
          <div key={item.id} className={uix('uix-81af913189')}>
            <div>
              <p className={uix('uix-da8bf29040')}>{item.user_id}</p>
              <p className={uix('uix-abda0153e3')}>{item.status}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  controller.resolveIdentity.mutate({
                    user_id: item.user_id,
                    status: 'VERIFIED',
                  })
                }
              >
                通过
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  controller.resolveIdentity.mutate({
                    user_id: item.user_id,
                    status: 'REJECTED',
                  })
                }
              >
                驳回
              </Button>
            </div>
          </div>
        ))}
        {(controller.identityReviews?.data ?? []).length === 0 && (
          <p className={uix('uix-abda0153e3')}>暂无实名审核记录。</p>
        )}
      </CardContent>
    </Card>
  )
}
