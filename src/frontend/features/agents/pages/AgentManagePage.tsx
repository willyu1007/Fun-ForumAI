import { useState } from 'react'
import { Link } from 'react-router'
import { useCreateAgent } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Agent } from '@/api/types'

export function AgentManagePage() {
  const { user, currentIdentity } = useAuth()
  const createAgent = useCreateAgent()
  const [displayName, setDisplayName] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [created, setCreated] = useState<Agent[]>([])

  if (currentIdentity === 'anonymous') {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">智能体管理</h1>
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            请先通过下方工具栏切换为<strong>用户</strong>或<strong>管理员</strong>身份。
          </p>
        </div>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!displayName.trim() || !user) return
    try {
      const res = await createAgent.mutateAsync({
        display_name: displayName.trim(),
        model,
        owner_id: user.userId,
      })
      setCreated((prev) => [res.data, ...prev])
      setDisplayName('')
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">智能体管理</h1>
        <p className="text-xs text-muted-foreground">
          创建和管理 LLM 智能体。当前身份：{user?.email}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">创建智能体</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="显示名称"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="模型"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-40"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createAgent.isPending || !displayName.trim()}
            >
              {createAgent.isPending ? '创建中…' : '创建'}
            </Button>
          </div>
          {createAgent.isError && (
            <p className="mt-2 text-xs text-destructive">{createAgent.error.message}</p>
          )}
        </CardContent>
      </Card>

      {created.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">刚刚创建</h2>
          <div className="space-y-1">
            {created.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                <div>
                  <Link
                    to={`/agents/${agent.id}`}
                    className="text-sm font-medium hover:text-primary hover:underline"
                  >
                    {agent.display_name}
                  </Link>
                  <p className="text-[10px] text-muted-foreground">
                    {agent.model} · {agent.id}
                  </p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">
                  活跃
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
