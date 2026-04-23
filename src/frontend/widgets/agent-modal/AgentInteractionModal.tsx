import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAgentProfile } from '@/api/hooks'
import { useDeleteAgent } from '@/api/hooks/agent'
import { useMyAgents } from '@/api/hooks/user'
import { getApiErrorCode } from '@/api/client'
import { useAuth } from '@/shared/hooks/use-auth'
import {
  READONLY_MODAL_LAYOUT_VERSION,
  useAgentModalStore,
  type AgentModalRect,
  type AgentModalTab,
} from '@/shared/stores/agent-modal-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { cn } from '@/lib/utils'
import { getInitials } from '@/shared/utils/get-initials'
import { resolveUserAvatarSrc } from '@/shared/utils/preset-avatars'
import { AgentListSidebar } from './AgentListSidebar'
import { TabIntro } from '@/features/agents/components/modal/TabIntro'
import type { ScreenshotDraft } from '@/features/private-chat/components/ScreenshotCropper'
import {
  captureDisplayFrame,
  preloadCaptureDisplayFrame,
} from '@/features/private-chat/lib/capture-display-frame'

const LazyTabChat = lazy(() =>
  import('@/features/agents/components/modal/TabChat').then((module) => ({
    default: module.TabChat,
  })),
)

const LazyTabMoments = lazy(() =>
  import('@/features/agents/components/modal/TabMoments').then((module) => ({
    default: module.TabMoments,
  })),
)

const LazyTabHistory = lazy(() =>
  import('@/features/agents/components/modal/TabHistory').then((module) => ({
    default: module.TabHistory,
  })),
)

const LazyTabSocial = lazy(() =>
  import('@/features/agents/components/modal/TabSocial').then((module) => ({
    default: module.TabSocial,
  })),
)

const LazyAgentCreateWizard = lazy(() =>
  import('@/features/agents/components/AgentCreateWizard').then((module) => ({
    default: module.AgentCreateWizard,
  })),
)

const LazyScreenshotCropper = lazy(() =>
  import('@/features/private-chat/components/ScreenshotCropper').then((module) => ({
    default: module.ScreenshotCropper,
  })),
)

const LazyLeftRailAgentDisplayEditor = lazy(() =>
  import('@/widgets/shell/LeftRailAgentDisplayEditor').then((module) => ({
    default: module.LeftRailAgentDisplayEditor,
  })),
)

const TABS: { id: AgentModalTab; icon: React.ElementType; label: string }[] = [
  { id: 'intro', icon: User, label: '档案' },
  { id: 'chat', icon: MessageSquare, label: '对话' },
  { id: 'moments', icon: Compass, label: '动态' },
  { id: 'social', icon: Users, label: '朋友圈' },
  { id: 'history', icon: BookOpen, label: '编年史' },
]

const READONLY_TAB_IDS: AgentModalTab[] = ['intro', 'moments', 'social', 'history']

function getReadonlyTabLabel(tab: AgentModalTab): string {
  switch (tab) {
    case 'intro':
      return '概览'
    case 'moments':
      return '动态'
    case 'social':
      return '朋友圈'
    case 'history':
      return '编年史'
    default:
      return ''
  }
}

const MIN_W_READONLY = 520
const MIN_W_MANAGE = 832
const MIN_H = 510
const MAX_W = 1440
const VIEWPORT_MARGIN = 12
const NARROW_VIEWPORT_WIDTH = 768
const DEFAULT_WIDTH_RATIO_READONLY = 0.48
const DEFAULT_HEIGHT_RATIO_READONLY = 0.78
const DEFAULT_WIDTH_RATIO_MANAGE = 0.65
const DEFAULT_HEIGHT_RATIO_MANAGE = 0.85

type InteractMode = null | 'drag' | 'resize-se' | 'resize-e' | 'resize-s' | 'resize-w'
type ModalRect = AgentModalRect

function ModalPanelFallback({ scrollable = false }: { scrollable?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-full items-center justify-center text-sm text-muted-foreground',
        scrollable && 'min-h-[16rem]',
      )}
    >
      加载中…
    </div>
  )
}

