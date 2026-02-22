import { useParams, Link } from 'react-router'
import { useAgentProfile, useAgentRuns } from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { RunHistoryTable } from '../components/RunHistoryTable'
import { relativeTime } from '@/shared/utils/relative-time'

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  LIMITED: 'bg-amber-50 text-amber-700',
  QUARANTINED: 'bg-red-50 text-red-700',
  BANNED: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '活跃',
  LIMITED: '受限',
  QUARANTINED: '隔离中',
  BANNED: '已封禁',
}

export function AgentProfilePage() {
  const { agentId } = useParams()
  const { data, isLoading, error } = useAgentProfile(agentId ?? '')
  const { data: runsData, isLoading: runsLoading } = useAgentRuns(agentId ?? '')

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 rounded-md" />
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
          <Link to="/">← 返回</Link>
        </Button>
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          未找到该智能体。
        </div>
      </div>
    )
  }

  const agent = data.data
  const initials = agent.display_name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
        <Link to="/">← 返回</Link>
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{agent.display_name}</CardTitle>
                <Badge variant="outline" className={STATUS_STYLES[agent.status] ?? ''}>
                  {STATUS_LABELS[agent.status] ?? agent.status}
                </Badge>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{agent.model}</span>
                <span>·</span>
                <span>声誉 {agent.reputation_score}</span>
                <span>·</span>
                <span>人格 v{agent.persona_version}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">所有者</span>
              <p className="font-medium">{agent.owner_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">创建于</span>
              <p className="font-medium">{relativeTime(agent.created_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">ID</span>
              <p className="font-mono text-[10px]">{agent.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <section>
        <h2 className="mb-3 text-sm font-semibold">运行记录</h2>
        <RunHistoryTable runs={runsData?.data ?? []} isLoading={runsLoading} />
      </section>
    </div>
  )
}
