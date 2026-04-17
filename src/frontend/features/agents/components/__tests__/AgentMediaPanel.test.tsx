import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentMediaPanel } from '../AgentMediaPanel'

const useAgentMediaLibraryMock = vi.fn()
const useCreateAgentMediaFromUrlMock = vi.fn()
const useCreateAgentMediaFromUploadMock = vi.fn()
const useArchiveAgentMediaAssetMock = vi.fn()
const useRestoreAgentMediaAssetMock = vi.fn()

vi.mock('@/api/hooks', () => ({
  useAgentMediaLibrary: (agentId: string, enabled?: boolean) =>
    useAgentMediaLibraryMock(agentId, enabled),
  useCreateAgentMediaFromUrl: (agentId: string) => useCreateAgentMediaFromUrlMock(agentId),
  useCreateAgentMediaFromUpload: (agentId: string) => useCreateAgentMediaFromUploadMock(agentId),
  useArchiveAgentMediaAsset: (agentId: string) => useArchiveAgentMediaAssetMock(agentId),
  useRestoreAgentMediaAsset: (agentId: string) => useRestoreAgentMediaAssetMock(agentId),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}))

describe('AgentMediaPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCreateAgentMediaFromUrlMock.mockReturnValue({
      isPending: false,
      error: null,
      mutateAsync: vi.fn(),
    })
    useCreateAgentMediaFromUploadMock.mockReturnValue({
      isPending: false,
      error: null,
      mutateAsync: vi.fn(),
    })
    useArchiveAgentMediaAssetMock.mockReturnValue({
      isPending: false,
      error: null,
      mutateAsync: vi.fn(),
    })
    useRestoreAgentMediaAssetMock.mockReturnValue({
      isPending: false,
      error: null,
      mutateAsync: vi.fn(),
    })
  })

  it('renders input and media library sections and opens the detail dialog', () => {
    useAgentMediaLibraryMock.mockReturnValue({
      isLoading: false,
      data: {
        data: {
          pool: {
            anchor_scene_id: 'pool-1',
            active_count: 1,
            archived_count: 1,
            total_count: 2,
          },
          latest_public_attachment: {
            asset_id: 'asset-1',
            visibility_policy: 'private_only',
            lifecycle_status: 'active',
            media_url: 'https://example.com/private.png',
            mime_type: 'image/png',
            file_size_bytes: 1000,
            width: 1200,
            height: 800,
            owner_note: '适合讽刺感更强的场景。',
            semantic_summary: {
              scene: '辩论现场',
              composition: '人物半身',
              style: { theme: '争议感', mood: '紧张', tags: [] },
              summaries: { public_safe: '适合公开场景。' },
              entities: { discussion_points: ['立场冲突', '追问链条'], salient: [] },
              ocr: { snippets: [] },
              safety: { labels: [] },
              confidence: 0.91,
            },
            created_at: '2026-04-17T09:00:00.000Z',
            latest_post_id: 'post-1',
            latest_public_attachment_at: '2026-04-17T10:00:00.000Z',
          },
          assets: [
            {
              asset_id: 'asset-1',
              visibility_policy: 'private_only',
              lifecycle_status: 'active',
              media_url: 'https://example.com/private.png',
              mime_type: 'image/png',
              file_size_bytes: 1000,
              width: 1200,
              height: 800,
              owner_note: '适合讽刺感更强的场景。',
              semantic_summary: {
                scene: '辩论现场',
                composition: '人物半身',
                style: { theme: '争议感', mood: '紧张', tags: [] },
                summaries: { public_safe: '适合公开场景。' },
                entities: { discussion_points: ['立场冲突', '追问链条'], salient: [] },
                ocr: { snippets: [] },
                safety: { labels: [] },
                confidence: 0.91,
              },
              created_at: '2026-04-17T09:00:00.000Z',
              latest_post_id: 'post-1',
              latest_public_attachment_at: '2026-04-17T10:00:00.000Z',
            },
            {
              asset_id: 'asset-2',
              visibility_policy: 'private_only',
              lifecycle_status: 'archived',
              media_url: 'https://example.com/archive.png',
              mime_type: 'image/png',
              file_size_bytes: 1000,
              width: 1200,
              height: 800,
              owner_note: '已归档素材',
              semantic_summary: {
                scene: '归档场景',
                composition: '人物半身',
                style: { theme: '回顾感', mood: '平静', tags: [] },
                summaries: { public_safe: '适合公开场景。' },
                entities: { discussion_points: [], salient: [] },
                ocr: { snippets: [] },
                safety: { labels: [] },
                confidence: 0.88,
              },
              created_at: '2026-04-16T09:00:00.000Z',
              latest_post_id: null,
              latest_public_attachment_at: null,
            },
          ],
        },
      },
    })

    render(<AgentMediaPanel agentId="agent-1" />)

    expect(screen.getByText('资源传入')).toBeTruthy()
    expect(screen.getByText('资源查看')).toBeTruthy()
    expect(screen.getByText('图片')).toBeTruthy()
    expect(screen.getAllByText('激活').length).toBeGreaterThan(0)
    expect(screen.getByText('适合讽刺感更强的场景。')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /适合讽刺感更强的场景。/ }))

    expect(screen.getByText('媒体资源详情')).toBeTruthy()
    expect(screen.getByText('公开安全摘要')).toBeTruthy()
    expect(screen.getByText('立场冲突')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '归档' }).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: '归档' })[1]!)
    expect(screen.getByText('确认归档这项资源？')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '视频' }))
    expect(screen.getByText('当前暂不支持视频资源，功能即将开放。')).toBeTruthy()
  })

  it('opens the URL dialog when URL is clicked', () => {
    useAgentMediaLibraryMock.mockReturnValue({
      isLoading: false,
      data: {
        data: {
          pool: {
            anchor_scene_id: 'pool-1',
            active_count: 0,
            archived_count: 0,
            total_count: 0,
          },
          latest_public_attachment: null,
          assets: [],
        },
      },
    })

    render(<AgentMediaPanel agentId="agent-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'URL' }))

    expect(screen.getByText('输入资源地址')).toBeTruthy()
    expect(screen.getByPlaceholderText('https://example.com/your-image.png')).toBeTruthy()
    expect(screen.getByText('未加载媒体资源')).toBeTruthy()
    expect(screen.getByText('素材池还是空的。先传入一张图片，这里会平铺展示全部素材资源。')).toBeTruthy()
  })

  it('shows a red validation message when upload type is unsupported', () => {
    useAgentMediaLibraryMock.mockReturnValue({
      isLoading: false,
      data: {
        data: {
          pool: {
            anchor_scene_id: 'pool-1',
            active_count: 0,
            archived_count: 0,
            total_count: 0,
          },
          latest_public_attachment: null,
          assets: [],
        },
      },
    })

    render(<AgentMediaPanel agentId="agent-1" />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = new File(['hello'], 'note.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [badFile] } })

    expect(screen.getByText('文件格式不支持，请上传 jpg、png、webp 或 gif。')).toBeTruthy()
  })
})
