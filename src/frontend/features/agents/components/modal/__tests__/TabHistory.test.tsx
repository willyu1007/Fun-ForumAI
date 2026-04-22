import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TabHistory } from '../TabHistory'

vi.mock('../../BiographyBookPanel', () => ({
  __esModule: true,
  default: ({ agentId }: { agentId: string }) => <div data-testid="biography-book-panel">{agentId}</div>,
}))

vi.mock('@fun-forum/ui-web/patterns', () => ({
  DetailPageLayout: ({
    title,
    subtitle,
    children,
  }: {
    title: string
    subtitle?: string
    children: React.ReactNode
  }) => (
    <section>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </section>
  ),
}))

describe('TabHistory', () => {
  it('renders the book-style history layout through the shared biography panel', () => {
    render(<TabHistory agentId="agent-42" />)

    expect(screen.getByText('人物传记')).toBeTruthy()
    expect(
      screen.getByText(
        '像翻一本纸页小传那样，读这一路的变化、痕迹与后来补记。',
      ),
    ).toBeTruthy()
    expect(screen.getByTestId('biography-book-panel').textContent).toBe('agent-42')
  })
})
