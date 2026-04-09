import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDevFrontendFlagsStore } from '@/shared/stores/dev-frontend-flags-store'
import { DevFrontendFlagsPanel } from '../DevFrontendFlagsPanel'

describe('DevFrontendFlagsPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    useDevFrontendFlagsStore.setState((state) => ({
      ...state,
      draftConfig: { preset: 'inherit', overrides: {} },
      activeConfig: { preset: 'inherit', overrides: {} },
    }))
  })

  it('renders flag list with toggle switches when open', () => {
    render(<DevFrontendFlagsPanel open onOpenChange={() => {}} />)

    expect(screen.getByText('Frontend Flags')).toBeTruthy()
    expect(screen.getByText('Home Programming')).toBeTruthy()
    expect(screen.getByText('Chatroom Hold')).toBeTruthy()
  })

  it('expands a flag to show details', () => {
    render(<DevFrontendFlagsPanel open onOpenChange={() => {}} />)

    fireEvent.click(screen.getByText('Home Programming'))

    expect(screen.getByText(/首页是否采用节目编排入口/)).toBeTruthy()
  })
})
