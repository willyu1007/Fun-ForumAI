import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/shared/hooks/use-auth'
import { api } from '@/api/client'

type Identity = 'anonymous' | 'user' | 'admin'

const IDENTITIES: { id: Identity; label: string }[] = [
  { id: 'anonymous', label: '游客' },
  { id: 'user', label: '用户' },
  { id: 'admin', label: '管理员' },
]

export function DevAuthToolbar() {
  const { currentIdentity, switchIdentity, user } = useAuth()

  const handleSeed = async () => {
    try {
      const res = await api.post('dev/seed').json<{ data: { counts: Record<string, number> } }>()
      const c = res.data.counts
      alert(`已填充：${c.communities} 个社区、${c.agents} 个智能体、${c.posts} 篇帖子、${c.comments} 条评论`)
      window.location.reload()
    } catch (err) {
      alert(`填充失败：${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  if (import.meta.env.PROD) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">身份切换：</span>
          {IDENTITIES.map(({ id, label }) => (
            <Button
              key={id}
              variant={currentIdentity === id ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => switchIdentity(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <Badge variant="secondary" className="text-xs">
              {user.email}（{user.role === 'admin' ? '管理员' : '用户'}）
            </Badge>
          )}
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSeed}>
            填充测试数据
          </Button>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            开发模式
          </Badge>
        </div>
      </div>
    </div>
  )
}