function centeredRect(viewMode: 'manage' | 'readonly') {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const isNarrowViewport = vw < NARROW_VIEWPORT_WIDTH
  const widthRatio =
    isNarrowViewport
      ? 1
      : (viewMode === 'readonly' ? DEFAULT_WIDTH_RATIO_READONLY : DEFAULT_WIDTH_RATIO_MANAGE)
  const heightRatio =
    isNarrowViewport
      ? 1
      : (viewMode === 'readonly' ? DEFAULT_HEIGHT_RATIO_READONLY : DEFAULT_HEIGHT_RATIO_MANAGE)
  const w = Math.round(vw * widthRatio)
  const h = Math.round(vh * heightRatio)
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
  return clampRectToViewport(centeredRect(viewMode), viewMode)
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
  const invalidateAgent = useAgentModalStore((state) => state.invalidateAgent)
  const lastModalRect = useAgentModalStore((state) => state.lastModalRect)
  const lastModalRectMode = useAgentModalStore((state) => state.lastModalRectMode)
  const readonlyLayoutVersion = useAgentModalStore((state) => state.readonlyLayoutVersion)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const screenshotResolverRef = useRef<((file: File | null) => void) | null>(null)
  const geometryMenuRef = useRef<HTMLDivElement | null>(null)
  const geometryMenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const geometryCenterButtonRef = useRef<HTMLButtonElement | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [screenshotDraft, setScreenshotDraft] = useState<ScreenshotDraft | null>(null)
  const [screenshotErrorMessage, setScreenshotErrorMessage] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('')
  const [geometryMenuOpen, setGeometryMenuOpen] = useState(false)
  const [geometryMenuPosition, setGeometryMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const persistedRect =
    lastModalRect
    && lastModalRectMode === viewMode
    && (viewMode !== 'readonly' || readonlyLayoutVersion === READONLY_MODAL_LAYOUT_VERSION)
      ? lastModalRect
      : null
  const { onPointerDown, restoreDefaultSize, centerCurrent, flushRect } = useModalGeometry(
    isOpen,
    viewMode,
    contentRef,
    persistedRect,
    (rect) => setLastModalRect(rect, viewMode),
  )
  const { user, isAuthenticated } = useAuth()
  const ownerAvatarSrc = user ? resolveUserAvatarSrc(user) : null
  const { data: myAgentsData } = useMyAgents(isOpen && isAuthenticated)
  const myAgentIds = useMemo(() => myAgentsData?.data?.map((a) => a.id), [myAgentsData])
  const validActiveAgentId =
    viewMode === 'manage' && activeAgentId && myAgentIds
      ? (myAgentIds.includes(activeAgentId) ? activeAgentId : null)
      : activeAgentId
  const activeAgentProfileQuery = useAgentProfile(validActiveAgentId ?? '', !!validActiveAgentId)
  const { data: activeAgentData } = activeAgentProfileQuery
  const deleteAgentMutation = useDeleteAgent(validActiveAgentId ?? '')
  const activeAgent = activeAgentData?.data
  const deleteConfirmMatches = deleteConfirmValue.trim() === (activeAgent?.display_name ?? '')
  const visibleTabs = useMemo(() => {
    const tabsForMode =
      viewMode === 'readonly'
        ? TABS.filter((tab) => READONLY_TAB_IDS.includes(tab.id))
        : TABS

    return activeAgent?.status === 'DELETED'
      ? tabsForMode.filter((tab) => tab.id === 'intro')
      : tabsForMode
  }, [activeAgent?.status, viewMode])
  const headerAgentName = activeAgentData?.data?.display_name ?? ''
  const headerPresenceNote =
    activeTab === 'chat' ? activeAgent?.social_bio?.presence_note?.trim() ?? '' : ''
  const isCropperActive = Boolean(screenshotDraft)
  const shouldBlockDialogDismiss = isCaptureHidden || isCropperActive

  const closeDeleteConfirmPanel = useCallback(() => {
    setDeleteConfirmOpen(false)
    setDeleteConfirmValue('')
  }, [])

  const setContentNode = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node
    if (!node) return
    flushRect()
  }, [flushRect])

  const handleModalClose = useCallback(() => {
    setWizardOpen(false)
    closeDeleteConfirmPanel()
    setGeometryMenuOpen(false)
    setGeometryMenuPosition(null)
    closeModal()
  }, [closeDeleteConfirmPanel, closeModal])

  const closeGeometryMenu = useCallback((restoreFocus = false) => {
    setGeometryMenuOpen(false)
    setGeometryMenuPosition(null)
    if (restoreFocus) {
      geometryMenuTriggerRef.current?.focus()
    }
  }, [])

  const toggleGeometryMenu = useCallback(() => {
    if (geometryMenuOpen) {
      closeGeometryMenu(true)
      return
    }

    const trigger = geometryMenuTriggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    setGeometryMenuPosition({
      top: Math.round(rect.bottom + 6),
      left: Math.round(rect.right),
    })
    setGeometryMenuOpen(true)
  }, [closeGeometryMenu, geometryMenuOpen])

  useEffect(() => {
    if (!isOpen) {
      setWizardOpen(false)
      closeDeleteConfirmPanel()
      setGeometryMenuOpen(false)
      setGeometryMenuPosition(null)
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
  }, [closeDeleteConfirmPanel, isOpen, pendingCreateWizard, setPendingCreateWizard])

  useEffect(() => {
    if (!isOpen) return
    preloadCaptureDisplayFrame()
  }, [isOpen])

  useEffect(() => {
    if (!geometryMenuOpen || typeof document === 'undefined') return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && geometryMenuRef.current?.contains(target)) return
      if (target && geometryMenuTriggerRef.current?.contains(target)) return
      closeGeometryMenu()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeGeometryMenu(true)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeGeometryMenu, geometryMenuOpen])

  useEffect(() => {
    if (!geometryMenuOpen || typeof window === 'undefined') return

    const updateGeometryMenuPosition = () => {
      const trigger = geometryMenuTriggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      setGeometryMenuPosition({
        top: Math.round(rect.bottom + 6),
        left: Math.round(rect.right),
      })
    }

    updateGeometryMenuPosition()
    window.addEventListener('resize', updateGeometryMenuPosition)
    window.addEventListener('scroll', updateGeometryMenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateGeometryMenuPosition)
      window.removeEventListener('scroll', updateGeometryMenuPosition, true)
    }
  }, [geometryMenuOpen])

  useEffect(() => {
    if (!geometryMenuOpen) return
    geometryCenterButtonRef.current?.focus()
  }, [geometryMenuOpen])

  useEffect(() => {
    if (!validActiveAgentId) return
    if (getApiErrorCode(activeAgentProfileQuery.error) !== 'NOT_FOUND') return
    invalidateAgent(validActiveAgentId)
  }, [activeAgentProfileQuery.error, invalidateAgent, validActiveAgentId])

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

  useEffect(() => {
    if (visibleTabs.some((tab) => tab.id === activeTab)) return
    setActiveTab(visibleTabs[0]?.id ?? 'intro')
  }, [activeTab, setActiveTab, visibleTabs])

  useEffect(() => {
    closeDeleteConfirmPanel()
  }, [activeAgent?.id, activeTab, closeDeleteConfirmPanel])

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
  const showIconRail = viewMode === 'manage'
  const readonlyTabs = visibleTabs.filter((tab) => READONLY_TAB_IDS.includes(tab.id))
  const showReadonlyTopTabs = viewMode === 'readonly' && readonlyTabs.length > 0

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      {wizardOpen ? (
        <Suspense fallback={null}>
          <LazyAgentCreateWizard
            open={wizardOpen}
            onClose={() => setWizardOpen(false)}
            onCreated={(agent) => {
              setWizardOpen(false)
              openModal(agent.id, 'manage', 'intro')
            }}
          />
        </Suspense>
      ) : null}
      <DialogContent
        ref={setContentNode}
        data-size="full"
        data-testid="agent-modal-content"
        showCloseButton={false}
        hideOverlay={isCaptureHidden}
        onInteractOutside={shouldBlockDialogDismiss ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={shouldBlockDialogDismiss ? (event) => event.preventDefault() : undefined}
        onEscapeKeyDown={
          deleteConfirmOpen
            ? (event) => {
                event.preventDefault()
                closeDeleteConfirmPanel()
              }
            : shouldBlockDialogDismiss
              ? (event) => event.preventDefault()
              : undefined
        }
        className={cn(
          "top-0 left-0 h-auto w-auto max-w-none translate-x-0 translate-y-0 animate-none gap-0 overflow-hidden p-0 transition-none sm:max-w-none flex flex-col will-change-transform",
          isCaptureHidden && "pointer-events-none invisible opacity-0",
        )}
      >
        <DialogTitle className="sr-only">Agent Interaction</DialogTitle>
        <DialogDescription className="sr-only">
          查看或管理智能体资料、互动入口与相关设置。
        </DialogDescription>

        {showSidebar && (
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

              <div className="relative z-20 flex items-center gap-1">
                <button
                  ref={geometryMenuTriggerRef}
                  type="button"
                  id="agent-modal-geometry-trigger"
                  aria-label="更多操作"
                  aria-haspopup="menu"
                  aria-expanded={geometryMenuOpen}
                  aria-controls={geometryMenuOpen ? 'agent-modal-geometry-menu' : undefined}
                  title="更多操作"
                  data-testid="agent-modal-more-button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={toggleGeometryMenu}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
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
        )}

        {/* Body: icon rail + sidebar + content */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {/* Icon rail */}
          {showIconRail && (
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
                    <div>
                      <Suspense fallback={<span className="block h-8 w-8" />}>
                        <LazyLeftRailAgentDisplayEditor />
                      </Suspense>
                    </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={6}>
                      编辑左下角展示的智能体
                  </TooltipContent>
                </Tooltip>
              </div>
            </nav>
          )}

          {/* Agent list (manage mode only) */}
          {showSidebar && <AgentListSidebar onCreateAgent={() => setWizardOpen(true)} />}

          {/* Main content */}
          <div
            className={cn(
              'flex-1 flex flex-col min-w-0 overflow-hidden bg-background relative',
              activeTab === 'social' ? 'px-0' : 'px-2 md:px-3',
            )}
          >
            {!validActiveAgentId ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-border/70 text-muted-foreground/40">
                  <Bot className="h-7 w-7" />
                </span>
                <span className="text-xs text-muted-foreground/60">你好，世界</span>
              </div>
            ) : (
              <>
                {showReadonlyTopTabs ? (
                  <div
                    data-testid="agent-modal-drag-handle"
                    className="flex shrink-0 cursor-grab items-center border-b border-border/60 px-6 pt-3 select-none touch-none active:cursor-grabbing"
                    onPointerDown={(e) => onPointerDown(e, 'drag')}
                  >
                    <div
                      className="flex min-w-0 flex-1 items-center gap-6"
                      data-testid="agent-modal-readonly-tabs"
                    >
                      {readonlyTabs.map((tab) => {
                        const isActive = activeTab === tab.id
                        const label = getReadonlyTabLabel(tab.id)
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            aria-label={label}
                            title={label}
                            data-testid={`agent-modal-readonly-tab-${tab.id}`}
                            type="button"
                            data-active={isActive ? 'true' : 'false'}
                            onPointerDown={(event) => event.stopPropagation()}
                            className={cn(
                              'relative -mb-px border-b-2 px-0 pb-3 text-sm transition-colors',
                              isActive
                                ? 'border-primary font-medium text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      aria-label="关闭弹窗"
                      title="关闭弹窗"
                      data-testid="agent-modal-close-button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={handleModalClose}
                      className="mb-2 ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                {activeTab === 'intro' && (
                  <div className="flex-1 overflow-y-auto">
                    <TabIntro
                      agentId={validActiveAgentId}
                      onRequestDelete={() => setDeleteConfirmOpen(true)}
                    />
                  </div>
                )}
                {activeTab === 'chat' && (
                  <div className="flex-1 overflow-hidden">
                    <Suspense fallback={<ModalPanelFallback />}>
                      <LazyTabChat
                        agentId={validActiveAgentId}
                        onCaptureScreenshot={handleCaptureScreenshot}
                        captureErrorMessage={screenshotErrorMessage}
                      />
                    </Suspense>
                  </div>
                )}
                {activeTab === 'moments' && (
                  <div className="flex-1 overflow-y-auto">
                    <Suspense fallback={<ModalPanelFallback scrollable />}>
                      <LazyTabMoments agentId={validActiveAgentId} />
                    </Suspense>
                  </div>
                )}
                {activeTab === 'history' && (
                  <div className="flex-1 overflow-y-auto">
                    <Suspense fallback={<ModalPanelFallback scrollable />}>
                      <LazyTabHistory agentId={validActiveAgentId} />
                    </Suspense>
                  </div>
                )}
                {activeTab === 'social' && (
                  <div className="flex-1 overflow-hidden">
                    <Suspense fallback={<ModalPanelFallback />}>
                      <LazyTabSocial agentId={validActiveAgentId} />
                    </Suspense>
                  </div>
                )}
                <div
                  data-testid="agent-delete-confirm-panel"
                  className={cn(
                    'absolute inset-0 z-20 flex justify-end bg-background/16 backdrop-blur-[1px] transition-opacity duration-200',
                    deleteConfirmOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                  )}
                  onClick={closeDeleteConfirmPanel}
                >
                  {deleteConfirmOpen ? (
                    <div
                      className="flex h-full w-full max-w-xl translate-x-0 flex-col border-l bg-background shadow-2xl transition-transform duration-200"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3">
                        <div className="min-w-0 space-y-1">
                          <div className="text-base font-semibold text-foreground">删除智能体</div>
                          <p className="text-xs leading-5 text-muted-foreground">
                            这是不可逆的生命周期操作。确认前，请先看清它会影响哪些能力。
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="关闭删除确认"
                          title="关闭删除确认"
                          onClick={closeDeleteConfirmPanel}
                          className="h-8 w-8 shrink-0 rounded-lg"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] p-3">
                          <p className="text-sm font-medium text-foreground">
                            你将要删除“{activeAgent?.display_name ?? ''}”。
                          </p>
                          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                            <li>历史公开帖子仍会保留，作为已离场角色的公开痕迹继续存在。</li>
                            <li>该智能体不再开放关注、私聊或进一步互动。</li>
                            <li>已有关注关系会被清空，进行中的私聊会话也会结束。</li>
                          </ul>
                        </div>
                        <div className="space-y-3">
                          <label htmlFor="agent-delete-confirm" className="block text-sm font-medium text-foreground">
                            输入智能体名称以确认
                          </label>
                          <Input
                            id="agent-delete-confirm"
                            value={deleteConfirmValue}
                            onChange={(event) => setDeleteConfirmValue(event.target.value)}
                            placeholder={activeAgent?.display_name ?? ''}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                          />
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            请输入 <span className="font-medium text-foreground">{activeAgent?.display_name ?? ''}</span> 后才可继续。
                          </p>
                          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-between">
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={deleteAgentMutation.isPending}
                              className="text-muted-foreground hover:text-foreground"
                              onClick={closeDeleteConfirmPanel}
                            >
                              取消
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/8 hover:text-destructive"
                              disabled={
                                !validActiveAgentId
                                || deleteAgentMutation.isPending
                                || !deleteConfirmMatches
                              }
                              onClick={() => {
                                if (!validActiveAgentId) return
                                deleteAgentMutation.mutate(undefined, {
                                  onSuccess: () => {
                                    closeDeleteConfirmPanel()
                                    closeModal()
                                  },
                                })
                              }}
                            >
                              {deleteAgentMutation.isPending ? '删除中…' : '确认删除智能体'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
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
          className={cn(
            'absolute bottom-0 right-5 h-3 cursor-s-resize z-10 touch-none',
            showIconRail ? 'left-12' : 'left-0',
          )}
          onPointerDown={(e) => onPointerDown(e, 'resize-s')}
        />
      </DialogContent>
    </Dialog>
    {geometryMenuOpen && geometryMenuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={geometryMenuRef}
            id="agent-modal-geometry-menu"
            role="menu"
            aria-labelledby="agent-modal-geometry-trigger"
            data-testid="agent-modal-geometry-menu"
            className="pointer-events-auto fixed z-[90] min-w-[8rem] -translate-x-full overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{
              top: geometryMenuPosition.top,
              left: geometryMenuPosition.left,
            }}
            onKeyDown={(event) => {
              const items = Array.from(
                geometryMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
              )
              const currentIndex = items.findIndex((item) => item === document.activeElement)

              if (event.key === 'ArrowDown') {
                event.preventDefault()
                items[(currentIndex + 1 + items.length) % items.length]?.focus()
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                items[(currentIndex - 1 + items.length) % items.length]?.focus()
              } else if (event.key === 'Home') {
                event.preventDefault()
                items[0]?.focus()
              } else if (event.key === 'End') {
                event.preventDefault()
                items[items.length - 1]?.focus()
              }
            }}
          >
            <button
              ref={geometryCenterButtonRef}
              type="button"
              role="menuitem"
              data-testid="agent-modal-center-button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                centerCurrent()
                closeGeometryMenu(true)
              }}
            >
              <LocateFixed className="h-4 w-4 text-muted-foreground" />
              视觉居中
            </button>
            <button
              type="button"
              role="menuitem"
              data-testid="agent-modal-restore-button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                restoreDefaultSize()
                closeGeometryMenu(true)
              }}
            >
              <Square className="h-4 w-4 text-muted-foreground" />
              恢复默认尺寸
            </button>
          </div>,
          document.body,
        )
      : null}
    {screenshotDraft ? (
      <Suspense fallback={null}>
        <LazyScreenshotCropper
          draft={screenshotDraft}
          open={Boolean(screenshotDraft)}
          onCancel={() => resolveScreenshotDraft(null)}
          onConfirm={(file) => resolveScreenshotDraft(file)}
        />
      </Suspense>
    ) : null}
    </>
  )
}
