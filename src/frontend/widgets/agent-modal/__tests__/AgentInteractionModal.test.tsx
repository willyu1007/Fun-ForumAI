import { useState, type ComponentProps, type ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { AgentInteractionModal } from '../AgentInteractionModal'

const renderCounts = vi.hoisted(() => ({
  intro: 0,
  chat: 0,
  moments: 0,
  history: 0,
  social: 0,
}))

const useAgentProfileMock = vi.fn()
const useMyAgentsMock = vi.fn()
const useAuthMock = vi.fn()
const captureDisplayFrameMock = vi.fn()

vi.mock('@/api/hooks', () => ({
  useAgentProfile: (agentId: string) => useAgentProfileMock(agentId),
}))

vi.mock('@/api/hooks/user', () => ({
  useMyAgents: (enabled: boolean) => useMyAgentsMock(enabled),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/features/private-chat/lib/capture-display-frame', () => ({
  captureDisplayFrame: () => captureDisplayFrameMock(),
  preloadCaptureDisplayFrame: vi.fn(),
}))

vi.mock('@/components/ui/dialog', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  return {
    Dialog: ({
      open,
      modal = true,
      children,
    }: {
      open: boolean
      modal?: boolean
      children: ReactNode
    }) => (open ? <div key={String(modal)} data-dialog-modal={modal ? 'true' : 'false'}>{children}</div> : null),
    DialogContent: React.forwardRef<
      HTMLDivElement,
      ComponentProps<'div'> & {
        showCloseButton?: boolean
        hideOverlay?: boolean
        onInteractOutside?: (event: Event) => void
        onPointerDownOutside?: (event: Event) => void
        onEscapeKeyDown?: (event: Event) => void
      }
    >(({
      children,
      showCloseButton: _showCloseButton,
      hideOverlay: _hideOverlay,
      onInteractOutside,
      onPointerDownOutside,
      onEscapeKeyDown: _onEscapeKeyDown,
      ...props
    }, ref) => (
      <div
        ref={ref}
        data-has-interact-outside-handler={onInteractOutside ? 'true' : undefined}
        data-has-pointer-down-outside-handler={onPointerDownOutside ? 'true' : undefined}
        {...props}
      >
        {children}
      </div>
    )),
    DialogTitle: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
    DialogDescription: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
  }
})

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    ...props
  }: ComponentProps<'button'>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('../AgentListSidebar', () => ({
  AgentListSidebar: () => <div data-testid="agent-list-sidebar" />,
}))

vi.mock('@/widgets/shell/LeftRailAgentDisplayEditor', () => ({
  LeftRailAgentDisplayEditor: () => <div data-testid="left-rail-agent-display-editor" />,
}))

vi.mock('@/features/agents/components/AgentCreateWizard', () => ({
  AgentCreateWizard: ({ open }: { open: boolean }) => (
    <div data-testid="agent-create-wizard" data-open={open ? 'true' : 'false'} />
  ),
}))

vi.mock('@/features/agents/components/modal/TabIntro', () => ({
  TabIntro: ({ agentId }: { agentId: string }) => {
    renderCounts.intro += 1
    return <div data-testid="tab-intro">intro:{agentId}</div>
  },
}))

vi.mock('@/features/agents/components/modal/TabChat', () => ({
  TabChat: ({
    agentId,
    onCaptureScreenshot,
  }: {
    agentId: string
    onCaptureScreenshot?: () => Promise<File | null>
  }) => {
    renderCounts.chat += 1
    const [captureResult, setCaptureResult] = useState<string | null>(null)
    return (
      <div data-testid="tab-chat">
        chat:{agentId}
        {captureResult ? <div data-testid="tab-chat-capture-result">{captureResult}</div> : null}
        {onCaptureScreenshot ? (
          <button
            type="button"
            data-testid="tab-chat-capture-trigger"
            onClick={() => {
              void onCaptureScreenshot().then((file) => {
                setCaptureResult(file?.name ?? null)
              })
            }}
          >
            capture
          </button>
        ) : null}
      </div>
    )
  },
}))

