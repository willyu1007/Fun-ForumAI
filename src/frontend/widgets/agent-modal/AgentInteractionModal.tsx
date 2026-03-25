import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAgentModalStore, type AgentModalTab } from '@/shared/stores/agent-modal-store'
import { User, MessageSquare, History, Users, Activity, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentListSidebar } from './AgentListSidebar'
import { TabIntro } from '@/features/agents/components/modal/TabIntro'
import { TabChat } from '@/features/agents/components/modal/TabChat'
import { TabMoments } from '@/features/agents/components/modal/TabMoments'
import { TabHistory } from '@/features/agents/components/modal/TabHistory'
import { TabSocial } from '@/features/agents/components/modal/TabSocial'

const TABS: { id: AgentModalTab; icon: React.ElementType; label: string }[] = [
  { id: 'intro', icon: User, label: '介绍与管理' },
  { id: 'chat', icon: MessageSquare, label: '主聊天' },
  { id: 'moments', icon: Activity, label: '动态' },
  { id: 'history', icon: History, label: '成长编年史' },
  { id: 'social', icon: Users, label: '社会关系' },
]

const MIN_W = 520
const MIN_H = 360

type InteractMode = null | 'drag' | 'resize-se' | 'resize-e' | 'resize-s'

function centeredRect() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const w = Math.round(vw * 0.65)
  const h = Math.round(vh * 0.85)
  return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h }
}

function useModalGeometry(isOpen: boolean) {
  const initial = centeredRect()
  const [pos, setPos] = useState({ x: initial.x, y: initial.y })
  const [size, setSize] = useState({ w: initial.w, h: initial.h })
  const mode = useRef<InteractMode>(null)
  const origin = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 })
  const prevOpen = useRef(false)

  if (isOpen && !prevOpen.current) {
    const r = centeredRect()
    if (r.x !== pos.x || r.y !== pos.y || r.w !== size.w || r.h !== size.h) {
      setPos({ x: r.x, y: r.y })
      setSize({ w: r.w, h: r.h })
    }
  }
  prevOpen.current = isOpen

  const onPointerDown = useCallback((e: React.PointerEvent, m: InteractMode) => {
    if (!m) return
    e.preventDefault()
    mode.current = m
    origin.current = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y, w: size.w, h: size.h }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [pos, size])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const m = mode.current
    if (!m) return
    const dx = e.clientX - origin.current.mx
    const dy = e.clientY - origin.current.my
    if (m === 'drag') {
      setPos({ x: origin.current.x + dx, y: origin.current.y + dy })
    } else {
      const newW = m !== 'resize-s' ? Math.max(MIN_W, origin.current.w + dx) : size.w
      const newH = m !== 'resize-e' ? Math.max(MIN_H, origin.current.h + dy) : size.h
      setSize({ w: newW, h: newH })
    }
  }, [size.w, size.h])

  const onPointerUp = useCallback(() => { mode.current = null }, [])

  return { pos, size, onPointerDown, onPointerMove, onPointerUp }
}

export function AgentInteractionModal() {
  const { isOpen, closeModal, activeTab, setActiveTab, activeAgentId, viewMode } = useAgentModalStore()
  const { pos, size, onPointerDown, onPointerMove, onPointerUp } = useModalGeometry(isOpen)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) return
    element.style.setProperty('--agent-modal-top', `${pos.y}px`)
    element.style.setProperty('--agent-modal-left', `${pos.x}px`)
    element.style.setProperty('--agent-modal-width', `${size.w}px`)
    element.style.setProperty('--agent-modal-height', `${size.h}px`)
  }, [pos.x, pos.y, size.h, size.w])

  if (!activeAgentId && viewMode === 'readonly') {
    return null
  }

  const showSidebar = viewMode === 'manage'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        ref={contentRef}
        data-size="full"
        showCloseButton={false}
        className="top-[var(--agent-modal-top,10vh)] left-[var(--agent-modal-left,17.5vw)] h-[var(--agent-modal-height,85vh)] w-[var(--agent-modal-width,65vw)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-none flex flex-col"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <DialogTitle className="sr-only">Agent Interaction</DialogTitle>

        {/* Drag handle bar */}
        <div
          className="h-8 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing bg-muted/30 border-b select-none"
          onPointerDown={(e) => onPointerDown(e, 'drag')}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/50 rotate-90" />
        </div>

        {/* Body: icon rail + sidebar + content */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {/* Icon rail */}
          <nav className="w-12 shrink-0 border-r bg-muted/20 flex flex-col items-center py-3 gap-1">
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
                        'flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={6}>
                    {tab.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
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
                    <TabChat agentId={activeAgentId} />
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
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
          onPointerDown={(e) => onPointerDown(e, 'resize-se')}
        />
        <div
          className="absolute top-8 right-0 w-1.5 bottom-4 cursor-e-resize z-10"
          onPointerDown={(e) => onPointerDown(e, 'resize-e')}
        />
        <div
          className="absolute bottom-0 left-12 right-4 h-1.5 cursor-s-resize z-10"
          onPointerDown={(e) => onPointerDown(e, 'resize-s')}
        />
      </DialogContent>
    </Dialog>
  )
}
