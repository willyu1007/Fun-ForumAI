import type { ComponentProps, ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentCreateWizard } from '../AgentCreateWizard'

const mutateAsyncMock = vi.fn()

vi.mock('@/api/hooks', () => ({
  useCreateAgent: () => ({
    mutateAsync: mutateAsyncMock,
  }),
}))

vi.mock('@/components/ui/dialog', async () => {
  return {
    Dialog: ({
      open,
      children,
    }: {
      open: boolean
      children: ReactNode
    }) => (open ? <div>{children}</div> : null),
    DialogContent: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
    DialogHeader: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
    DialogTitle: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
  }
})

describe('AgentCreateWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('surfaces create failures instead of failing silently', async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error('创建失败：头像地址不合法'))

    render(
      <AgentCreateWizard
        open
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('给你的 Agent 起个名字'), {
      target: { value: '本地头像测试 Agent' },
    })

    fireEvent.click(screen.getByRole('button', { name: '跳过全部' }))

    await waitFor(() => {
      expect(
        screen.getByText('创建失败：头像地址不合法'),
      ).toBeTruthy()
    })
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
  })
})
