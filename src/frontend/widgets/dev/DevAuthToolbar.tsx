import { useState } from 'react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronLeft, ChevronRight, Wrench, Database, Medal } from 'lucide-react'
import {
  DEV_AUTH_TOOLBAR_HEIGHT_CLASS,
  SHOULD_RENDER_DEV_AUTH_TOOLBAR,
} from '@/shared/layout/dev-auth-toolbar'
import { useAuth } from '@/shared/hooks/use-auth'
import { useDevAuthToolbarStore } from '@/shared/stores/dev-auth-toolbar-store'
import { DevBadgeDebugPanel } from './DevBadgeDebugPanel'

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
  const [toolsOpen, setToolsOpen] = useState(false)
  const [badgePanelOpen, setBadgePanelOpen] = useState(false)

  const handleSeed = async () => {
    setToolsOpen(false)
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
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 ${DEV_AUTH_TOOLBAR_HEIGHT_CLASS}`}
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              aria-label="收起开发模式工具栏"
              onClick={() => setCollapsed(true)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
              DEV
            </Badge>
            {IDENTITIES.map(({ id, label }) => (
              <Button
                key={id}
                variant={currentIdentity === id ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
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

          <div className="ml-auto flex items-center gap-2">
            {user && (
              <span className="max-w-[18rem] truncate text-xs text-muted-foreground">
                {user.email ?? user.phone ?? user.id}
              </span>
            )}

            <Popover open={toolsOpen} onOpenChange={setToolsOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  aria-label="开发工具"
                >
                  <Wrench className="size-3.5" />
                  工具
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" side="top" sideOffset={8} className="w-52 p-1.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={handleSeed}
                >
                  <Database className="size-3.5 text-muted-foreground" />
                  填充测试数据
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => {
                    setToolsOpen(false)
                    setBadgePanelOpen(true)
                  }}
                >
                  <Medal className="size-3.5 text-muted-foreground" />
                  勋章调试
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <DevBadgeDebugPanel open={badgePanelOpen} onOpenChange={setBadgePanelOpen} />
    </>
  )
}
