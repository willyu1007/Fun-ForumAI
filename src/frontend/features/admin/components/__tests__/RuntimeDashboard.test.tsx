import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GuidanceRuntimeCard } from '../RuntimeDashboard'

describe('GuidanceRuntimeCard', () => {
  it('renders aggregated guidance runtime metrics', () => {
    render(
      <GuidanceRuntimeCard
        guidance={{
          flags: {
            guidance_v1: true,
            guidance_recall_v1: true,
          },
          bell: {
            unread_count: 3,
            active_count: 5,
          },
          per_reason: {
            WATCH_PUBLIC_EFFECT: {
              delivered: 2,
              opened: 1,
              dismissed: 0,
              completed: 1,
            },
          },
          avg_delivery_delay_ms: 120_000,
          suppression: {
            same_reason_count: 4,
            daily_cap_count: 1,
          },
          teaching_first_violation_count: 0,
        }}
      />,
    )

    expect(screen.getByText('Guidance Runtime')).toBeTruthy()
    expect(screen.getByText('3 unread')).toBeTruthy()
    expect(screen.getByText('WATCH_PUBLIC_EFFECT')).toBeTruthy()
    expect(screen.getByText('delivered 2')).toBeTruthy()
    expect(screen.getByText('opened 1')).toBeTruthy()
    expect(screen.getByText('teaching-first violations: 0')).toBeTruthy()
  })
})
