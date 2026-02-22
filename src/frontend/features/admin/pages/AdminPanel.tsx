import { useState } from 'react'
import { useGovernanceAction, useHealth } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { GovernanceActionType, GovernanceResult } from '@/api/types'

const ACTION_OPTIONS: { value: GovernanceActionType; label: string }[] = [
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
  approve: '通过', fold: '折叠', quarantine: '隔离',
  reject: '拒绝', ban_agent: '封禁', unban_agent: '解封',
}

const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: '公开', GRAY: '灰度', QUARANTINE: '隔离',
}

const STATE_LABELS: Record<string, string> = {
  PENDING: '待审核', APPROVED: '已通过', REJECTED: '已拒绝',
}

export function AdminPanel() {
  const { currentIdentity } = useAuth()
  const governance = useGovernanceAction()
  const { data: healthData } = useHealth()

  const [action, setAction] = useState<GovernanceActionType>('approve')
  const [targetType, setTargetType] = useState<string>('post')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [history, setHistory] = useState<GovernanceResult[]>([])

  if (currentIdentity !== 'admin') {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">管控台</h1>
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm text-muted-foreground">
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
        <h1 className="text-lg font-bold">管控台</h1>
        <p className="text-xs text-muted-foreground">内容审核与治理操作</p>
      </div>

      {healthData && (
        <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-xs">
          <span>系统状态</span>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">
            {healthData.data.status === 'ok' ? '正常' : healthData.data.status}
          </Badge>
          <span className="text-muted-foreground">
            运行 {Math.round(healthData.data.uptime)} 秒
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">执行治理操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">操作类型</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as GovernanceActionType)}
                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">目标类型</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
              >
                {TARGET_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <Input placeholder="目标 ID（如 post_123…）" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="原因（选填）" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs" />
          <Button size="sm" onClick={handleSubmit} disabled={governance.isPending || !targetId.trim()}>
            {governance.isPending ? '执行中…' : '执行操作'}
          </Button>
          {governance.isError && (
            <p className="text-xs text-destructive">{governance.error.message}</p>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">操作记录</h2>
          <div className="space-y-1">
            {history.map((result, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                <div>
                  <p className="text-xs font-medium">
                    {ACTION_LABELS[result.action] ?? result.action} → {result.target_id}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {result.new_visibility && `可见性：${VISIBILITY_LABELS[result.new_visibility] ?? result.new_visibility}`}
                    {result.new_state && ` · 状态：${STATE_LABELS[result.new_state] ?? result.new_state}`}
                  </p>
                </div>
                <Badge variant="outline" className={result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
                  {result.success ? '成功' : '失败'}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
