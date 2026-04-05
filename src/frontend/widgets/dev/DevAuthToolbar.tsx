import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DEV_AUTH_TOOLBAR_HEIGHT_CLASS,
  SHOULD_RENDER_DEV_AUTH_TOOLBAR,
} from '@/shared/layout/dev-auth-toolbar'
import { useAuth } from '@/shared/hooks/use-auth'
import { useDevAuthToolbarStore } from '@/shared/stores/dev-auth-toolbar-store'
import { DevBadgeDebugPanel } from './DevBadgeDebugPanel'
import { DevFrontendFlagsPanel } from './DevFrontendFlagsPanel'

type Identity = 'anonymous' | 'user' | 'admin'

const IDENTITIES: Array<{ id: Identity; label: string }> = [
  { id: 'anonymous', label: '游客' },
  { id: 'user', label: '用户' },
  { id: 'admin', label: '管理员' },
]

export function DevAuthToolbar() {
  const { currentIdentity, switchIdentity, user } = useAuth()
  const collapsed = useDevAuthToolbarStore((state) => state.collapsed)
  const setCollapsed = useDevAuthToolbarStore((state) => state.setCollapsed)

  const handleSeed = async () => {
    try {
      const res = await api.post('dev/seed').json<{
        data: {
          counts: Record<string, number>
        }
      }>()
      const counts = res.data.counts
      alert(
        `已填充：${counts.communities} 个社区、${counts.agents} 个智能体、${counts.posts} 篇帖子、${counts.threads} 条线程`,
      )
      window.location.reload()
    } catch (err) {
      alert(`填充失败：${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  if (!SHOULD_RENDER_DEV_AUTH_TOOLBAR) {
    return null
  }

  if (collapsed) {
    return (
      <div className="fixed bottom-3 left-3 z-50">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          aria-label="展开开发模式工具栏"
          onClick={() => setCollapsed(false)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 ${DEV_AUTH_TOOLBAR_HEIGHT_CLASS}`}
      >
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="收起开发模式工具栏"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">身份切换：</span>
            {IDENTITIES.map(({ id, label }) => (
              <Button
                key={id}
                variant={currentIdentity === id ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  void switchIdentity(id).catch((err: unknown) => {
                    alert(`身份切换失败：${err instanceof Error ? err.message : '未知错误'}`)
                  })
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {user && (
            <Badge variant="secondary" className="max-w-[22rem] truncate text-xs">
              {user.email ?? user.phone ?? user.id}（{user.role === 'admin' ? '管理员' : '用户'}）
            </Badge>
          )}
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 text-xs"
            onClick={handleSeed}
          >
            填充测试数据
          </Button>
          <DevBadgeDebugPanel />
          <DevFrontendFlagsPanel />
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            开发模式
          </Badge>
        </div>
      </div>
    </div>
  )
}
