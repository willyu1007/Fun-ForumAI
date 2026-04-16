import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAgentProfile } from '@/api/hooks'
import { useMyAgents } from '@/api/hooks/user'
import { useAuth } from '@/shared/hooks/use-auth'
import {
  useAgentModalStore,
  type AgentModalRect,
  type AgentModalTab,
} from '@/shared/stores/agent-modal-store'
import { Button } from '@/components/ui/button'
import {
  User,
  MessageSquare,
  BookOpen,
  Users,
  Compass,
  Bot,
  LocateFixed,
  Ellipsis,
  Plus,
  Square,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { getInitials } from '@/shared/utils/get-initials'
import { resolveUserAvatarSrc } from '@/shared/utils/preset-avatars'
import { AgentListSidebar } from './AgentListSidebar'
import { LeftRailAgentDisplayEditor } from '@/widgets/shell/LeftRailAgentDisplayEditor'
import { TabIntro } from '@/features/agents/components/modal/TabIntro'
import { TabChat } from '@/features/agents/components/modal/TabChat'
import { TabMoments } from '@/features/agents/components/modal/TabMoments'
import { TabHistory } from '@/features/agents/components/modal/TabHistory'
import { TabSocial } from '@/features/agents/components/modal/TabSocial'
import { AgentCreateWizard } from '@/features/agents/components/AgentCreateWizard'
import { ScreenshotCropper, type ScreenshotDraft } from '@/features/private-chat/components/ScreenshotCropper'
import {
  captureDisplayFrame,
  preloadCaptureDisplayFrame,
} from '@/features/private-chat/lib/capture-display-frame'

const TABS: { id: AgentModalTab; icon: React.ElementType; label: string }[] = [
  { id: 'intro', icon: User, label: '档案' },
  { id: 'chat', icon: MessageSquare, label: '对话' },
  { id: 'moments', icon: Compass, label: '动态' },
  { id: 'social', icon: Users, label: '关系' },
  { id: 'history', icon: BookOpen, label: '编年史' },
]

const MIN_W_READONLY = 608
const MIN_W_MANAGE = 832
const MIN_H = 510
const MAX_W = 1440
const VIEWPORT_MARGIN = 12

type InteractMode = null | 'drag' | 'resize-se' | 'resize-e' | 'resize-s' | 'resize-w'
type ModalRect = AgentModalRect

function centeredRect() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const w = Math.round(vw * 0.65)
  const h = Math.round(vh * 0.85)
  return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h }
}

