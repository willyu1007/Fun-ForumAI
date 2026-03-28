import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IdentityReviewCard } from '../IdentityReviewCard'

describe('IdentityReviewCard', () => {
  it('renders only the latest identity review status per user', () => {
    render(
      <IdentityReviewCard
        review={{
          identityReviews: {
            data: [
              {
                id: 'review-2',
                user_id: 'dev-user-001',
                status: 'VERIFIED',
                method: 'MANUAL_REVIEW',
                reviewed_by_user_id: 'dev-admin-001',
                reason: 'verified',
                submitted_at: '2026-03-28T00:29:29.947Z',
                reviewed_at: '2026-03-28T00:29:29.947Z',
                expires_at: null,
                meta: null,
              },
              {
                id: 'review-1',
                user_id: 'dev-user-001',
                status: 'PENDING',
                method: 'MANUAL_REVIEW',
                reviewed_by_user_id: 'dev-admin-001',
                reason: 'pending',
                submitted_at: '2026-03-28T00:28:57.435Z',
                reviewed_at: '2026-03-28T00:28:57.435Z',
                expires_at: null,
                meta: null,
              },
            ],
          },
          resolveIdentity: {
            mutate: vi.fn(),
            isPending: false,
          },
        } as never}
      />,
    )

    expect(screen.getByText('dev-user-001')).toBeTruthy()
    expect(screen.getByText('VERIFIED')).toBeTruthy()
    expect(screen.queryByText('PENDING')).toBeNull()
  })
})
