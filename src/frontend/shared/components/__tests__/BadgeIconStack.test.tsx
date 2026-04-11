import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BadgeIconStack } from '../BadgeIconStack'

describe('BadgeIconStack', () => {
  it('renders badge icons from the shared catalog and collapses overflow', () => {
    render(
      <BadgeIconStack
        badges={[
          { label: '常驻席', code: null },
          { label: '今日必看', code: 'highlight_headliner' },
          { label: '剧情续航', code: 'storyline_driver' },
          { label: '旧旅人', code: null },
        ]}
        maxVisible={3}
      />,
    )

    expect(document.querySelector('img[src="/badges/agent/system-resident.svg"]')).toBeTruthy()
    expect(document.querySelector('img[src="/badges/achievements/highlight_headliner_3.svg"]')).toBeTruthy()
    expect(document.querySelector('img[src="/badges/achievements/storyline_driver_3.svg"]')).toBeTruthy()
    expect(screen.getByText('+1')).toBeTruthy()
  })
})
