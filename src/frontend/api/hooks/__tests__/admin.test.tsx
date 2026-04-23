import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useApplyCommunitySurfaceSettings, useRuntimeFeatures } from '../admin'
import { api } from '../../client'

vi.mock('../../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('admin hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a disabled runtime snapshot when the backend feature flag responds with 403', async () => {
    getMock.mockReturnValue({
      json: vi.fn(async () => {
        throw { response: { status: 403 } }
      }),
    } as never)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    const { result } = renderHook(() => useRuntimeFeatures(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.meta?.disabled).toBe(true)
    expect(result.current.data?.data.guidance).toMatchObject({
      flags: {
        guidance_v1: false,
        guidance_recall_v1: false,
      },
      bell: {
        unread_count: 0,
        active_count: 0,
      },
    })
  })

  it('writes topic and participation settings into real community rules paths', async () => {
    postMock
      .mockReturnValueOnce({
        json: vi.fn(async () => ({ data: { id: 'proposal-1' } })),
      } as never)
      .mockReturnValueOnce({
        json: vi.fn(async () => ({ data: { id: 'proposal-1', status: 'VALIDATED' } })),
      } as never)
      .mockReturnValueOnce({
        json: vi.fn(async () => ({ data: { id: 'proposal-1', status: 'APPROVED' } })),
      } as never)
      .mockReturnValueOnce({
        json: vi.fn(async () => ({ data: { patch_id: 'proposal-1' } })),
      } as never)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const { result } = renderHook(() => useApplyCommunitySurfaceSettings(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({
        communityId: 'community-1',
        bannerImageUrl: '/banner.webp',
        avatarImageUrl: '/avatar.webp',
        publicIntro: '公开说明',
        topicFamily: 'creator_relationship',
        interactionContract: {
          public_participation_mode: 'open_reply',
          audience_signal_ingestion: 'none',
          agent_human_response_mode: 'direct_reply',
        },
      })
    })

    expect(postMock).toHaveBeenCalledTimes(4)
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      'communities/community-1/config/proposals',
      expect.objectContaining({
        json: expect.objectContaining({
          patch: expect.objectContaining({
            launch_profile: {
              community_family: 'creator_relationship',
            },
            stage_spec_v1: {
              human_participation: {
                public_participation_mode: 'open_reply',
                audience_signal_ingestion: 'none',
                agent_human_response_mode: 'direct_reply',
              },
            },
            community_surface_v1: {
              banner_image_url: '/banner.webp',
              avatar_image_url: '/avatar.webp',
              public_intro: '公开说明',
            },
          }),
        }),
      }),
    )

    const firstPayload = postMock.mock.calls[0]?.[1]
    expect(firstPayload).not.toMatchObject({
      json: {
        patch: {
          community_surface_v1: expect.objectContaining({
            topic_family: expect.anything(),
            public_participation_mode: expect.anything(),
            audience_signal_ingestion: expect.anything(),
            agent_human_response_mode: expect.anything(),
          }),
        },
      },
    })
  })
})
