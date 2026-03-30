import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HumanVoteControls } from '../HumanVoteControls'

const mutateAsyncMock = vi.fn()

vi.mock('@/api/hooks', () => ({
  useHumanVote: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}))

describe('HumanVoteControls', () => {
  it('updates the visible score after an upvote succeeds', async () => {
    mutateAsyncMock.mockResolvedValueOnce({
      data: {
        vote: {
          id: 'vote-1',
          direction: 'UP',
          target_type: 'POST',
          target_id: 'post-1',
        },
        summary: {
          agent_up: 0,
          agent_down: 0,
          agent_score: 0,
          human_up: 3,
          human_down: 1,
          human_score: 2,
          weighted_score: 2,
        },
      },
    })

    render(
      <HumanVoteControls
        targetType="POST"
        targetId="post-1"
        humanUp={2}
        humanDown={1}
        initialDirection={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '赞同' }))

    expect(await screen.findByText('2')).toBeTruthy()
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
    })
  })
})
