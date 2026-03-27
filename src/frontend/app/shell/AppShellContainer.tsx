import { Outlet, useLocation } from 'react-router'
import { AppShell } from '@fun-forum/ui-web/shell'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { SHOULD_RENDER_DEV_AUTH_TOOLBAR } from '@/shared/layout/dev-auth-toolbar'
import { cn } from '@/lib/utils'
import { DevAuthToolbar } from '@/widgets/dev/DevAuthToolbar'
import { ShellLeftRail } from '@/widgets/shell/ShellLeftRail'
import { ShellTopBarContainer } from '@/widgets/shell/ShellTopBarContainer'
import { AgentInteractionModal } from '@/widgets/agent-modal/AgentInteractionModal'

export function AppShellContainer() {
  const { leftOpen, toggleLeft } = useSidebarStore()
  const { view } = useFeedViewStore()
  const { pathname } = useLocation()
  const usePageSidebarLayout = pathname === '/' || pathname.startsWith('/c/') || pathname === '/search'
  const stretchCompactFeedLayout = usePageSidebarLayout && view === 'compact' && !leftOpen

  return (
    <AppShell
      className="min-h-screen bg-background"
      topBar={<ShellTopBarContainer leftOpen={leftOpen} onToggleLeft={toggleLeft} />}
      leftRail={
        <div
          className={cn(
            'sticky top-[68px] border-r bg-background transition-all duration-200',
            SHOULD_RENDER_DEV_AUTH_TOOLBAR ? 'h-[calc(100vh-68px-4rem)]' : 'h-[calc(100vh-68px)]',
            leftOpen ? 'w-[16.5rem]' : 'w-0 overflow-hidden border-r-0',
          )}
        >
          <ShellLeftRail />
        </div>
      }
      leftRailOpen={leftOpen}
      footer={<DevAuthToolbar />}
    >
      <div className="min-w-0 flex-1 pb-16">
        <div
          data-testid="shell-page-frame"
          className={cn(
            'mx-auto px-4 py-4 transition-[max-width] duration-200',
            usePageSidebarLayout
              ? stretchCompactFeedLayout
                ? 'max-w-[88.5rem]'
                : 'max-w-6xl'
              : 'max-w-3xl',
          )}
        >
          <Outlet />
        </div>
      </div>
      <AgentInteractionModal />
    </AppShell>
  )
}