vi.mock('@/features/private-chat/components/ScreenshotCropper', () => ({
  ScreenshotCropper: ({
    open,
    onCancel,
    onConfirm,
  }: {
    open: boolean
    onCancel: () => void
    onConfirm: (file: File) => void
  }) =>
    open ? (
      <div data-testid="screenshot-cropper" data-open="true">
        <button type="button" data-testid="screenshot-cropper-cancel" onClick={onCancel}>
          cancel
        </button>
        <button
          type="button"
          data-testid="screenshot-cropper-confirm"
          onClick={() => onConfirm(new File(['ok'], 'capture.png', { type: 'image/png' }))}
        >
          confirm
        </button>
      </div>
    ) : null,
}))

vi.mock('@/features/agents/components/modal/TabMoments', () => ({
  TabMoments: ({ agentId }: { agentId: string }) => {
    renderCounts.moments += 1
    return <div>moments:{agentId}</div>
  },
}))

vi.mock('@/features/agents/components/modal/TabHistory', () => ({
  TabHistory: ({ agentId }: { agentId: string }) => {
    renderCounts.history += 1
    return <div>history:{agentId}</div>
  },
}))

vi.mock('@/features/agents/components/modal/TabSocial', () => ({
  TabSocial: ({ agentId }: { agentId: string }) => {
    renderCounts.social += 1
    return <div>social:{agentId}</div>
  },
}))

