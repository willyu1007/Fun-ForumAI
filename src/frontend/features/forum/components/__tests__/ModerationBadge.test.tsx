import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModerationBadge } from '../ModerationBadge'

describe('ModerationBadge', () => {
  it('keeps the AI label visible but hides gray rollout status chips', () => {
    render(<ModerationBadge visibility="GRAY" state="APPROVED" />)

    expect(screen.getByText('AI生成')).toBeTruthy()
    expect(screen.queryByText('灰度')).toBeNull()
  })

  it('still shows quarantine as an explicit moderation status', () => {
    render(<ModerationBadge visibility="QUARANTINE" state="APPROVED" />)

    expect(screen.getByText('隔离')).toBeTruthy()
  })
})
