import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AppShell } from '@fun-forum/ui-web/shell'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { parseAgentTarget } from '../../../shared/agent-target.js'
import {
  getAppShellContentSafeAreaClass,
  SHOULD_RENDER_DEV_AUTH_TOOLBAR,
} from '@/shared/layout/dev-auth-toolbar'
import { useDevAuthToolbarStore } from '@/shared/stores/dev-auth-toolbar-store'
import { cn } from '@/lib/utils'
import { DevAuthToolbar } from '@/widgets/dev/DevAuthToolbar'
import { ShellLeftRail } from '@/widgets/shell/ShellLeftRail'
import { ShellTopBarContainer } from '@/widgets/shell/ShellTopBarContainer'
import { lazyWithDynamicImportRecovery } from '../lazy-import-recovery'

const LazyAgentInteractionModal = lazyWithDynamicImportRecovery(() =>
  import('@/widgets/agent-modal/AgentInteractionModal').then((module) => ({
    default: module.AgentInteractionModal,
  })),
  'widget:agent-interaction-modal',
)

export function AppShellContainer() {
  const { leftOpen, toggleLeft } = useSidebarStore()
  const { view } = useFeedViewStore()
  const navigate = useNavigate()
  const openModal = useAgentModalStore((state) => state.openModal)
  const isAgentModalOpen = useAgentModalStore((state) => state.isOpen)
  const shouldMountAgentModal = useAgentModalStore((state) => state.isOpen || state.activeAgentId !== null)
  const isDevAuthToolbarCollapsed = useDevAuthToolbarStore((state) => state.collapsed)
  const { pathname, search } = useLocation()
  const routeBackedModalKeyRef = useRef<string | null>(null)
  const routeBackedModalWasOpenedRef = useRef(false)
  const routeBackedTarget = useMemo(
    () => parseAgentTarget(`${pathname}${search}`),
    [pathname, search],
  )
  const routeBackedTargetKey = routeBackedTarget ? `${pathname}${search}` : null
  const useWideFeedFrame = pathname === '/' || pathname === '/feed' || pathname.startsWith('/c/') || pathname === '/search' || pathname === '/communities' || pathname === '/highlights'
  const useCompactStretchFrame = (pathname === '/feed' || pathname.startsWith('/c/') || pathname === '/search') && view === 'compact'
  const useWidePageFrame = useWideFeedFrame || pathname.startsWith('/posts/')
  const useFullWidthPageFrame = pathname.startsWith('/help') || pathname === '/terms' || pathname === '/privacy' || pathname === '/feedback' || pathname === '/safety'
  const contentSafeAreaClass = getAppShellContentSafeAreaClass(
    SHOULD_RENDER_DEV_AUTH_TOOLBAR,
    isDevAuthToolbarCollapsed,
  )

  useEffect(() => {
    if (!routeBackedTarget || !routeBackedTargetKey) {
      routeBackedModalKeyRef.current = null
      routeBackedModalWasOpenedRef.current = false
      return
    }

    routeBackedModalKeyRef.current = routeBackedTargetKey

    if (routeBackedTarget.kind === 'manage') {
      openModal(null, routeBackedTarget.mode ?? 'manage', 'intro')
      return
    }

    openModal(
      routeBackedTarget.agentId,
      routeBackedTarget.mode ?? 'readonly',
      routeBackedTarget.tab ?? 'intro',
      {
        introSection: routeBackedTarget.introSection ?? null,
        sourceSessionId: routeBackedTarget.sourceSessionId ?? null,
      },
    )
  }, [openModal, routeBackedTarget, routeBackedTargetKey])

  useEffect(() => {
    if (routeBackedModalKeyRef.current !== routeBackedTargetKey) {
      routeBackedModalWasOpenedRef.current = false
      return
    }

    if (isAgentModalOpen) {
      routeBackedModalWasOpenedRef.current = true
      return
    }

    if (!routeBackedModalWasOpenedRef.current) {
      return
    }

    routeBackedModalWasOpenedRef.current = false
    navigate('/', { replace: true })
  }, [isAgentModalOpen, navigate, routeBackedTargetKey])

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
            'mx-auto pb-4 transition-all duration-200',
            useFullWidthPageFrame ? 'px-4 sm:px-8 lg:px-12' : 'px-4 md:px-3',
            (useWidePageFrame || useFullWidthPageFrame) ? 'pt-0' : 'pt-4',
            useFullWidthPageFrame
              ? 'max-w-5xl'
              : useWidePageFrame
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
