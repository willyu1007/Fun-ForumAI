import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAgentProfile } from '@/api/hooks'
import {
  useAgentModalStore,
  type AgentModalRect,
  type AgentModalTab,
} from '@/shared/stores/agent-modal-store'
import { Button } from '@/components/ui/button'
import {
  User,
  MessageSquare,
  History,
  Users,
  Activity,
  LocateFixed,
  Plus,
  Square,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentListSidebar } from './AgentListSidebar'
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
  { id: 'intro', icon: User, label: '介绍与管理' },
  { id: 'chat', icon: MessageSquare, label: '主聊天' },
  { id: 'moments', icon: Activity, label: '动态' },
  { id: 'history', icon: History, label: '成长编年史' },
  { id: 'social', icon: Users, label: '社会关系' },
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
  const setActiveAgent = useAgentModalStore((state) => state.setActiveAgent)
  const viewMode = useAgentModalStore((state) => state.viewMode)
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
  const { data: activeAgentData } = useAgentProfile(activeAgentId ?? '')
  const headerAgentName = activeAgentData?.data?.display_name ?? ''
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
    }
  }, [isOpen])

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

  if (!activeAgentId && viewMode === 'readonly') {
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
          setActiveAgent(agent.id)
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

        {/* Drag handle bar */}
        <div
          data-testid="agent-modal-drag-handle"
          className="flex h-10 shrink-0 cursor-grab select-none touch-none active:cursor-grabbing"
          onPointerDown={(e) => onPointerDown(e, 'drag')}
        >
          <div className="h-full w-14 shrink-0 border-r border-primary/12 bg-primary/12 backdrop-blur-xl" />

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
                <div className="truncate text-sm font-semibold text-foreground">
                  {headerAgentName}
                </div>
              )}
            </div>

            <div className="z-20 flex items-center gap-2">
              <button
                type="button"
                aria-label="视觉居中"
                title="视觉居中"
                data-testid="agent-modal-center-button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={centerCurrent}
                className="group flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-success-foreground transition-transform hover:scale-105 hover:bg-success/90"
              >
                <LocateFixed className="h-[8px] w-[8px] opacity-0 transition-opacity group-hover:opacity-75" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                aria-label="恢复默认尺寸"
                title="恢复默认尺寸"
                data-testid="agent-modal-restore-button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={restoreDefaultSize}
                className="group flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-warning-foreground transition-transform hover:scale-105 hover:bg-warning/90"
              >
                <Square className="h-[7px] w-[7px] opacity-0 transition-opacity group-hover:opacity-70" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label="关闭弹窗"
                title="关闭弹窗"
                data-testid="agent-modal-close-button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={handleModalClose}
                className="group flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-transform hover:scale-105 hover:bg-destructive/90"
              >
                <X className="h-[8px] w-[8px] opacity-0 transition-opacity group-hover:opacity-75" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Body: icon rail + sidebar + content */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {/* Icon rail */}
          <nav className="flex w-14 shrink-0 flex-col items-center border-r border-primary/12 bg-primary/12 py-3 backdrop-blur-xl">
            <div className="flex flex-col items-center gap-1">
              {TABS.map((tab) => {
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
                          'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                          isActive
                            ? 'bg-background/95 text-foreground shadow-sm ring-1 ring-border/70'
                            : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={6}>
                      {tab.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </nav>

          {/* Agent list (manage mode only) */}
          {showSidebar && <AgentListSidebar />}

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background relative">
            {!activeAgentId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                请选择一个智能体
              </div>
            ) : (
              <>
                {activeTab === 'intro' && (
                  <div className="flex-1 overflow-y-auto">
                    <TabIntro agentId={activeAgentId} />
                  </div>
                )}
                {activeTab === 'chat' && (
                  <div className="flex-1 overflow-hidden">
                    <TabChat
                      agentId={activeAgentId}
                      onCaptureScreenshot={handleCaptureScreenshot}
                      captureErrorMessage={screenshotErrorMessage}
                    />
                  </div>
                )}
                {activeTab === 'moments' && (
                  <div className="flex-1 overflow-y-auto">
                    <TabMoments agentId={activeAgentId} />
                  </div>
                )}
                {activeTab === 'history' && (
                  <div className="flex-1 overflow-y-auto">
                    <TabHistory agentId={activeAgentId} />
                  </div>
                )}
                {activeTab === 'social' && (
                  <div className="flex-1 overflow-y-auto">
                    <TabSocial agentId={activeAgentId} />
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
          className="absolute bottom-0 left-14 right-5 h-3 cursor-s-resize z-10 touch-none"
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
