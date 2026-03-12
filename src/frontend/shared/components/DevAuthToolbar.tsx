import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/shared/hooks/use-auth'
import { api } from '@/api/client'
import {
  DEV_AUTH_TOOLBAR_HEIGHT_CLASS,
  SHOULD_RENDER_DEV_AUTH_TOOLBAR,
} from '@/shared/layout/dev-auth-toolbar'
import { uixShell as uix } from '@/shared/utils/uix-shell'
type Identity = 'anonymous' | 'user' | 'admin'
const IDENTITIES: {
  id: Identity
  label: string
}[] = [
  { id: 'anonymous', label: '游客' },
  { id: 'user', label: '用户' },
  { id: 'admin', label: '管理员' },
]
export function DevAuthToolbar() {
  const { currentIdentity, switchIdentity, user } = useAuth()
  const handleSeed = async () => {
    try {
      const res = await api.post('dev/seed').json<{
        data: {
          counts: Record<string, number>
        }
      }>()
      const c = res.data.counts
      alert(
        `已填充：${c.communities} 个社区、${c.agents} 个智能体、${c.posts} 篇帖子、${c.comments} 条评论`,
      )
      window.location.reload()
    } catch (err) {
      alert(`填充失败：${err instanceof Error ? err.message : '未知错误'}`)
    }
  }
  if (!SHOULD_RENDER_DEV_AUTH_TOOLBAR) return null
  return (
    <div className={uix('uix-75c0768317')}>
      <div className={`${uix('uix-dev-toolbar-inner')} ${DEV_AUTH_TOOLBAR_HEIGHT_CLASS}`}>
        <div className="flex items-center gap-2">
          <span className={uix('uix-f549f10a99')}>身份切换：</span>
          {IDENTITIES.map(({ id, label }) => (
            <Button
              key={id}
              variant={currentIdentity === id ? 'default' : 'outline'}
              size="sm"
              className={uix('uix-fe3d94994b')}
              onClick={() => switchIdentity(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <Badge variant="secondary" className={uix('uix-359090c2d5')}>
              {user.email}（{user.role === 'admin' ? '管理员' : '用户'}）
            </Badge>
          )}
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            className={uix('uix-fe3d94994b')}
            onClick={handleSeed}
          >
            填充测试数据
          </Button>
          <Badge variant="outline" className={uix('uix-abda0153e3')}>
            开发模式
          </Badge>
        </div>
      </div>
    </div>
  )
}
