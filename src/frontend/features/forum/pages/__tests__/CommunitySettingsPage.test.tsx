import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunitySettingsPage } from '../CommunitySettingsPage'
import { useCommunityBySlug, useCommunityParticipationContract } from '@/api/hooks/forum'
import {
  useAdminCommunityCommonsAssets,
  useAdminCommunityMediaImportUpload,
  useAdminCommunityMediaImportUrl,
  useApplyCommunitySurfaceSettings,
} from '@/api/hooks/admin'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks/forum', () => ({
  useCommunityBySlug: vi.fn(),
  useCommunityParticipationContract: vi.fn(),
}))

vi.mock('@/api/hooks/admin', () => ({
  useApplyCommunitySurfaceSettings: vi.fn(),
  useAdminCommunityCommonsAssets: vi.fn(),
  useAdminCommunityMediaImportUpload: vi.fn(),
  useAdminCommunityMediaImportUrl: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/features/forum/components/CommunityHoverCard', () => ({
  CommunityHoverCardPanel: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
  CommunityHoverCardSurface: ({
    preview,
    headerAction,
    metaSection,
    descriptionSlot,
  }: {
    preview?: {
      name?: string
      description?: string | null
      community_semantics?: { community_family?: string | null } | null
    }
    headerAction?: React.ReactNode
    metaSection?: React.ReactNode
    descriptionSlot?: React.ReactNode
  }) => (
    <div>
      <div>{preview?.name}</div>
      <div>{preview?.community_semantics?.community_family ?? ''}</div>
      {headerAction}
      {descriptionSlot ?? <div>{preview?.description}</div>}
      {metaSection}
    </div>
  ),
}))

const useCommunityBySlugMock = vi.mocked(useCommunityBySlug)
const useCommunityParticipationContractMock = vi.mocked(useCommunityParticipationContract)
const useApplyCommunitySurfaceSettingsMock = vi.mocked(useApplyCommunitySurfaceSettings)
const useAdminCommunityCommonsAssetsMock = vi.mocked(useAdminCommunityCommonsAssets)
const useAdminCommunityMediaImportUploadMock = vi.mocked(useAdminCommunityMediaImportUpload)
const useAdminCommunityMediaImportUrlMock = vi.mocked(useAdminCommunityMediaImportUrl)
const useAuthMock = vi.mocked(useAuth)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/c/rust-lab/settings']}>
      <Routes>
        <Route path="/c/:slug/settings" element={<CommunitySettingsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CommunitySettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuthMock.mockReturnValue({
      currentIdentity: 'admin',
      isAuthenticated: true,
      user: { id: 'admin-1' },
    } as never)

    useCommunityBySlugMock.mockReturnValue({
      data: {
        id: 'community-1',
        name: 'Rust Lab',
        slug: 'rust-lab',
        description: '系统编程与编译器实践。',
        rules_json: {
          community_surface_v1: {
            public_intro: '公开说明',
            banner_image_url: '/banner.webp',
            avatar_image_url: '/avatar.webp',
          },
        },
        community_semantics: {
          community_family: 'values_debate',
          community_shell_category: 'theme',
          publication_review_profile_id: 'standard_publication',
          default_editorial_shelf_ids: ['all_communities'],
        },
        interaction_contract: {
          public_participation_mode: 'audience_sidecar',
          audience_signal_ingestion: 'summary_only',
          agent_human_response_mode: 'aftershow_only',
        },
      },
      isLoading: false,
    } as never)

    useCommunityParticipationContractMock.mockReturnValue({
      data: {
        data: {
          schema_version: 'v1',
          scope_type: 'COMMUNITY',
          scope_id: 'community-1',
          source: 'community_rules',
          public_participation_mode: 'open_reply',
          audience_signal_ingestion: 'direct_read',
          agent_human_response_mode: 'direct_reply',
          stage_open_reply: {
            schema_version: 'v1',
            enabled: true,
            new_thread_enabled: true,
            turn_reply_enabled: true,
            public_participation_mode: 'open_reply',
            agent_human_response_mode: 'direct_reply',
            explainability_scope: 'PUBLIC_SAFE_ONLY',
          },
          audience_lane: {
            schema_version: 'v1',
            enabled: true,
            posting_enabled: false,
            audience_signal_ingestion: 'direct_read',
            agent_human_response_mode: 'direct_reply',
            explainability_scope: 'PUBLIC_SAFE_ONLY',
          },
        },
      },
    } as never)

    useApplyCommunitySurfaceSettingsMock.mockReturnValue({
      isPending: false,
      isSuccess: false,
      isError: false,
      mutate: vi.fn(),
    } as never)

    useAdminCommunityCommonsAssetsMock.mockReturnValue({
      data: {
        data: {
          pool: { scene_type: 'media_pool', scene_id: 'community_commons:community-1', community_id: 'community-1' },
          items: [],
          next_cursor: null,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never)

    useAdminCommunityMediaImportUploadMock.mockReturnValue({
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      error: null,
      reset: vi.fn(),
    } as never)

    useAdminCommunityMediaImportUrlMock.mockReturnValue({
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      error: null,
      reset: vi.fn(),
    } as never)
  })

  it('shows a custom participation mode state instead of a blank select when the real contract is not a preset', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '编辑' }))

    expect(screen.getByText('当前为自定义模式')).toBeTruthy()
    expect(screen.getByText('当前模式来自已存在的社区规则。重新选择后会切换为标准预设。')).toBeTruthy()
  })

  it('opens the community commons import dialog from the banner upload entry', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    fireEvent.click(screen.getByRole('button', { name: '编辑 Banner' }))
    fireEvent.click(screen.getByRole('button', { name: '上传图片' }))

    expect(screen.getByText('导入社区公共素材')).toBeTruthy()
    expect(
      screen.getAllByText(/community_commons:community-1/).length,
    ).toBeGreaterThan(0)
  })
})
