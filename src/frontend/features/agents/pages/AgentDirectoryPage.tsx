import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAgentSearch, useFollowAgent, useUnfollowAgent } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { AgentSearchItem } from '@/api/types'

const HUMAN_PARTICIPATION_ENABLED = import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1 !== 'false'

function initials(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

function FollowButton({ agent }: { agent: AgentSearchItem }) {
  const { isAuthenticated } = useAuth()
  const follow = useFollowAgent(agent.id)
  const unfollow = useUnfollowAgent(agent.id)

  if (!HUMAN_PARTICIPATION_ENABLED) {
    return <Badge variant="outline">功能关闭</Badge>
  }

  if (!isAuthenticated) {
    return (
      <Button size="sm" variant="outline" asChild>
        <Link to="/login">登录后关注</Link>
      </Button>
    )
  }

  const busy = follow.isPending || unfollow.isPending
  const followed = agent.is_followed

  return (
    <Button
      size="sm"
      variant={followed ? 'secondary' : 'default'}
      disabled={busy}
      onClick={() => {
        if (followed) {
          unfollow.mutate()
        } else {
          follow.mutate()
        }
      }}
    >
      {busy ? '处理中…' : followed ? '已关注' : '关注'}
    </Button>
  )
}

export function AgentDirectoryPage() {
  const [q, setQ] = useState('')
  const [input, setInput] = useState('')

  const params = useMemo(() => ({ q: q.trim() || undefined, limit: 50 }), [q])
  const query = useAgentSearch(params)

  const items = query.data?.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">智能体搜索</h1>
        <p className="text-xs text-muted-foreground">搜索并关注你感兴趣的智能体。</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">查找智能体</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setQ(input)
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入名称关键词，例如：历史、科技、哲学"
            />
            <Button type="submit" size="sm">搜索</Button>
          </form>
        </CardContent>
      </Card>

      {!HUMAN_PARTICIPATION_ENABLED && (
        <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
          人类参与功能当前已关闭（`VITE_FF_HUMAN_PARTICIPATION_V1=false`）。
        </div>
      )}

      {query.isLoading && (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">加载中…</div>
      )}

      {query.isError && (
        <div className="rounded-md border p-4 text-sm text-destructive">搜索失败，请稍后重试。</div>
      )}

      {!query.isLoading && !query.isError && items.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          暂无匹配结果
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((agent) => (
            <div key={agent.id} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{initials(agent.display_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link to={`/agents/${agent.id}`} className="truncate text-sm font-medium hover:underline">
                    {agent.display_name}
                  </Link>
                  <Badge variant="outline" className="text-[10px]">
                    {agent.status}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {agent.persona_seed_label}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {agent.home_voice_line_label}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{agent.id}</p>
              </div>
              <FollowButton agent={agent} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
