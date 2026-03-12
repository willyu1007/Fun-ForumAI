import { useState } from 'react'
import {
  useAssignModerationCase,
  useGovernanceAction,
  useHealth,
  useIdentityReviews,
  useModerationCase,
  useModerationQueue,
  useReopenModerationCase,
  useResolveIdentityReview,
  useResolveModerationCase,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RuntimeDashboard } from '../components/RuntimeDashboard'
import type { GovernanceActionType, GovernanceResult } from '@/api/types'
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
export function AdminPanel() {
  const { currentIdentity, user } = useAuth()
  const governance = useGovernanceAction()
  const { data: healthData } = useHealth()
  const { data: queueData } = useModerationQueue()
  const { data: identityReviews } = useIdentityReviews({ limit: 20 })
  const assignCase = useAssignModerationCase()
  const resolveCase = useResolveModerationCase()
  const reopenCase = useReopenModerationCase()
  const resolveIdentity = useResolveIdentityReview()
  const [action, setAction] = useState<GovernanceActionType>('approve')
  const [targetType, setTargetType] = useState<string>('post')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [history, setHistory] = useState<GovernanceResult[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const { data: caseDetail } = useModerationCase(selectedCaseId)
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

          <div className="grid gap-4 lg:grid-cols-2">
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
                    onClick={() => setSelectedCaseId(item.id)}
                    className={uix('uix-81af913189')}
                  >
                    <div>
                      <p className={uix('uix-da8bf29040')}>
                        {item.case_type} · {item.summary_text ?? item.id}
                      </p>
                      <p className={uix('uix-abda0153e3')}>
                        {item.status} · priority {item.priority}
                      </p>
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
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
                    <div>
                      <p className={uix('uix-da8bf29040')}>
                        {caseDetail.data.case.case_type} · {caseDetail.data.case.status}
                      </p>
                      <p className={uix('uix-abda0153e3')}>
                        {caseDetail.data.case.summary_text ?? '无摘要'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => assignCase.mutate({ case_id: caseDetail.data.case.id, assignee_user_id: user?.id ?? null })}
                      >
                        指派给我
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => resolveCase.mutate({ case_id: caseDetail.data.case.id, resolution_action: 'resolved_in_admin_panel' })}
                      >
                        解决
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reopenCase.mutate({ case_id: caseDetail.data.case.id, opened_reason: 'manual_reopen' })}
                      >
                        重新打开
                      </Button>
                    </div>
                    <div>
                      <p className={uix('uix-b3691fbf2a')}>Targets</p>
                      <div className="space-y-1">
                        {caseDetail.data.targets.map((target) => (
                          <div key={target.id} className={uix('uix-abda0153e3')}>
                            {target.channel} · {target.target_type}:{target.target_id}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className={uix('uix-b3691fbf2a')}>Evidence</p>
                      <div className="space-y-1">
                        {caseDetail.data.evidence.map((evidence) => (
                          <div key={evidence.id} className={uix('uix-abda0153e3')}>
                            {evidence.snapshot_type}
                          </div>
                        ))}
                      </div>
                    </div>
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
