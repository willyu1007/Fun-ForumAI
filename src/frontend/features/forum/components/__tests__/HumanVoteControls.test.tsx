import type { ReactElement, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HumanVoteControls } from '../HumanVoteControls'

const mutateAsyncMock = vi.fn()
let isAuthenticated = true

vi.mock('@/api/hooks', () => ({
  useHumanVote: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}))

vi.mock('@/components/ui/tooltip', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  const TooltipContext = React.createContext<{
    open: boolean
    setOpen: (next: boolean) => void
  } | null>(null)

  return {
    TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Tooltip: ({ children }: { children: ReactNode }) => {
      const [open, setOpen] = React.useState(false)
      const value = React.useMemo(() => ({ open, setOpen }), [open])
      return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>
    },
    TooltipTrigger: ({
      children,
      asChild: _asChild,
    }: {
      children: ReactElement<{ onPointerEnter?: () => void; onPointerLeave?: () => void }>
      asChild?: boolean
    }) => {
      const context = React.useContext(TooltipContext)
      return React.cloneElement(children, {
        onPointerEnter: () => context?.setOpen(true),
        onPointerLeave: () => context?.setOpen(false),
      })
    },
    TooltipContent: ({ children }: { children: ReactNode }) => {
      const context = React.useContext(TooltipContext)
      return context?.open ? <div>{children}</div> : null
    },
  }
})

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated,
  }),
}))

describe('HumanVoteControls', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset()
    isAuthenticated = true
  })

  it('updates the visible score after an upvote succeeds', async () => {
    mutateAsyncMock.mockResolvedValueOnce({
      data: {
        vote: {
          id: 'vote-1',
          direction: 'UP',
          target_type: 'POST',
          target_id: 'post-1',
        },
        summary: {
          agent_up: 0,
          agent_down: 0,
          agent_score: 0,
          human_up: 3,
          human_down: 1,
          human_score: 2,
          weighted_score: 2,
        },
      },
    })

    render(
      <HumanVoteControls
        targetType="POST"
        targetId="post-1"
        humanUp={2}
        humanDown={1}
        initialDirection={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '赞同' }))

    expect(await screen.findByText('2')).toBeTruthy()
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
    })
  })

  it('keeps the normal vote layout for logged-out users without rendering a login pill', () => {
    isAuthenticated = false

    render(
      <HumanVoteControls
        targetType="POST"
        targetId="post-1"
        humanUp={2}
        humanDown={1}
        initialDirection={null}
      />,
    )

    expect(screen.queryByText('登录投票')).toBeNull()
    expect(screen.getByRole('group', { name: '人类投票' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '赞同' }))

    expect(mutateAsyncMock).not.toHaveBeenCalled()
  })

  it('shows a login tooltip when hovering the logged-out vote controls', () => {
    isAuthenticated = false

    render(
      <HumanVoteControls
        targetType="POST"
        targetId="post-1"
        humanUp={2}
        humanDown={1}
        initialDirection={null}
      />,
    )

    fireEvent.pointerEnter(screen.getByRole('group', { name: '人类投票' }))

    expect(screen.getByText('投票请登录')).toBeTruthy()
  })
})
