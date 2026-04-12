import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DevFrontendFlagsPanel } from '../DevFrontendFlagsPanel'

describe('DevFrontendFlagsPanel', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('renders the read-only flag list and debug commands when open', () => {
    render(<DevFrontendFlagsPanel open onOpenChange={() => {}} />)

    expect(screen.getByText('Frontend Flags')).toBeTruthy()
    expect(screen.getByText('Home Programming')).toBeTruthy()
    expect(screen.getByText('Chatroom Hold')).toBeTruthy()
    expect(
      screen.getByText((_, element) => element?.textContent === 'Chatroom Hold：聊天室功能'),
    ).toBeTruthy()
    expect(screen.queryByText('调试指令')).toBeNull()
  })

  it('expands a flag to show details', () => {
    render(<DevFrontendFlagsPanel open onOpenChange={() => {}} />)

    fireEvent.click(screen.getByText('Chatroom Hold'))

    expect(screen.getByText(/聊天室 staging 占位页/)).toBeTruthy()
    expect(screen.getByText(/来源:/)).toBeTruthy()
    expect(screen.getByText('调试方式')).toBeTruthy()
    expect(screen.getByText('pnpm dev:chatroom:hold')).toBeTruthy()
  })
})
