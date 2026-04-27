import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getApiErrorCode } from '@/api/client'
import type {
  AdminMediaImportItemDto,
  AdminMediaImportListPayloadDto,
  AdminMediaImportRetrievalStatusValue,
  AdminMediaImportUrlRequestBody,
  ApiResponse,
} from '@/api/types'

interface UploadInput {
  file: File
  allow_quote_original?: boolean
}

export interface MediaImportPanelSelectAction {
  label: string
  onSelect: (item: AdminMediaImportItemDto) => void
  disabledReason?: (item: AdminMediaImportItemDto) => string | null
}

export interface MediaImportPanelProps {
  title: string
  description?: ReactNode
  uploadMutation: UseMutationResult<ApiResponse<AdminMediaImportItemDto>, unknown, UploadInput>
  urlMutation: UseMutationResult<
    ApiResponse<AdminMediaImportItemDto>,
    unknown,
    AdminMediaImportUrlRequestBody
  >
  listQuery: UseQueryResult<ApiResponse<AdminMediaImportListPayloadDto>, unknown>
  emptyHint?: ReactNode
  selectAction?: MediaImportPanelSelectAction
}

const RETRIEVAL_STATUS_TONE: Record<AdminMediaImportRetrievalStatusValue, 'default' | 'secondary' | 'destructive'> = {
  ready: 'default',
  pending: 'secondary',
  failed: 'destructive',
}

const RETRIEVAL_STATUS_LABEL: Record<AdminMediaImportRetrievalStatusValue, string> = {
  ready: '检索就绪',
  pending: '建档中',
  failed: '检索失败',
}

function readErrorMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error && error.message) return error.message
  return null
}

function readErrorCode(error: unknown): string | null {
  return getApiErrorCode(error)
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—'
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  } catch {
    return value
  }
}

function describeReusePolicy(modes: string[]): string {
  return modes.length === 0 ? '已禁用全部复用模式' : modes.join(' · ')
}

function SelectActionButton({
  item,
  config,
}: {
  item: AdminMediaImportItemDto
  config: MediaImportPanelSelectAction
}) {
  const disabledReason = config.disabledReason?.(item) ?? null
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={Boolean(disabledReason)}
      onClick={() => config.onSelect(item)}
      title={disabledReason ?? undefined}
    >
      {config.label}
    </Button>
  )
}

