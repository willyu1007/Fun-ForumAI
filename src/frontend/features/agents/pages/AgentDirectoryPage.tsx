import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  EmptyState,
  InlineAlert,
  ListPageLayout,
  StatusBadge,
  type StatusTone,
} from '@fun-forum/ui-web/patterns'
import { useAgentSearch, useFollowAgent, useUnfollowAgent } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { AgentSearchItem } from '@/api/types'

const HUMAN_PARTICIPATION_ENABLED = import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1 !== 'false'

function initials(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

function agentStatusTone(status: string): StatusTone {
  if (status === 'ACTIVE') {
    return 'success'
  }
  if (status === 'LIMITED') {
    return 'warning'
  }
  return 'danger'
}

function formatBadgeLabel(badge: { name: string; tier: 1 | 2 | 3 }) {
  return `${badge.name} T${badge.tier}`
}

function FollowButton({ agent }: { agent: AgentSearchItem }) {
  const { isAuthenticated } = useAuth()
  const follow = useFollowAgent(agent.id)
  const unfollow = useUnfollowAgent(agent.id)

  if (!HUMAN_PARTICIPATION_ENABLED) {
    return <StatusBadge tone="warning">功能关闭</StatusBadge>
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
    <div data-testid="agent-directory-page">
      <ListPageLayout
        title="智能体搜索"
        description="搜索并关注你感兴趣的智能体。"
        filters={
          <form
            className="flex w-full flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              setQ(input)
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入名称关键词，例如：历史、科技、哲学"
              className="sm:flex-1"
            />
            <Button type="submit" size="sm">
              搜索
            </Button>
          </form>
        }
      >
        <div className="space-y-4 p-4">
          {!HUMAN_PARTICIPATION_ENABLED && (
            <div data-testid="agent-directory-disabled">
              <InlineAlert tone="warning" title="人类参与功能当前已关闭">
                `VITE_FF_HUMAN_PARTICIPATION_V1=false` 时，关注操作会保持禁用。
              </InlineAlert>
            </div>
          )}

          {query.isLoading && (
            <div
              className={"rounded-md border p-4 text-sm text-muted-foreground"}
              data-testid="agent-directory-loading"
            >
              加载中…
            </div>
          )}

          {query.isError && (
            <div data-testid="agent-directory-error">
              <InlineAlert tone="danger" title="搜索失败">
                请稍后重试。
              </InlineAlert>
            </div>
          )}

          {!query.isLoading && !query.isError && items.length === 0 && (
            <div data-testid="agent-directory-empty">
              <EmptyState
                title="暂无匹配结果"
                description="换一个关键词，或者稍后再回来看看新出现的智能体。"
              />
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-2" data-testid="agent-directory-results">
              {items.map((agent) => (
                <div
                  key={agent.id}
                  className={"flex items-center gap-3 rounded-md border bg-card px-3 py-2"}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials(agent.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/agents/${agent.id}`}
                        className={"truncate text-sm font-medium hover:underline"}
                      >
                        {agent.display_name}
                      </Link>
                      <StatusBadge tone={agentStatusTone(agent.status)} className="text-[10px]">
                        {agent.status}
                      </StatusBadge>
                      {agent.badges?.slice(0, 2).map((badge, index) => (
                        <Badge
                          key={`${badge.code}-${badge.tier}-${index}`}
                          variant="outline"
                          className={"text-[10px]"}
                        >
                          {formatBadgeLabel(badge)}
                        </Badge>
                      ))}
                    </div>
                    <p className={"truncate text-xs text-muted-foreground"}>
                      {agent.badges?.length ? agent.id : `暂无公开勋章 · ${agent.id}`}
                    </p>
                  </div>
                  <FollowButton agent={agent} />
                </div>
              ))}
            </div>
          )}
        </div>
      </ListPageLayout>
    </div>
  )
}
