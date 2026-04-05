import { lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AppShell } from '@fun-forum/ui-web/shell'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import {
  getAppShellContentSafeAreaClass,
  SHOULD_RENDER_DEV_AUTH_TOOLBAR,
} from '@/shared/layout/dev-auth-toolbar'
import { useDevAuthToolbarStore } from '@/shared/stores/dev-auth-toolbar-store'
import { cn } from '@/lib/utils'
import { DevAuthToolbar } from '@/widgets/dev/DevAuthToolbar'
import { ShellLeftRail } from '@/widgets/shell/ShellLeftRail'
import { ShellTopBarContainer } from '@/widgets/shell/ShellTopBarContainer'

const LazyAgentInteractionModal = lazy(() =>
  import('@/widgets/agent-modal/AgentInteractionModal').then((module) => ({
    default: module.AgentInteractionModal,
  })),
)

export function AppShellContainer() {
  const { leftOpen, toggleLeft } = useSidebarStore()
  const { view } = useFeedViewStore()
  const shouldMountAgentModal = useAgentModalStore((state) => state.isOpen || state.activeAgentId !== null)
  const isDevAuthToolbarCollapsed = useDevAuthToolbarStore((state) => state.collapsed)
  const { pathname } = useLocation()
  const useWideFeedFrame = pathname === '/' || pathname === '/feed' || pathname.startsWith('/c/') || pathname === '/search'
  const useCompactStretchFrame = (pathname === '/feed' || pathname.startsWith('/c/') || pathname === '/search') && view === 'compact'
  const useWidePageFrame = useWideFeedFrame || pathname.startsWith('/posts/')
  const contentSafeAreaClass = getAppShellContentSafeAreaClass(
    SHOULD_RENDER_DEV_AUTH_TOOLBAR,
    isDevAuthToolbarCollapsed,
  )

  return (
    <AppShell
      className="min-h-screen bg-background"
      topBar={<ShellTopBarContainer leftOpen={leftOpen} onToggleLeft={toggleLeft} />}
      leftRail={
        <div
          className={cn(
            'sticky top-[52px] flex flex-col border-r border-foreground/20 bg-background transition-all duration-200',
            'h-[calc(100vh-52px)]',
            leftOpen ? 'w-[16.5rem]' : 'w-0 overflow-hidden border-r-0',
          )}
        >
          <ShellLeftRail />
        </div>
      }
      leftRailOpen={leftOpen}
      footer={<DevAuthToolbar />}
    >
      <div className={cn(
        'min-w-0 flex-1 transition-[padding] duration-200',
        contentSafeAreaClass,
        leftOpen && 'md:pl-3',
      )}>
        <div
          data-testid="shell-page-frame"
          className={cn(
            'mx-auto px-4 pb-4 transition-[max-width] duration-200 md:px-3',
            useWidePageFrame ? 'pt-0' : 'pt-4',
            useWidePageFrame
              ? useCompactStretchFrame
                ? 'max-w-[96rem] 2xl:max-w-[108rem]'
                : 'max-w-6xl'
              : 'max-w-3xl',
          )}
        >
          <Outlet />
        </div>
      </div>
      {shouldMountAgentModal ? (
        <Suspense fallback={null}>
          <LazyAgentInteractionModal />
        </Suspense>
      ) : null}
    </AppShell>
  )
}