function ImportResultCard({
  item,
  selectAction,
}: {
  item: AdminMediaImportItemDto
  selectAction?: MediaImportPanelSelectAction
}) {
  return (
    <Card data-ui="card" data-padding="md">
      <CardHeader>
        <CardTitle>导入成功</CardTitle>
        <CardDescription>资产已注册到目标素材池，可在下方列表确认。</CardDescription>
      </CardHeader>
      <CardContent>
        <div data-ui="stack" data-direction="col" data-gap="3">
          <div className="flex items-start gap-3">
            <img
              src={item.asset.media_url}
              alt={item.semantic_snapshot?.public_safe_summary ?? item.asset.asset_id}
              className="h-20 w-20 rounded-md border object-cover"
            />
            <div data-ui="stack" data-direction="col" data-gap="1" className="flex-1 min-w-0">
              <p data-ui="text" data-variant="caption" className="break-all">{item.asset.asset_id}</p>
              <p data-ui="text" data-variant="caption" data-tone="muted">
                {item.asset.mime_type} · {item.asset.file_size_bytes} bytes
                {item.asset.width && item.asset.height ? ` · ${item.asset.width}×${item.asset.height}` : ''}
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant={RETRIEVAL_STATUS_TONE[item.retrieval.status]}>
                  {RETRIEVAL_STATUS_LABEL[item.retrieval.status]}
                </Badge>
                <Badge variant={item.reuse_policy.allowed_reuse_modes.includes('quote_original') ? 'default' : 'outline'}>
                  {item.reuse_policy.allowed_reuse_modes.includes('quote_original') ? '允许直接引用原图' : '默认仅派生/参考'}
                </Badge>
              </div>
              {selectAction && (
                <div className="pt-1">
                  <SelectActionButton item={item} config={selectAction} />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ImportListItem({
  item,
  selectAction,
}: {
  item: AdminMediaImportItemDto
  selectAction?: MediaImportPanelSelectAction
}) {
  return (
    <div data-ui="card" data-variant="outlined" data-padding="md" className="border rounded-md">
      <div className="flex items-start gap-3">
        <img
          src={item.asset.media_url}
          alt={item.semantic_snapshot?.public_safe_summary ?? item.asset.asset_id}
          className="h-16 w-16 rounded-md border object-cover"
        />
        <div data-ui="stack" data-direction="col" data-gap="1" className="flex-1 min-w-0">
          <p data-ui="text" data-variant="caption" className="break-all font-mono">{item.asset.asset_id}</p>
          <p data-ui="text" data-variant="caption" data-tone="muted">
            {describeReusePolicy(item.reuse_policy.allowed_reuse_modes)}
          </p>
          <div className="flex flex-wrap gap-1">
            <Badge variant={RETRIEVAL_STATUS_TONE[item.retrieval.status]}>
              {RETRIEVAL_STATUS_LABEL[item.retrieval.status]}
            </Badge>
            <Badge variant="outline">绑定 {item.usage_summary.total_binding_count} 次</Badge>
            <Badge variant="outline">公开展示 {item.usage_summary.public_display_count} 次</Badge>
            {item.usage_summary.latest_usage_at && (
              <Badge variant="outline">最近使用 {formatTimestamp(item.usage_summary.latest_usage_at)}</Badge>
            )}
          </div>
          {item.retrieval.last_error_code && item.retrieval.status !== 'ready' && (
            <p data-ui="text" data-variant="caption" data-tone="muted">
              检索状态原因：{item.retrieval.last_error_code}
            </p>
          )}
        </div>
        {selectAction && (
          <div className="shrink-0">
            <SelectActionButton item={item} config={selectAction} />
          </div>
        )}
      </div>
    </div>
  )
}

export function MediaImportPanel(props: MediaImportPanelProps) {
  const { title, description, uploadMutation, urlMutation, listQuery, emptyHint, selectAction } = props

  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload')

  // upload form state
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadAllowQuoteOriginal, setUploadAllowQuoteOriginal] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<AdminMediaImportItemDto | null>(null)

  // URL form state
  const [sourceUrl, setSourceUrl] = useState('')
  const [urlAllowQuoteOriginal, setUrlAllowQuoteOriginal] = useState(false)
  const [urlResult, setUrlResult] = useState<AdminMediaImportItemDto | null>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPendingFile(event.target.files?.[0] ?? null)
  }

  const submitUpload = async () => {
    if (!pendingFile) return
    const result = await uploadMutation.mutateAsync({
      file: pendingFile,
      allow_quote_original: uploadAllowQuoteOriginal ? true : undefined,
    })
    setUploadResult(result.data)
    setPendingFile(null)
    setUploadAllowQuoteOriginal(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const submitUrl = async () => {
    if (!sourceUrl.trim()) return
    const result = await urlMutation.mutateAsync({
      source_url: sourceUrl.trim(),
      allow_quote_original: urlAllowQuoteOriginal ? true : undefined,
    })
    setUrlResult(result.data)
    setSourceUrl('')
    setUrlAllowQuoteOriginal(false)
  }

  const uploadError = readErrorMessage(uploadMutation.error)
  const uploadErrorCode = readErrorCode(uploadMutation.error)
  const urlError = readErrorMessage(urlMutation.error)
  const urlErrorCode = readErrorCode(urlMutation.error)

  const list = listQuery.data?.data
  const items = list?.items ?? []

  return (
    <div data-ui="stack" data-direction="col" data-gap="5">
      <Card data-ui="card" data-padding="md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upload' | 'url')}>
            <TabsList>
              <TabsTrigger value="upload">本地上传</TabsTrigger>
              <TabsTrigger value="url">远程 URL</TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              <div data-ui="stack" data-direction="col" data-gap="3" className="pt-4">
                <label data-ui="stack" data-direction="col" data-gap="1">
                  <span data-ui="text" data-variant="label">图像文件（≤ 10MB · PNG/JPEG/WebP/GIF）</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="text-sm"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={uploadAllowQuoteOriginal}
                    onChange={(event) => setUploadAllowQuoteOriginal(event.target.checked)}
                  />
                  <span data-ui="text" data-variant="body">允许直接引用原图（默认关闭，仅派生/参考）</span>
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={submitUpload}
                    disabled={!pendingFile || uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? '上传中…' : '导入资产'}
                  </Button>
                  {pendingFile && (
                    <span data-ui="text" data-variant="caption" data-tone="muted">
                      已选择：{pendingFile.name}
                    </span>
                  )}
                </div>
                {uploadError && (
                  <p data-ui="text" data-variant="caption" data-tone="danger">
                    {uploadErrorCode ? `[${uploadErrorCode}] ` : ''}{uploadError}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="url">
              <div data-ui="stack" data-direction="col" data-gap="3" className="pt-4">
                <label data-ui="stack" data-direction="col" data-gap="1">
                  <span data-ui="text" data-variant="label">远程图像 URL（必须为 https://）</span>
                  <Input
                    type="url"
                    placeholder="https://cdn.example.com/image.png"
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={urlAllowQuoteOriginal}
                    onChange={(event) => setUrlAllowQuoteOriginal(event.target.checked)}
                  />
                  <span data-ui="text" data-variant="body">允许直接引用原图（默认关闭，仅派生/参考）</span>
                </label>
                <div>
                  <Button
                    onClick={submitUrl}
                    disabled={sourceUrl.trim().length === 0 || urlMutation.isPending}
                  >
                    {urlMutation.isPending ? '导入中…' : '导入远程图像'}
                  </Button>
                </div>
                {urlError && (
                  <p data-ui="text" data-variant="caption" data-tone="danger">
                    {urlErrorCode ? `[${urlErrorCode}] ` : ''}{urlError}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {(activeTab === 'upload' ? uploadResult : urlResult) && (
        <ImportResultCard
          item={(activeTab === 'upload' ? uploadResult : urlResult)!}
          selectAction={selectAction}
        />
      )}

      <Card data-ui="card" data-padding="md">
        <CardHeader>
          <CardTitle>素材池资产</CardTitle>
          <CardDescription>
            {list?.pool.scene_id
              ? `当前池：${list.pool.scene_id}（${items.length} 项）`
              : '加载中…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <p data-ui="text" data-variant="caption" data-tone="muted">加载中…</p>
          ) : listQuery.isError ? (
            <p data-ui="text" data-variant="caption" data-tone="danger">
              {readErrorMessage(listQuery.error) ?? '列表加载失败'}
            </p>
          ) : items.length === 0 ? (
            <p data-ui="text" data-variant="caption" data-tone="muted">
              {emptyHint ?? '暂无该池中的资产，先导入一张试试。'}
            </p>
          ) : (
            <div data-ui="stack" data-direction="col" data-gap="3">
              {items.map((item) => (
                <ImportListItem key={item.asset.asset_id} item={item} selectAction={selectAction} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