describe('AgentInteractionModal geometry updates', () => {
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    renderCounts.intro = 0
    renderCounts.chat = 0
    renderCounts.moments = 0
    renderCounts.history = 0
    renderCounts.social = 0
    useAgentProfileMock.mockImplementation((agentId: string) => ({
      data: {
        data: {
          id: agentId,
          display_name: agentId === 'agent-1' ? '合规助手' : '智能体',
        },
      },
    }))
    useMyAgentsMock.mockImplementation(() => ({
      data: {
        data: [
          { id: 'agent-1' },
          { id: 'agent-2' },
        ],
      },
    }))
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        displayName: '测试用户',
        avatarUrl: null,
        email: 'test@example.com',
        phone: null,
        birthDate: null,
        planTier: 'FREE',
        role: 'user',
      },
      isLoading: false,
    })
    captureDisplayFrameMock.mockResolvedValue({
      dataUrl: 'data:image/png;base64,stub',
      width: 640,
      height: 360,
      mimeType: 'image/png',
      fileName: 'capture.png',
    })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
    ;(HTMLElement.prototype as { setPointerCapture?: (pointerId: number) => void }).setPointerCapture = vi.fn()
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }) as typeof requestAnimationFrame)
  })

  afterEach(() => {
    act(() => {
      useAgentModalStore.setState({
        isOpen: false,
        isCaptureHidden: false,
        activeAgentId: null,
        viewMode: 'readonly',
        activeTab: 'intro',
        introSection: null,
        sourceSessionId: null,
        lastModalRect: null,
      })
    })
    window.localStorage.removeItem('agent-modal-state')
    vi.unstubAllGlobals()
  })

  function renderOpenModal() {
    act(() => {
      useAgentModalStore.setState({
        isOpen: true,
        isCaptureHidden: false,
        activeAgentId: 'agent-1',
        viewMode: 'manage',
        activeTab: 'intro',
        introSection: null,
        sourceSessionId: null,
        lastModalRect: null,
      })
    })

    return render(<AgentInteractionModal />)
  }

  function reopenModal() {
    act(() => {
      useAgentModalStore.setState({
        isOpen: true,
        isCaptureHidden: false,
      })
    })
  }

  it('updates modal position while keeping the active tab render stable during drag', () => {
    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')
    const dragHandle = screen.getByTestId('agent-modal-drag-handle')
    const initialTransform = modal.style.transform
    const initialIntroRenders = renderCounts.intro

    act(() => {
      fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 120, clientY: 80 })
    })

    act(() => {
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 220, clientY: 180 })
    })

    expect(modal.style.transform).not.toBe(initialTransform)
    expect(renderCounts.intro).toBe(initialIntroRenders)

    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1 })
    })

    expect(renderCounts.intro).toBeGreaterThan(initialIntroRenders)
  })

  it('renders with an explicit initial geometry instead of falling back to full-width dialog defaults', () => {
    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')

    expect(modal.style.transform).toMatch(/^translate3d\(\d+px, \d+px, 0\)$/)
    expect(modal.style.width).toMatch(/px$/)
    expect(modal.style.height).toMatch(/px$/)
  })

  it('applies the manage-mode minimum width within the viewport budget on first render', () => {
    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')

    expect(modal.style.width).toBe('832px')
  })

  it('restores the modal to the default size without changing its anchored position', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })

    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')
    const resizeHandle = screen.getByTestId('agent-modal-resize-se-handle')
    const dragHandle = screen.getByTestId('agent-modal-drag-handle')

    act(() => {
      fireEvent.pointerDown(resizeHandle, { pointerId: 1, clientX: 400, clientY: 320 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 520, clientY: 430 })
      fireEvent.pointerUp(window, { pointerId: 1 })
    })

    act(() => {
      fireEvent.pointerDown(dragHandle, { pointerId: 2, clientX: 320, clientY: 160 })
      fireEvent.pointerMove(window, { pointerId: 2, clientX: 420, clientY: 160 })
      fireEvent.pointerUp(window, { pointerId: 2 })
    })

    act(() => {
      fireEvent.click(screen.getByTestId('agent-modal-restore-button'))
    })

    expect(modal.style.transform).toBe('translate3d(380px, 28px, 0)')
    expect(modal.style.width).toBe('1040px')
    expect(modal.style.height).toBe('850px')
  })

  it('recenters the current modal size from the title-bar shortcut without changing dimensions', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })

    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')
    const leftHandle = screen.getByTestId('agent-modal-resize-w-handle')

    act(() => {
      fireEvent.pointerDown(leftHandle, { pointerId: 1, clientX: 280, clientY: 220 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 480, clientY: 220 })
      fireEvent.pointerUp(window, { pointerId: 1 })
    })

    act(() => {
      fireEvent.click(screen.getByTestId('agent-modal-center-button'))
    })

    expect(modal.style.transform).toBe('translate3d(380px, 75px, 0)')
    expect(modal.style.width).toBe('840px')
    expect(modal.style.height).toBe('850px')
  })

  it('keeps the restored default size inside the viewport when the window was shrunk near the right edge', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })

    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')
    const eastHandle = screen.getByTestId('agent-modal-resize-e-handle')
    const dragHandle = screen.getByTestId('agent-modal-drag-handle')

    act(() => {
      fireEvent.pointerDown(eastHandle, { pointerId: 1, clientX: 1320, clientY: 220 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 1112, clientY: 220 })
      fireEvent.pointerUp(window, { pointerId: 1 })
    })

    act(() => {
      fireEvent.pointerDown(dragHandle, { pointerId: 2, clientX: 500, clientY: 140 })
      fireEvent.pointerMove(window, { pointerId: 2, clientX: 1000, clientY: 140 })
      fireEvent.pointerUp(window, { pointerId: 2 })
    })

    act(() => {
      fireEvent.click(screen.getByTestId('agent-modal-restore-button'))
    })

    expect(modal.style.transform).toBe('translate3d(548px, 75px, 0)')
    expect(modal.style.width).toBe('1040px')
    expect(modal.style.height).toBe('850px')
  })

  it('closes the modal from the title-bar shortcut', () => {
    renderOpenModal()

    act(() => {
      fireEvent.click(screen.getByTestId('agent-modal-close-button'))
    })

    expect(screen.queryByTestId('agent-modal-content')).toBeNull()
  })

  it('keeps the modal mounted but visually hidden during capture mode', () => {
    renderOpenModal()

    act(() => {
      useAgentModalStore.getState().hideForCapture()
    })

    const modal = screen.getByTestId('agent-modal-content')
    expect(modal.className).toContain('pointer-events-none')
    expect(modal.className).toContain('invisible')
  })

  it('keeps the modal hidden while the screenshot cropper is open and restores it after cancel', async () => {
    renderOpenModal()

    act(() => {
      useAgentModalStore.setState({ activeTab: 'chat' })
    })

    const modal = screen.getByTestId('agent-modal-content')

    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-chat-capture-trigger'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('screenshot-cropper').getAttribute('data-open')).toBe('true')
    expect(modal.className).toContain('invisible')

    await act(async () => {
      fireEvent.click(screen.getByTestId('screenshot-cropper-cancel'))
      await Promise.resolve()
    })

    expect(screen.queryByTestId('screenshot-cropper')).toBeNull()
    expect(modal.className).not.toContain('invisible')
  })

  it('blocks dialog outside-dismiss handlers while the screenshot cropper is active', async () => {
    renderOpenModal()

    act(() => {
      useAgentModalStore.setState({ activeTab: 'chat' })
    })

    const modal = screen.getByTestId('agent-modal-content')
    expect(modal.getAttribute('data-has-interact-outside-handler')).toBeNull()
    expect(modal.getAttribute('data-has-pointer-down-outside-handler')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-chat-capture-trigger'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('screenshot-cropper').getAttribute('data-open')).toBe('true')
    expect(modal.getAttribute('data-has-interact-outside-handler')).toBe('true')
    expect(modal.getAttribute('data-has-pointer-down-outside-handler')).toBe('true')
  })

  it('keeps the chat subtree mounted long enough for screenshot confirm to resolve back into the composer flow', async () => {
    renderOpenModal()

    act(() => {
      useAgentModalStore.setState({ activeTab: 'chat' })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-chat-capture-trigger'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('screenshot-cropper').getAttribute('data-open')).toBe('true')

    await act(async () => {
      fireEvent.click(screen.getByTestId('screenshot-cropper-confirm'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByTestId('screenshot-cropper')).toBeNull()
    expect(screen.getByTestId('tab-chat-capture-result').textContent).toBe('capture.png')
  })

  it('keeps the close signal at the far right of the title-bar controls', () => {
    renderOpenModal()

    const moreButton = screen.getByTestId('agent-modal-more-button')
    const centerButton = screen.getByTestId('agent-modal-center-button')
    const restoreButton = screen.getByTestId('agent-modal-restore-button')
    const closeButton = screen.getByTestId('agent-modal-close-button')
    const controls = closeButton.parentElement

    expect(controls?.firstElementChild).toBe(moreButton)
    expect(controls?.lastElementChild).toBe(closeButton)
    expect(centerButton.parentElement).not.toBe(controls)
    expect(restoreButton.parentElement).toBe(centerButton.parentElement)
    expect(centerButton.nextElementSibling).toBe(restoreButton)
  })

  it('resets the create wizard when the parent modal closes and reopens', () => {
    renderOpenModal()

    expect(screen.getByTestId('agent-create-wizard').getAttribute('data-open')).toBe('false')

    act(() => {
      fireEvent.click(screen.getByTestId('agent-modal-create-button'))
    })

    expect(screen.getByTestId('agent-create-wizard').getAttribute('data-open')).toBe('true')

    act(() => {
      fireEvent.click(screen.getByTestId('agent-modal-close-button'))
    })

    reopenModal()

    expect(screen.getByTestId('agent-create-wizard').getAttribute('data-open')).toBe('false')
  })

  it('allows resizing down to the reduced minimum height', () => {
    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')
    const resizeHandle = screen.getByTestId('agent-modal-resize-s-handle')

    act(() => {
      fireEvent.pointerDown(resizeHandle, { pointerId: 1, clientX: 640, clientY: 640 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 640, clientY: -1000 })
      fireEvent.pointerUp(window, { pointerId: 1 })
    })

    expect(modal.style.height).toBe('510px')
  })

  it('updates modal size while keeping the active tab render stable during resize', () => {
    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')
    const resizeHandle = screen.getByTestId('agent-modal-resize-se-handle')
    const initialHeight = modal.style.height
    const initialIntroRenders = renderCounts.intro

    act(() => {
      fireEvent.pointerDown(resizeHandle, { pointerId: 1, clientX: 400, clientY: 320 })
    })

    act(() => {
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 520, clientY: 430 })
    })

    expect(modal.style.height).not.toBe(initialHeight)
    expect(renderCounts.intro).toBe(initialIntroRenders)

    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1 })
    })

    expect(renderCounts.intro).toBeGreaterThan(initialIntroRenders)
  })

  it('supports resizing from the left edge while keeping the right edge anchored', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })

    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')
    const leftHandle = screen.getByTestId('agent-modal-resize-w-handle')
    const initialTransform = modal.style.transform
    const initialWidth = modal.style.width
    const initialIntroRenders = renderCounts.intro

    act(() => {
      fireEvent.pointerDown(leftHandle, { pointerId: 1, clientX: 280, clientY: 220 })
    })

    act(() => {
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 200, clientY: 220 })
    })

    expect(modal.style.transform).not.toBe(initialTransform)
    expect(modal.style.width).not.toBe(initialWidth)
    expect(renderCounts.intro).toBe(initialIntroRenders)

    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1 })
    })

    expect(renderCounts.intro).toBeGreaterThan(initialIntroRenders)
  })

  it('keeps the modal inside the viewport and restores global interaction styles after drag', () => {
    renderOpenModal()

    const modal = screen.getByTestId('agent-modal-content')
    const dragHandle = screen.getByTestId('agent-modal-drag-handle')

    act(() => {
      fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 300, clientY: 220 })
    })

    expect(document.body.style.cursor).toBe('grabbing')
    expect(document.body.style.userSelect).toBe('none')

    act(() => {
      fireEvent.pointerMove(window, { pointerId: 1, clientX: -1000, clientY: -1000 })
      fireEvent.pointerUp(window, { pointerId: 1 })
    })

    expect(modal.style.transform).toBe('translate3d(12px, 12px, 0)')
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })

  it('reopens to the previously active agent, tab, and modal rect when opened from the generic entry', () => {
    act(() => {
      useAgentModalStore.setState({
        isOpen: false,
        isCaptureHidden: false,
        activeAgentId: 'agent-1',
        viewMode: 'manage',
        activeTab: 'history',
        introSection: null,
        sourceSessionId: null,
        lastModalRect: {
          x: 120,
          y: 90,
          w: 920,
          h: 640,
        },
      })
    })

    act(() => {
      useAgentModalStore.getState().openModal(null, 'manage', 'chat')
    })

    render(<AgentInteractionModal />)

    expect(screen.getByText('history:agent-1')).toBeTruthy()
    expect(screen.getByTestId('agent-modal-content').style.transform).toBe('translate3d(92px, 90px, 0)')
    expect(screen.getByTestId('agent-modal-content').style.width).toBe('920px')
    expect(screen.getByTestId('agent-modal-content').style.height).toBe('640px')
  })

  it('renders readonly modal content for agents outside the owner workspace list', () => {
    useMyAgentsMock.mockImplementation(() => ({
      data: {
        data: [{ id: 'agent-owned' }],
      },
    }))
    useAgentProfileMock.mockImplementation((agentId: string) => ({
      data: {
        data: {
          id: agentId,
          display_name: '围观角色',
        },
      },
    }))

    act(() => {
      useAgentModalStore.setState({
        isOpen: true,
        isCaptureHidden: false,
        activeAgentId: 'agent-external',
        viewMode: 'readonly',
        activeTab: 'intro',
        introSection: null,
        sourceSessionId: null,
        lastModalRect: null,
      })
    })

    render(<AgentInteractionModal />)

    expect(screen.getByTestId('agent-modal-content')).toBeTruthy()
    expect(screen.getByTestId('tab-intro').textContent).toContain('agent-external')
  })

  it('renders an accessible dialog description', () => {
    act(() => {
      useAgentModalStore.setState({
        isOpen: true,
        activeAgentId: 'agent-1',
        viewMode: 'manage',
        activeTab: 'intro',
      })
    })

    render(<AgentInteractionModal />)

    expect(screen.getByText('查看或管理智能体资料、互动入口与相关设置。')).toBeTruthy()
  })
})
