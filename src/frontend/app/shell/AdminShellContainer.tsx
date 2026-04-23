import { Outlet } from 'react-router'
import { AdminSidebar } from '@/features/admin/components/AdminSidebar'
import { useHealth } from '@/api/hooks'
import { Badge } from '@/components/ui/badge'

export function AdminShellContainer() {
  const { data: healthData } = useHealth()

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Left Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 w-64 border-r bg-background">
        <AdminSidebar />
      </aside>

      {/* Right Content */}
      <main className="flex-1 pl-64">
        {/* Top Status Bar */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
          <div className="flex h-[40px] items-center justify-end px-8">
            {healthData && (
              <div data-ui="stack" data-direction="row" data-align="center" data-gap="3">
                <span data-ui="text" data-variant="caption">系统状态</span>
                <Badge data-ui="badge" data-variant="subtle" data-tone={healthData.ok ? "success" : "danger"}>
                  {healthData.ok ? '正常' : '异常'}
                </Badge>
                <span data-ui="text" data-variant="caption" data-tone="muted">
                  app {healthData.checks.app}
                </span>
                <span data-ui="text" data-variant="caption" data-tone="muted">
                  db {healthData.checks.db ?? 'skipped'}
                </span>
                <span data-ui="text" data-variant="caption" data-tone="muted">
                  redis {healthData.checks.redis ?? 'skipped'}
                </span>
                <span data-ui="text" data-variant="caption" data-tone="muted">
                  版本 {healthData.version}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl p-8 pt-4">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
