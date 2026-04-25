import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaScenePack } from '@/api/types'
import {
  useActivateAdminMediaScenePackVersion,
  useAdminMediaScenePack,
  useAdminMediaScenePackCompilePreview,
  useAdminMediaScenePackRoutePreview,
  useAdminMediaScenePacks,
  useCreateAdminMediaScenePackDraft,
  useReleaseAdminMediaScenePackVersion,
  useUpdateAdminMediaScenePackVersion,
} from '@/api/hooks'
import { MediaPromptsTab } from '../MediaPromptsTab'

vi.mock('@/api/hooks', () => ({
  useActivateAdminMediaScenePackVersion: vi.fn(),
  useAdminMediaScenePack: vi.fn(),
  useAdminMediaScenePackCompilePreview: vi.fn(),
  useAdminMediaScenePackRoutePreview: vi.fn(),
  useAdminMediaScenePacks: vi.fn(),
  useCreateAdminMediaScenePackDraft: vi.fn(),
  useReleaseAdminMediaScenePackVersion: vi.fn(),
  useUpdateAdminMediaScenePackVersion: vi.fn(),
}))

const useAdminMediaScenePacksMock = vi.mocked(useAdminMediaScenePacks)
const useAdminMediaScenePackMock = vi.mocked(useAdminMediaScenePack)
const useCreateDraftMock = vi.mocked(useCreateAdminMediaScenePackDraft)
const useUpdateDraftMock = vi.mocked(useUpdateAdminMediaScenePackVersion)
const useActivateVersionMock = vi.mocked(useActivateAdminMediaScenePackVersion)
const useReleaseVersionMock = vi.mocked(useReleaseAdminMediaScenePackVersion)
const useRoutePreviewMock = vi.mocked(useAdminMediaScenePackRoutePreview)
const useCompilePreviewMock = vi.mocked(useAdminMediaScenePackCompilePreview)

const activeVersion = {
  id: 'version-1',
  pack_id: 'pack-1',
  scene_id: 'desktop_workflow_photo',
  version: 1,
  status: 'active',
  display_name: '桌面工作流照片',
  media_family: 'workspace_photo',
  when_to_use: ['The post talks about work habits.'],
  do_not_use_when: ['No visual needed.'],
  visual_contract: {
    surface: 'realistic desktop workflow photo',
    composition: 'desk-level photo with tools and work-in-progress state',
    text_policy: 'allow_short_chinese',
    real_world_anchor_required: true,
    required_information_layers: ['desk-level workflow', 'tools and references'],
    routing_keywords: ['workflow', 'desktop'],
  },
  safety_boundaries: {
    no_price: false,
    no_efficacy_claim: false,
    no_real_brand_promo: true,
    no_purchase_guarantee: true,
    additional_boundaries: [],
  },
  prompt_system: 'Photograph a grounded desktop workflow scene with concrete work artifacts.',
  quality_gate: {
    must_have: ['desk-level workflow'],
    reject_if: ['generic stock-photo look'],
  },
  created_by_user_id: 'system',
  activated_at: '2026-04-24T00:00:00.000Z',
  released_at: null,
  created_at: '2026-04-24T00:00:00.000Z',
  updated_at: '2026-04-24T00:00:00.000Z',
} satisfies MediaScenePack['versions'][number]

const samplePack: MediaScenePack = {
  id: 'pack-1',
  scene_id: 'desktop_workflow_photo',
  display_name: '桌面工作流照片',
  media_family: 'workspace_photo',
  status: 'active',
  active_version: 1,
  created_at: '2026-04-24T00:00:00.000Z',
  updated_at: '2026-04-24T00:00:00.000Z',
  active_version_record: activeVersion,
  versions: [activeVersion],
}

describe('MediaPromptsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAdminMediaScenePacksMock.mockReturnValue({
      data: { data: [samplePack] },
      isLoading: false,
      error: null,
    } as never)
    useAdminMediaScenePackMock.mockReturnValue({
      data: { data: samplePack },
      isLoading: false,
      error: null,
    } as never)
    useCreateDraftMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ data: activeVersion }), isPending: false } as never)
    useUpdateDraftMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ data: activeVersion }), isPending: false } as never)
    useActivateVersionMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ data: samplePack }), isPending: false } as never)
    useReleaseVersionMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ data: activeVersion }), isPending: false } as never)
    useRoutePreviewMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ data: { candidates: [] } }), isPending: false } as never)
    useCompilePreviewMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ data: { compiled_prompt: null } }), isPending: false } as never)
  })

  it('renders scene pack details and creates a draft from the active version', async () => {
    const createAsync = vi.fn().mockResolvedValue({ data: { ...activeVersion, status: 'draft', version: 2 } })
    useCreateDraftMock.mockReturnValue({ mutateAsync: createAsync, isPending: false } as never)

    render(<MediaPromptsTab />)

    expect(screen.getAllByText('桌面工作流照片').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '新建草稿' }))

    await waitFor(() => {
      expect(createAsync).toHaveBeenCalledWith(expect.objectContaining({
        scene_id: 'desktop_workflow_photo',
      }))
    })
  })

  it('runs route and compile preview from preview text', async () => {
    const routeAsync = vi.fn().mockResolvedValue({ data: { candidates: [] } })
    const compileAsync = vi.fn().mockResolvedValue({ data: { compiled_prompt: null } })
    useRoutePreviewMock.mockReturnValue({ mutateAsync: routeAsync, isPending: false } as never)
    useCompilePreviewMock.mockReturnValue({ mutateAsync: compileAsync, isPending: false } as never)

    render(<MediaPromptsTab />)

    fireEvent.change(screen.getByPlaceholderText('输入根帖主题、发帖目标或画面简述...'), {
      target: { value: 'desktop workflow with notebook and reference papers' },
    })
    fireEvent.click(screen.getByRole('button', { name: '匹配场景' }))
    fireEvent.click(screen.getByRole('button', { name: '编译提示词' }))

    await waitFor(() => {
      expect(routeAsync).toHaveBeenCalledWith({
        text: 'desktop workflow with notebook and reference papers',
      })
      expect(compileAsync).toHaveBeenCalledWith(expect.objectContaining({
        scene_id: 'desktop_workflow_photo',
      }))
    })
  })
})
