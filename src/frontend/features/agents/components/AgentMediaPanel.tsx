import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentMediaAsset } from '@/api/types'
import {
  useAgentMediaLibrary,
  useArchiveAgentMediaAsset,
  useCreateAgentMediaFromUpload,
  useCreateAgentMediaFromUrl,
  useRestoreAgentMediaAsset,
} from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Mode = 'url' | 'upload'
type MediaKindFilter = 'image' | 'video'
type LifecycleFilter = 'active' | 'archived'

interface AgentMediaPanelProps {
  agentId: string
}

const ACCEPTED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
const EMPTY_AGENT_MEDIA_ASSETS: AgentMediaAsset[] = []

function renderError(error: unknown): string {
  if (error && typeof error === 'object') {
    const message = (
      error as {
        message?: unknown
      }
    ).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return '操作失败，请稍后重试'
}

function readMediaKind(asset: AgentMediaAsset): MediaKindFilter {
  return asset.mime_type.startsWith('video/') ? 'video' : 'image'
}

function FilterToggle({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[0.8rem] px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}

function MediaLibraryTile({
  asset,
  selected,
  onOpen,
}: {
  asset: AgentMediaAsset
  selected: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="space-y-2 text-left"
    >
      <div className={`overflow-hidden rounded-md border border-border/60 bg-muted/20 transition-colors ${
        selected ? 'ring-1 ring-border/70' : 'hover:border-border'
      }`}>
        {asset.mime_type.startsWith('image/') ? (
          <img
            src={asset.media_url}
            alt={asset.owner_note ?? '媒体资源缩略图'}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-sm text-muted-foreground">
            视频资源
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="truncate text-xs font-medium text-foreground/88">
          {asset.owner_note?.trim() || '未填写补充说明'}
        </p>
      </div>
    </button>
  )
}

export function AgentMediaPanel({ agentId }: AgentMediaPanelProps) {
  const [mode, setMode] = useState<Mode>('url')
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [sourceUrl, setSourceUrl] = useState('')
  const [ownerNote, setOwnerNote] = useState('')
  const [ownerNoteFocused, setOwnerNoteFocused] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)
  const [mediaKindFilter, setMediaKindFilter] = useState<MediaKindFilter>('image')
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('active')
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'archive' | 'restore' | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null)

  const library = useAgentMediaLibrary(agentId, true)
  const createFromUrl = useCreateAgentMediaFromUrl(agentId)
  const createFromUpload = useCreateAgentMediaFromUpload(agentId)
  const archiveAsset = useArchiveAgentMediaAsset(agentId)
  const restoreAsset = useRestoreAgentMediaAsset(agentId)

  const busy = createFromUrl.isPending || createFromUpload.isPending
  const viewBusy = archiveAsset.isPending || restoreAsset.isPending
  const assets = library.data?.data?.assets ?? EMPTY_AGENT_MEDIA_ASSETS
  const errorMessage = useMemo(() => {
    return renderError(createFromUrl.error ?? createFromUpload.error)
  }, [createFromUrl.error, createFromUpload.error])
  const previewUrl = mode === 'upload'
    ? uploadPreviewUrl
    : sourceUrl.trim()
  const hasSelectedMedia = Boolean(previewUrl)
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => (
      asset.lifecycle_status === lifecycleFilter
      && readMediaKind(asset) === mediaKindFilter
    ))
  }, [assets, lifecycleFilter, mediaKindFilter])
  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null
    return assets.find((asset) => asset.asset_id === selectedAssetId) ?? null
  }, [assets, selectedAssetId])
  const selectedAssetStatusLabel = selectedAsset?.lifecycle_status === 'archived' ? '当前：已归档' : '当前：可用'
  const videoNoticeVisible = mediaKindFilter === 'video'

  useEffect(() => {
    if (!file) {
      setUploadPreviewUrl(null)
      return
    }
    const nextPreviewUrl = URL.createObjectURL(file)
    setUploadPreviewUrl(nextPreviewUrl)
    return () => {
      URL.revokeObjectURL(nextPreviewUrl)
    }
  }, [file])

  async function submitUrl() {
    const trimmed = sourceUrl.trim()
    if (!trimmed) return
    await createFromUrl.mutateAsync({
      source_url: trimmed,
      owner_note: ownerNote.trim() || undefined,
    })
    setSourceUrl('')
    setOwnerNote('')
    setInputError(null)
    setUrlDialogOpen(false)
  }

  async function submitUpload() {
    if (!file) return
    await createFromUpload.mutateAsync({
      file,
      owner_note: ownerNote.trim() || undefined,
    })
    setFile(null)
    setOwnerNote('')
    setInputError(null)
  }

  function openUploadPicker() {
    setMode('upload')
    setInputError(null)
    uploadInputRef.current?.click()
  }

  function handleFileSelection(nextFile: File | null) {
    if (!nextFile) return
    if (!ACCEPTED_UPLOAD_TYPES.has(nextFile.type)) {
      setFile(null)
      setUploadPreviewUrl(null)
      setInputError('文件格式不支持，请上传 jpg、png、webp 或 gif。')
      return
    }
    if (nextFile.size > MAX_UPLOAD_SIZE_BYTES) {
      setFile(null)
      setUploadPreviewUrl(null)
      setInputError('文件过大，请控制在 10MB 以内。')
      return
    }
    setFile(nextFile)
    setInputError(null)
  }

  const actionErrorMessage = inputError ?? (
    (createFromUrl.error || createFromUpload.error) ? errorMessage : null
  )

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="agent-media-input-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="agent-media-input-heading" className="text-base font-semibold tracking-tight text-foreground">
            资源传入
          </h2>
          <div className="flex items-center gap-1 rounded-full bg-muted/35 px-0.5 py-0.5">
            <FilterToggle
              active={mode === 'url'}
              label="URL"
              onClick={() => {
                setMode('url')
                setInputError(null)
                setUrlDialogOpen(true)
              }}
            />
            <FilterToggle
              active={mode === 'upload'}
              label="上传"
              onClick={openUploadPicker}
            />
          </div>
        </div>

        <Input
          ref={uploadInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFileSelection(e.target.files?.[0] ?? null)}
        />

        <div className="grid gap-4 md:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] md:items-start">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground/88">预览</p>
            <div className="h-40 overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="待传入资源预览"
                  className="h-full w-full object-cover"
                  onError={() => {
                    if (mode === 'url') {
                      setInputError('资源地址不可用，请检查链接是否正确。')
                    }
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                  未加载媒体资源
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground/88">补充说明</p>
            <div className="flex h-40 flex-col rounded-2xl border border-border/60 bg-background">
              <div className="relative min-h-0 flex-1">
                <textarea
                  rows={1}
                  className="h-full min-h-0 w-full resize-none border-0 bg-transparent px-3 py-3 text-sm leading-6 text-foreground outline-none"
                  placeholder=""
                  value={ownerNote}
                  onChange={(e) => setOwnerNote(e.target.value)}
                  onFocus={() => setOwnerNoteFocused(true)}
                  onBlur={() => setOwnerNoteFocused(false)}
                />
                {!ownerNote && !ownerNoteFocused ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-[13px] font-normal leading-6 text-muted-foreground/80">
                    例如：这张图更偏轻松吐槽风格，试着引出分歧讨论。
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3 px-3 pb-2">
                <div className="min-w-0 text-xs text-destructive">
                  {actionErrorMessage ?? ''}
                </div>
                <button
                  type="button"
                  disabled={busy || !hasSelectedMedia || (mode === 'url' ? !sourceUrl.trim() : !file)}
                  className={`shrink-0 text-xs font-medium transition-colors ${
                    hasSelectedMedia
                      ? 'text-[#243B6B] hover:text-[#1d3057]'
                      : 'cursor-not-allowed text-foreground/30'
                  }`}
                  onClick={() => {
                    if (mode === 'url') {
                      void submitUrl()
                    } else {
                      void submitUpload()
                    }
                  }}
                >
                  {busy ? '处理中…' : '加入素材池'}
                </button>
              </div>
            </div>
          </div>

          {file ? (
            <p className="text-sm text-muted-foreground md:col-span-2">
              已选择：{file.name}（{Math.ceil(file.size / 1024)} KB）
            </p>
          ) : null}

          {sourceUrl.trim() ? (
            <p className="text-sm text-muted-foreground break-all md:col-span-2">
              当前链接：{sourceUrl.trim()}
            </p>
          ) : null}
        </div>
      </section>

      <section
        className="space-y-6 border-t border-border/50 pt-8"
        aria-labelledby="agent-media-view-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="agent-media-view-heading" className="text-base font-semibold tracking-tight text-foreground">
            资源查看
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-muted/35 px-0.5 py-0.5">
              <FilterToggle
                active={mediaKindFilter === 'image'}
                label="图片"
                onClick={() => setMediaKindFilter('image')}
              />
              <FilterToggle
                active={mediaKindFilter === 'video'}
                label="视频"
                onClick={() => setMediaKindFilter('video')}
              />
            </div>
            <div className="flex items-center gap-1 rounded-full bg-muted/35 px-0.5 py-0.5">
              <FilterToggle
                active={lifecycleFilter === 'active'}
                label="激活"
                onClick={() => setLifecycleFilter('active')}
              />
              <FilterToggle
                active={lifecycleFilter === 'archived'}
                label="归档"
                onClick={() => setLifecycleFilter('archived')}
              />
            </div>
          </div>
        </div>

        {videoNoticeVisible ? (
          <p className="text-sm text-muted-foreground">
            当前暂不支持视频资源，功能即将开放。
          </p>
        ) : null}

        {library.isLoading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : filteredAssets.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAssets.map((asset) => (
              <MediaLibraryTile
                key={asset.asset_id}
                asset={asset}
                selected={selectedAssetId === asset.asset_id}
                onOpen={() => setSelectedAssetId(asset.asset_id)}
              />
            ))}
          </div>
        ) : assets.length > 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            当前筛选下还没有可展示的素材。
          </p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            素材池还是空的。先传入一张图片，这里会平铺展示全部素材资源。
          </p>
        )}
      </section>

      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>输入资源地址</DialogTitle>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="https://example.com/your-image.png"
              value={sourceUrl}
              onChange={(e) => {
                setSourceUrl(e.target.value)
                setInputError(null)
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUrlDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setMode('url')
                  setUrlDialogOpen(false)
                }}
              >
                确认
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedAsset)} onOpenChange={(open) => {
        if (!open) {
          setSelectedAssetId(null)
          setConfirmAction(null)
        }
      }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              <DialogTitle>媒体资源详情</DialogTitle>
              {selectedAsset ? (
                <span className="text-xs text-muted-foreground">
                  {selectedAssetStatusLabel}
                </span>
              ) : null}
            </div>
            {selectedAsset ? (
              <button
                type="button"
                disabled={viewBusy}
                className={`text-sm font-semibold transition-colors ${
                  selectedAsset.lifecycle_status === 'archived'
                    ? 'text-[#243B6B] hover:text-[#1d3057]'
                    : 'text-foreground/70 hover:text-foreground'
                }`}
                onClick={() => {
                  setConfirmAction(selectedAsset.lifecycle_status === 'archived' ? 'restore' : 'archive')
                }}
              >
                {selectedAsset.lifecycle_status === 'archived' ? '激活' : '归档'}
              </button>
            ) : null}
          </div>
          {selectedAsset ? (
            <div className="space-y-6 overflow-y-auto pt-2 pr-1 pb-3 max-h-[calc(85vh-4rem)]">
              <div className="overflow-hidden rounded-md border border-border/60 bg-muted/20">
                {selectedAsset.mime_type.startsWith('image/') ? (
                  <img
                    src={selectedAsset.media_url}
                    alt={selectedAsset.owner_note ?? '媒体资源大图'}
                    className="max-h-[52vh] w-full object-contain"
                  />
                ) : (
                  <div className="flex min-h-[18rem] items-center justify-center text-sm text-muted-foreground">
                    暂不支持视频预览
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm leading-6 text-foreground/88">
                    {selectedAsset.owner_note?.trim() || '这项资源还没有补充说明。'}
                  </p>
                </div>

                <dl className="space-y-3 text-sm">
                  <div className="space-y-1">
                    <dt className="font-medium text-foreground/88">主题</dt>
                    <dd className="text-muted-foreground">{selectedAsset.semantic_summary.style.theme}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="font-medium text-foreground/88">场景</dt>
                    <dd className="text-muted-foreground">{selectedAsset.semantic_summary.scene}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="font-medium text-foreground/88">情绪</dt>
                    <dd className="text-muted-foreground">{selectedAsset.semantic_summary.style.mood}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="font-medium text-foreground/88">公开安全摘要</dt>
                    <dd className="text-muted-foreground">
                      {selectedAsset.semantic_summary.summaries.public_safe}
                    </dd>
                  </div>
                </dl>

                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-foreground/88">可展开的话题</p>
                  {selectedAsset.semantic_summary.entities.discussion_points.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedAsset.semantic_summary.entities.discussion_points.map((point) => (
                        <span
                          key={point}
                          className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">这项资源还没有生成可展开的话题。</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedAsset && confirmAction)} onOpenChange={(open) => {
        if (!open) setConfirmAction(null)
      }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle>
            {confirmAction === 'archive' ? '确认归档这项资源？' : '确认激活这项资源？'}
          </DialogTitle>
          <div className="space-y-4 pt-2">
            <p className="text-sm leading-6 text-muted-foreground">
              {confirmAction === 'archive'
                ? '归档后，这项资源会从“激活”列表移到“归档”列表。'
                : '激活后，这项资源会重新出现在“激活”列表中。'}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmAction(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!selectedAsset || !confirmAction) return
                  if (confirmAction === 'archive') {
                    void archiveAsset.mutateAsync(selectedAsset.asset_id).then(() => {
                      setConfirmAction(null)
                    })
                  } else {
                    void restoreAsset.mutateAsync(selectedAsset.asset_id).then(() => {
                      setConfirmAction(null)
                    })
                  }
                }}
              >
                {confirmAction === 'archive' ? '确认归档' : '确认激活'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
