import { Outlet, useLocation } from 'react-router'
import { AppShell } from '@fun-forum/ui-web/shell'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { cn } from '@/lib/utils'
import { DevAuthToolbar } from '@/widgets/dev/DevAuthToolbar'
import { ShellLeftRail } from '@/widgets/shell/ShellLeftRail'
import { ShellRightRail } from '@/widgets/shell/ShellRightRail'
import { ShellTopBarContainer } from '@/widgets/shell/ShellTopBarContainer'

export function AppShellContainer() {
  const { leftOpen, toggleLeft } = useSidebarStore()
  const { pathname } = useLocation()
  const showRightRail = pathname === '/' || pathname.startsWith('/c/')

  return (
    <AppShell
      className="min-h-screen bg-background"
      topBar={<ShellTopBarContainer leftOpen={leftOpen} onToggleLeft={toggleLeft} />}
      leftRail={
        <div
          className={cn(
            'sticky top-12 h-[calc(100vh-3rem)] border-r bg-background transition-all duration-200',
            leftOpen ? 'w-60' : 'w-0 overflow-hidden border-r-0',
          )}
        >
          <ShellLeftRail />
        </div>
      }
      rightRail={
        showRightRail ? (
          <div className="sticky top-12 h-[calc(100vh-3rem)] w-72 border-l bg-background">
            <ShellRightRail />
          </div>
        ) : undefined
      }
      leftRailOpen={leftOpen}
      showRightRail={showRightRail}
      footer={<DevAuthToolbar />}
    >
      <div className="min-w-0 flex-1 pb-16">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Outlet />
        </div>
      </div>
    </AppShell>
  )
}
