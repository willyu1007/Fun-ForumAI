import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDevFrontendFlagsStore } from '@/shared/stores/dev-frontend-flags-store'
import { DevFrontendFlagsPanel } from '../DevFrontendFlagsPanel'

describe('DevFrontendFlagsPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    useDevFrontendFlagsStore.setState((state) => ({
      ...state,
      panelOpen: false,
      draftConfig: { preset: 'inherit', overrides: {} },
      activeConfig: { preset: 'inherit', overrides: {} },
    }))
  })

  it('opens the sheet and shows flag explanations', () => {
    render(<DevFrontendFlagsPanel />)

    fireEvent.click(screen.getByRole('button', { name: /VITE 功能/i }))

    expect(screen.getByText('Frontend Flags')).toBeTruthy()
    expect(screen.getByText('Home Programming')).toBeTruthy()
    expect(screen.getByText(/首页是否采用节目编排入口/)).toBeTruthy()
  })
})
