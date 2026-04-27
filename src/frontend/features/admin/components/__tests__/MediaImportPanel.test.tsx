import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type {
  AdminMediaImportItemDto,
  AdminMediaImportListPayloadDto,
  AdminMediaImportUrlRequestBody,
  ApiResponse,
} from '@/api/types'
import { MediaImportPanel, type MediaImportPanelProps } from '../MediaImportPanel'

function buildItem(overrides: Partial<AdminMediaImportItemDto> = {}): AdminMediaImportItemDto {
  return {
    asset: {
      asset_id: 'asset-1',
      source_kind: 'platform_canonical',
      media_url: '/v1/media/local/test.png',
      mime_type: 'image/png',
      file_size_bytes: 64,
      width: 1,
      height: 1,
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      created_at: '2026-04-27T00:00:00.000Z',
    },
    semantic_snapshot: null,
    pool_binding: {
      binding_id: 'binding-1',
      scene_type: 'media_pool',
      scene_id: 'platform_canonical:global',
      display_policy: 'original_allowed',
      created_at: '2026-04-27T00:00:00.000Z',
    },
    reuse_policy: {
      policy_id: 'policy-1',
      allowed_reuse_modes: ['derive_new', 'reference_only'],
      cross_agent_quote_allowed: false,
      copyright_state: 'platform_owned',
      status: 'active',
    },
    retrieval: {
      status: 'pending',
      document_ids: ['doc-1'],
      doc_scopes: ['public_safe'],
      searchable_embedding_count: 0,
      last_error_code: 'gateway_not_configured',
      last_error_message: 'gateway_not_configured',
    },
    usage_summary: {
      total_binding_count: 1,
      public_display_count: 0,
      latest_usage_at: null,
      scene_type_counts: { media_pool: 1 },
    },
    ...overrides,
  }
}

function buildListPayload(items: AdminMediaImportItemDto[]): AdminMediaImportListPayloadDto {
  return {
    pool: { scene_type: 'media_pool', scene_id: 'platform_canonical:global', community_id: null },
    items,
    next_cursor: null,
  }
}

interface MockMutationOverrides {
  isPending?: boolean
  error?: unknown
}

function createUploadMutation(overrides: MockMutationOverrides = {}): MediaImportPanelProps['uploadMutation'] {
  return {
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: overrides.isPending ?? false,
    isError: Boolean(overrides.error),
    isSuccess: false,
    isIdle: true,
    status: overrides.isPending ? 'pending' : 'idle',
    error: (overrides.error ?? null) as Error | null,
    data: undefined,
    variables: undefined,
    reset: vi.fn(),
  } as unknown as MediaImportPanelProps['uploadMutation']
}

function createUrlMutation(): MediaImportPanelProps['urlMutation'] {
  return {
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    error: null,
    data: undefined,
    variables: undefined,
    reset: vi.fn(),
  } as unknown as UseMutationResult<
    ApiResponse<AdminMediaImportItemDto>,
    unknown,
    AdminMediaImportUrlRequestBody
  >
}

function createListQuery(payload?: AdminMediaImportListPayloadDto): MediaImportPanelProps['listQuery'] {
  return {
    data: payload ? { data: payload } : undefined,
    isLoading: !payload,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
    isStale: false,
    status: payload ? 'success' : 'pending',
    fetchStatus: 'idle',
  } as unknown as UseQueryResult<ApiResponse<AdminMediaImportListPayloadDto>, unknown>
}

function renderPanel(extra: Partial<MediaImportPanelProps> = {}) {
  return render(
    <MediaImportPanel
      title="平台公共素材池"
      description="测试描述"
      uploadMutation={extra.uploadMutation ?? createUploadMutation()}
      urlMutation={extra.urlMutation ?? createUrlMutation()}
      listQuery={extra.listQuery ?? createListQuery(buildListPayload([]))}
    />,
  )
}

describe('MediaImportPanel', () => {
  it('renders upload tab by default with allow_quote_original switch off and disabled submit', () => {
    renderPanel()
    const checkboxes = screen.getAllByRole('checkbox', { name: /允许直接引用原图/ })
    expect(checkboxes.length).toBeGreaterThan(0)
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false)
    const submit = screen.getByRole('button', { name: '导入资产' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it('shows mutation error message and code inline when upload fails', () => {
    const error = Object.assign(new Error('media exceeds 10MB limit'), { code: 'VALIDATION_ERROR' })
    renderPanel({ uploadMutation: createUploadMutation({ error }) })
    expect(screen.getAllByText(/media exceeds 10MB limit/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/VALIDATION_ERROR/).length).toBeGreaterThan(0)
  })

  it('renders pool list items with retrieval status badge and usage counts', () => {
    const item = buildItem({ asset: { ...buildItem().asset, asset_id: 'asset-listed' } })
    renderPanel({ listQuery: createListQuery(buildListPayload([item])) })
    expect(screen.getAllByText('asset-listed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('建档中').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/绑定 1 次/).length).toBeGreaterThan(0)
  })

  it('shows empty state when list is loaded with zero items', () => {
    renderPanel({ listQuery: createListQuery(buildListPayload([])) })
    expect(screen.getAllByText(/暂无该池中的资产/).length).toBeGreaterThan(0)
  })

  it('exposes both upload and URL tab controls', () => {
    renderPanel()
    expect(screen.getByRole('tab', { name: '本地上传' })).toBeDefined()
    expect(screen.getByRole('tab', { name: '远程 URL' })).toBeDefined()
  })

  it('renders the selectAction button on list items and forwards the clicked item', () => {
    const item = buildItem()
    const onSelect = vi.fn()
    render(
      <MediaImportPanel
        title="社区池"
        uploadMutation={createUploadMutation()}
        urlMutation={createUrlMutation()}
        listQuery={createListQuery(buildListPayload([item]))}
        selectAction={{ label: '选作 Banner', onSelect }}
      />,
    )
    const selectButtons = screen.getAllByRole('button', { name: '选作 Banner' })
    expect(selectButtons.length).toBeGreaterThan(0)
    fireEvent.click(selectButtons[0])
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      asset: expect.objectContaining({ asset_id: 'asset-1' }),
    }))
  })
})
