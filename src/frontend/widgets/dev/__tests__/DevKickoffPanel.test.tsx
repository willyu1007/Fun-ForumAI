import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DevKickoffPanel } from '../DevKickoffPanel'

describe('DevKickoffPanel', () => {
  it('renders a safe fallback when the optional kickoff-local module is unavailable', () => {
    render(<DevKickoffPanel open onOpenChange={() => {}} />)

    expect(screen.getByText('Kickoff 调试')).toBeTruthy()
    expect(
      screen.getByText('当前构建未包含本地 `kickoff-local` 调试模块，已自动降级为安全兜底面板。'),
    ).toBeTruthy()
  })
})