function applyRectStyles(element: HTMLDivElement, rect: ModalRect) {
  element.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`
  element.style.width = `${rect.w}px`
  element.style.height = `${rect.h}px`
}

function clearDomSelection() {
  if (typeof window === 'undefined') return
  window.getSelection()?.removeAllRanges()
}

function getViewportRect() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return { vw, vh }
}

function getMinWidthForMode(viewMode: 'manage' | 'readonly') {
  return viewMode === 'manage' ? MIN_W_MANAGE : MIN_W_READONLY
}

function getDefaultRect(viewMode: 'manage' | 'readonly') {
  return clampRectToViewport(centeredRect(), viewMode)
}

function clampRectToViewport(rect: ModalRect, viewMode: 'manage' | 'readonly'): ModalRect {
  const { minWidth, minHeight, maxWidth, maxHeight, vw, vh } = getRectBounds(viewMode)
  const w = Math.min(Math.max(rect.w, minWidth), maxWidth)
  const h = Math.min(Math.max(rect.h, minHeight), maxHeight)
  const maxX = Math.max(VIEWPORT_MARGIN, vw - w - VIEWPORT_MARGIN)
  const maxY = Math.max(VIEWPORT_MARGIN, vh - h - VIEWPORT_MARGIN)

  return {
    x: Math.min(Math.max(rect.x, VIEWPORT_MARGIN), maxX),
    y: Math.min(Math.max(rect.y, VIEWPORT_MARGIN), maxY),
    w,
    h,
  }
}

function getRectBounds(viewMode: 'manage' | 'readonly') {
  const { vw, vh } = getViewportRect()
  const minWidth = Math.min(
    getMinWidthForMode(viewMode),
    Math.max(320, vw - VIEWPORT_MARGIN * 2),
  )
  const minHeight = Math.min(MIN_H, Math.max(420, vh - VIEWPORT_MARGIN * 2))
  const maxWidth = Math.max(minWidth, Math.min(MAX_W, vw - VIEWPORT_MARGIN * 2))
  const maxHeight = Math.max(minHeight, vh - VIEWPORT_MARGIN * 2)

  return { minWidth, minHeight, maxWidth, maxHeight, vw, vh }
}

function getCenteredRect(currentRect: ModalRect, viewMode: 'manage' | 'readonly') {
  const { vw, vh } = getViewportRect()
  return clampRectToViewport(
    {
      ...currentRect,
      x: Math.round((vw - currentRect.w) / 2),
      y: Math.round((vh - currentRect.h) / 2),
    },
    viewMode,
  )
}

function getDefaultSizedRect(currentRect: ModalRect, viewMode: 'manage' | 'readonly') {
  const defaultRect = getDefaultRect(viewMode)
  return clampRectToViewport(
    {
      ...currentRect,
      w: defaultRect.w,
      h: defaultRect.h,
    },
    viewMode,
  )
}

function waitForPaint(frames = 2) {
  return new Promise<void>((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve()
        return
      }

      window.requestAnimationFrame(() => step(remaining - 1))
    }

    step(frames)
  })
}

function clampWestResize(
  originRect: ModalRect,
  dx: number,
  viewMode: 'manage' | 'readonly',
): ModalRect {
  const right = originRect.x + originRect.w
  const { vw } = getViewportRect()
  const minWidth = Math.min(
    getMinWidthForMode(viewMode),
    Math.max(320, vw - VIEWPORT_MARGIN * 2),
  )
  const maxWidth = Math.max(minWidth, Math.min(MAX_W, vw - VIEWPORT_MARGIN * 2))
  const nextWidth = Math.min(Math.max(originRect.w - dx, minWidth), maxWidth)
  const nextX = Math.max(VIEWPORT_MARGIN, right - nextWidth)

  return {
    x: nextX,
    y: originRect.y,
    w: Math.min(right - nextX, maxWidth),
    h: originRect.h,
  }
}

function getCursorForMode(mode: InteractMode): string {
  if (mode === 'drag') return 'grabbing'
  if (mode === 'resize-se') return 'nwse-resize'
  if (mode === 'resize-e') return 'ew-resize'
  if (mode === 'resize-w') return 'ew-resize'
  if (mode === 'resize-s') return 'ns-resize'
  return ''
}

function useModalGeometry(
  isOpen: boolean,
  viewMode: 'manage' | 'readonly',
  contentRef: React.RefObject<HTMLDivElement | null>,
  persistedRect: ModalRect | null,
  setPersistedRect: (rect: ModalRect) => void,
) {
  const [committedRect, setCommittedRect] = useState<ModalRect>(() =>
    persistedRect ? clampRectToViewport(persistedRect, viewMode) : getDefaultRect(viewMode),
  )
  const rectRef = useRef<ModalRect>(committedRect)
  const mode = useRef<InteractMode>(null)
  const origin = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 })
  const previousCursorRef = useRef('')
  const previousUserSelectRef = useRef('')

  const flushRect = useCallback(() => {
    const element = contentRef.current
    if (!element) return
    applyRectStyles(element, rectRef.current)
  }, [contentRef])

  const updateRect = useCallback((nextRect: ModalRect, commit = false) => {
    rectRef.current = nextRect
    flushRect()
    if (commit) {
      setCommittedRect(nextRect)
    }
  }, [flushRect])

  useLayoutEffect(() => {
    if (!isOpen) return
    const rect = persistedRect ? clampRectToViewport(persistedRect, viewMode) : getDefaultRect(viewMode)
    rectRef.current = rect
    setCommittedRect(rect)
    flushRect()
  }, [flushRect, isOpen, persistedRect, viewMode])

  const onPointerMove = useCallback((event: PointerEvent) => {
    const currentMode = mode.current
    if (!currentMode) return

    const dx = event.clientX - origin.current.mx
    const dy = event.clientY - origin.current.my

    if (currentMode === 'drag') {
      updateRect(clampRectToViewport({
        ...rectRef.current,
        x: origin.current.x + dx,
        y: origin.current.y + dy,
      }, viewMode))
      return
    }

    if (currentMode === 'resize-w') {
      updateRect(clampWestResize({
        ...origin.current,
      }, dx, viewMode))
      return
    }

    updateRect(clampRectToViewport({
      ...rectRef.current,
      w: currentMode !== 'resize-s' ? origin.current.w + dx : origin.current.w,
      h: currentMode !== 'resize-e' ? origin.current.h + dy : origin.current.h,
    }, viewMode))
  }, [updateRect, viewMode])

  const onPointerUp = useCallback(() => {
    if (mode.current) {
      setCommittedRect(rectRef.current)
      setPersistedRect(rectRef.current)
    }
    mode.current = null

    if (typeof document === 'undefined') return
    document.body.style.cursor = previousCursorRef.current
    document.body.style.userSelect = previousUserSelectRef.current
  }, [setPersistedRect])

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return

    const handleResize = () => {
      const nextRect = clampRectToViewport(rectRef.current, viewMode)
      updateRect(nextRect, true)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('resize', handleResize)
      onPointerUp()
    }
  }, [isOpen, onPointerMove, onPointerUp, updateRect, viewMode])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>, nextMode: InteractMode) => {
    if (!nextMode) return
    event.preventDefault()
    mode.current = nextMode
    const { x, y, w, h } = rectRef.current
    origin.current = { mx: event.clientX, my: event.clientY, x, y, w, h }
    if (typeof document !== 'undefined') {
      previousCursorRef.current = document.body.style.cursor
      previousUserSelectRef.current = document.body.style.userSelect
      document.body.style.cursor = getCursorForMode(nextMode)
      document.body.style.userSelect = 'none'
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [])

  const restoreDefaultSize = useCallback(() => {
    const nextRect = getDefaultSizedRect(rectRef.current, viewMode)
    updateRect(nextRect, true)
    setPersistedRect(nextRect)
  }, [setPersistedRect, updateRect, viewMode])

  const centerCurrent = useCallback(() => {
    const nextRect = getCenteredRect(rectRef.current, viewMode)
    updateRect(nextRect, true)
    setPersistedRect(nextRect)
  }, [setPersistedRect, updateRect, viewMode])

  return { onPointerDown, rect: committedRect, restoreDefaultSize, centerCurrent, flushRect }
}

export function AgentInteractionModal() {
  const isOpen = useAgentModalStore((state) => state.isOpen)
  const isCaptureHidden = useAgentModalStore((state) => state.isCaptureHidden)
  const closeModal = useAgentModalStore((state) => state.closeModal)
  const hideForCapture = useAgentModalStore((state) => state.hideForCapture)
  const showAfterCapture = useAgentModalStore((state) => state.showAfterCapture)
  const activeTab = useAgentModalStore((state) => state.activeTab)
  const setActiveTab = useAgentModalStore((state) => state.setActiveTab)
  const activeAgentId = useAgentModalStore((state) => state.activeAgentId)
  const openModal = useAgentModalStore((state) => state.openModal)
  const viewMode = useAgentModalStore((state) => state.viewMode)
  const pendingCreateWizard = useAgentModalStore((state) => state.pendingCreateWizard)
  const setPendingCreateWizard = useAgentModalStore((state) => state.setPendingCreateWizard)
  const setLastModalRect = useAgentModalStore((state) => state.setLastModalRect)
  const lastModalRect = useAgentModalStore.getState().lastModalRect
  const contentRef = useRef<HTMLDivElement | null>(null)
  const screenshotResolverRef = useRef<((file: File | null) => void) | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [screenshotDraft, setScreenshotDraft] = useState<ScreenshotDraft | null>(null)
  const [screenshotErrorMessage, setScreenshotErrorMessage] = useState<string | null>(null)
  const { onPointerDown, restoreDefaultSize, centerCurrent, flushRect } = useModalGeometry(
    isOpen,
    viewMode,
    contentRef,
    lastModalRect,
    setLastModalRect,
  )
  const { user } = useAuth()
  const ownerAvatarSrc = user ? resolveUserAvatarSrc(user) : null
  const { data: myAgentsData } = useMyAgents(isOpen)
  const myAgentIds = useMemo(() => myAgentsData?.data?.map((a) => a.id), [myAgentsData])
  const validActiveAgentId =
    viewMode === 'manage' && activeAgentId && myAgentIds
      ? (myAgentIds.includes(activeAgentId) ? activeAgentId : null)
      : activeAgentId
  const { data: activeAgentData } = useAgentProfile(validActiveAgentId ?? '', !!validActiveAgentId)
  const activeAgent = activeAgentData?.data
  const visibleTabs = useMemo(
    () => (activeAgent?.status === 'DELETED' ? TABS.filter((tab) => tab.id === 'intro') : TABS),
    [activeAgent?.status],
  )
  const headerAgentName = activeAgentData?.data?.display_name ?? ''
  const headerPresenceNote =
    activeTab === 'chat' ? activeAgent?.social_bio?.presence_note?.trim() ?? '' : ''
  const isCropperActive = Boolean(screenshotDraft)
  const shouldBlockDialogDismiss = isCaptureHidden || isCropperActive

  const setContentNode = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node
    if (!node) return
    flushRect()
  }, [flushRect])

  const handleModalClose = useCallback(() => {
    setWizardOpen(false)
    closeModal()
  }, [closeModal])

  useEffect(() => {
    if (!isOpen) {
      setWizardOpen(false)
      screenshotResolverRef.current?.(null)
      screenshotResolverRef.current = null
      setScreenshotDraft(null)
      setScreenshotErrorMessage(null)
      return
    }
    if (pendingCreateWizard) {
      setPendingCreateWizard(false)
      setWizardOpen(true)
    }
  }, [isOpen, pendingCreateWizard, setPendingCreateWizard])

  useEffect(() => {
    if (!isOpen) return
    preloadCaptureDisplayFrame()
  }, [isOpen])

  useEffect(() => {
    return () => {
      screenshotResolverRef.current?.(null)
      screenshotResolverRef.current = null
      showAfterCapture()
    }
  }, [showAfterCapture])

  useEffect(() => {
    if (activeAgent?.status === 'DELETED' && activeTab !== 'intro') {
      setActiveTab('intro')
    }
  }, [activeAgent?.status, activeTab, setActiveTab])

  const handleCaptureScreenshot = useCallback(async () => {
    setScreenshotErrorMessage(null)
    clearDomSelection()
    hideForCapture()

    try {
      await waitForPaint(1)
      const draft = await captureDisplayFrame()
      if (!draft) {
        showAfterCapture()
        return null
      }

      return await new Promise<File | null>((resolve) => {
        screenshotResolverRef.current = resolve
        setScreenshotDraft(draft)
      })
    } catch (error) {
      setScreenshotErrorMessage(error instanceof Error ? error.message : '截图失败，请稍后再试。')
      showAfterCapture()
      return null
    }
  }, [hideForCapture, showAfterCapture])

  const resolveScreenshotDraft = useCallback((file: File | null) => {
    clearDomSelection()
    screenshotResolverRef.current?.(file)
    screenshotResolverRef.current = null
    setScreenshotDraft(null)
    showAfterCapture()
  }, [showAfterCapture])

  if (!validActiveAgentId && viewMode === 'readonly') {
    return null
  }

  const showSidebar = viewMode === 'manage'

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <AgentCreateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(agent) => {
          setWizardOpen(false)
          openModal(agent.id, 'manage', 'intro')
        }}
      />
      <DialogContent
        ref={setContentNode}
        data-size="full"
        data-testid="agent-modal-content"
        showCloseButton={false}
        hideOverlay={isCaptureHidden}
        onInteractOutside={shouldBlockDialogDismiss ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={shouldBlockDialogDismiss ? (event) => event.preventDefault() : undefined}
        onEscapeKeyDown={shouldBlockDialogDismiss ? (event) => event.preventDefault() : undefined}
        className={cn(
          "top-0 left-0 h-auto w-auto max-w-none translate-x-0 translate-y-0 animate-none gap-0 overflow-hidden p-0 transition-none sm:max-w-none flex flex-col will-change-transform",
          isCaptureHidden && "pointer-events-none invisible opacity-0",
        )}
      >
        <DialogTitle className="sr-only">Agent Interaction</DialogTitle>
        <DialogDescription className="sr-only">
          查看或管理智能体资料、互动入口与相关设置。
        </DialogDescription>

        {/* Drag handle bar */}
        <div
          data-testid="agent-modal-drag-handle"
          className="flex h-10 shrink-0 cursor-grab select-none touch-none active:cursor-grabbing"
          onPointerDown={(e) => onPointerDown(e, 'drag')}
        >
          <div className="flex h-full w-12 shrink-0 items-center justify-center border-r border-border/60 bg-muted/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={ownerAvatarSrc ?? undefined}
                    alt={user?.displayName ?? ''}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/15 text-[10px] font-medium text-primary">
                    {getInitials(user?.displayName ?? '')}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {user?.displayName ?? '我'}
              </TooltipContent>
            </Tooltip>
          </div>

          {showSidebar && (
            <div className="flex h-full w-64 shrink-0 items-center justify-between border-r border-border/70 bg-background/75 px-4 backdrop-blur-xl">
              <div className="truncate text-sm font-semibold text-foreground">我的智能体</div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="创建智能体"
                title="创建智能体"
                data-testid="agent-modal-create-button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setWizardOpen(true)}
                className="h-8 w-8 rounded-xl"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex flex-1 items-center bg-background/75 pl-5 pr-4 backdrop-blur-xl">
            <div className="min-w-0 flex-1">
              {headerAgentName && (
                <div className="flex items-baseline gap-2">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {headerAgentName}
                  </div>
                  {headerPresenceNote ? (
                    <div
                      className="min-w-0 truncate text-xs text-muted-foreground"
                      data-testid="agent-modal-header-presence-note"
                    >
                      {headerPresenceNote}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="z-20 flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="更多操作"
                    title="更多操作"
                    data-testid="agent-modal-more-button"
                    onPointerDown={(event) => event.stopPropagation()}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6}>
                  <DropdownMenuItem
                    data-testid="agent-modal-center-button"
                    onClick={centerCurrent}
                  >
                    <LocateFixed className="h-4 w-4" />
                    视觉居中
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="agent-modal-restore-button"
                    onClick={restoreDefaultSize}
                  >
                    <Square className="h-4 w-4" />
                    恢复默认尺寸
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                aria-label="关闭弹窗"
                title="关闭弹窗"
                data-testid="agent-modal-close-button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={handleModalClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body: icon rail + sidebar + content */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {/* Icon rail */}
          <nav className="flex w-12 shrink-0 flex-col items-center border-r border-border/60 bg-muted/50 py-2.5">
            <div className="flex flex-col items-center gap-1">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        aria-label={tab.label}
                        title={tab.label}
                        data-testid={`agent-modal-tab-${tab.id}`}
                        className={cn(
                          'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                          isActive
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
                        )}
                        <Icon className="h-[17px] w-[17px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={6}>
                      {tab.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>

            <div className="mt-auto flex w-full justify-center pt-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div><LeftRailAgentDisplayEditor /></div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  编辑左下角展示的智能体
                </TooltipContent>
              </Tooltip>
            </div>
          </nav>

          {/* Agent list (manage mode only) */}
          {showSidebar && <AgentListSidebar onCreateAgent={() => setWizardOpen(true)} />}

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background relative">
            {!validActiveAgentId ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-border/70 text-muted-foreground/40">
                  <Bot className="h-7 w-7" />
                </span>
                <span className="text-xs text-muted-foreground/60">你好，世界</span>
              </div>
            ) : (
              <>
                {activeTab === 'intro' && (
                  <div className="flex-1 overflow-y-auto">
                    <TabIntro agentId={validActiveAgentId} />
                  </div>
                )}
                {activeTab === 'chat' && (
                  <div className="flex-1 overflow-hidden">
                    <TabChat
                      agentId={validActiveAgentId}
                      onCaptureScreenshot={handleCaptureScreenshot}
                      captureErrorMessage={screenshotErrorMessage}
                    />
                  </div>
                )}
                {activeTab === 'moments' && (
                  <div className="flex-1 overflow-y-auto">
                    <TabMoments agentId={validActiveAgentId} />
                  </div>
                )}
                {activeTab === 'history' && (
                  <div className="flex-1 overflow-y-auto">
                    <TabHistory agentId={validActiveAgentId} />
                  </div>
                )}
                {activeTab === 'social' && (
                  <div className="flex-1 overflow-y-auto">
                    <TabSocial agentId={validActiveAgentId} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Resize handles */}
        <div
          data-testid="agent-modal-resize-w-handle"
          className="absolute top-8 left-0 bottom-5 w-3 cursor-e-resize z-10 touch-none"
          onPointerDown={(e) => onPointerDown(e, 'resize-w')}
        />
        <div
          data-testid="agent-modal-resize-se-handle"
          className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize z-10 touch-none"
          onPointerDown={(e) => onPointerDown(e, 'resize-se')}
        />
        <div
          data-testid="agent-modal-resize-e-handle"
          className="absolute top-8 right-0 bottom-5 w-3 cursor-e-resize z-10 touch-none"
          onPointerDown={(e) => onPointerDown(e, 'resize-e')}
        />
        <div
          data-testid="agent-modal-resize-s-handle"
          className="absolute bottom-0 left-12 right-5 h-3 cursor-s-resize z-10 touch-none"
          onPointerDown={(e) => onPointerDown(e, 'resize-s')}
        />
      </DialogContent>
    </Dialog>
      <ScreenshotCropper
        draft={screenshotDraft}
        open={Boolean(screenshotDraft)}
        onCancel={() => resolveScreenshotDraft(null)}
        onConfirm={(file) => resolveScreenshotDraft(file)}
      />
    </>
  )
}
