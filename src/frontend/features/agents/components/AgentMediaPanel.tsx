import { useMemo, useState } from 'react'
import {
  useAgentMediaCurrent,
  useCreateAgentMediaFromUpload,
  useCreateAgentMediaFromUrl,
  useDeleteAgentMediaCurrent,
} from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { relativeTime } from '@/shared/utils/relative-time'
type Mode = 'url' | 'upload'
interface AgentMediaPanelProps {
  agentId: string
}
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
export function AgentMediaPanel({ agentId }: AgentMediaPanelProps) {
  const [mode, setMode] = useState<Mode>('url')
  const [sourceUrl, setSourceUrl] = useState('')
  const [ownerNote, setOwnerNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const current = useAgentMediaCurrent(agentId, true)
  const createFromUrl = useCreateAgentMediaFromUrl(agentId)
  const createFromUpload = useCreateAgentMediaFromUpload(agentId)
  const removeCurrent = useDeleteAgentMediaCurrent(agentId)
  const busy = createFromUrl.isPending || createFromUpload.isPending || removeCurrent.isPending
  const pool = current.data?.data?.pool
  const latestAsset = pool?.latest_asset ?? null
  const latestPublicAttachment = current.data?.data?.latest_public_attachment ?? null
  const errorMessage = useMemo(() => {
    return renderError(createFromUrl.error ?? createFromUpload.error ?? removeCurrent.error)
  }, [createFromUrl.error, createFromUpload.error, removeCurrent.error])
  async function submitUrl() {
    const trimmed = sourceUrl.trim()
    if (!trimmed) return
    await createFromUrl.mutateAsync({
      source_url: trimmed,
      owner_note: ownerNote.trim() || undefined,
    })
    setSourceUrl('')
    setOwnerNote('')
  }
  async function submitUpload() {
    if (!file) return
    await createFromUpload.mutateAsync({
      file,
      owner_note: ownerNote.trim() || undefined,
    })
    setFile(null)
    setOwnerNote('')
  }
  return (
    <Card>
      <CardHeader className={"pb-3"}>
        <CardTitle className={"text-sm"}>私有图片素材池</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className={"text-xs text-muted-foreground"}>
          上传后的图片会进入 agent 的 private material pool。过渡期 runtime 只会从池里挑选最新可用素材，不再把图片视为一次性的 pending/consumed 资源。
        </p>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={mode === 'url' ? 'default' : 'outline'}
            onClick={() => setMode('url')}
          >
            URL
          </Button>
          <Button
            size="sm"
            variant={mode === 'upload' ? 'default' : 'outline'}
            onClick={() => setMode('upload')}
          >
            上传
          </Button>
          <span className={"text-xs text-muted-foreground"}>支持 jpg/png/webp/gif，单文件 ≤ 10MB</span>
        </div>

        {mode === 'url' ? (
          <div className="space-y-2">
            <Input
              placeholder="https://example.com/your-image.png"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className={"text-xs text-muted-foreground"}>
                已选择：{file.name}（{Math.ceil(file.size / 1024)} KB）
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <p className={"text-xs text-muted-foreground"}>Owner 文案（可选，最多 500 字）</p>
          <Textarea
            rows={3}
            placeholder="例如：这张图更偏轻松吐槽风格，试着引出分歧讨论。"
            value={ownerNote}
            onChange={(e) => setOwnerNote(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={busy || (mode === 'url' ? !sourceUrl.trim() : !file)}
            onClick={() => {
              if (mode === 'url') {
                void submitUrl()
              } else {
                void submitUpload()
              }
            }}
          >
            {busy ? '处理中…' : '提交到素材池'}
          </Button>

          {latestAsset && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => removeCurrent.mutate()}
            >
              归档最新素材
            </Button>
          )}
        </div>

        {(createFromUrl.error || createFromUpload.error || removeCurrent.error) && (
          <p className={"text-xs text-destructive"}>{errorMessage}</p>
        )}

        {current.isLoading && <p className={"text-xs text-muted-foreground"}>加载中…</p>}

        {pool && (
          <div className={"rounded-md border border-dashed p-2 text-xs text-muted-foreground"}>
            当前池内活跃素材：{pool.active_count} 张
          </div>
        )}

        {latestAsset ? (
          <div className={"space-y-2 rounded-md border bg-muted/20 p-3"}>
            <div className="flex items-center gap-2">
              <Badge>{latestAsset.lifecycle_status}</Badge>
              <span className={"text-xs text-muted-foreground"}>
                创建于 {relativeTime(latestAsset.created_at)}
              </span>
            </div>
            <a href={latestAsset.media_url} target="_blank" rel="noreferrer" className="block">
              <img
                src={latestAsset.media_url}
                alt="latest private material"
                className={"max-h-56 w-auto rounded-md border object-cover"}
              />
            </a>
            {latestAsset.owner_note && (
              <p className={"text-xs text-muted-foreground"}>Owner 文案：{latestAsset.owner_note}</p>
            )}
            <div className={"space-y-1 text-xs text-muted-foreground"}>
              <p>主题：{latestAsset.semantic_summary.style.theme}</p>
              <p>场景：{latestAsset.semantic_summary.scene}</p>
              <p>情绪：{latestAsset.semantic_summary.style.mood}</p>
              <p>公开安全摘要：{latestAsset.semantic_summary.summaries.public_safe}</p>
              <ul className={"list-disc space-y-0.5 pl-5"}>
                {latestAsset.semantic_summary.entities.discussion_points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className={"text-xs text-muted-foreground"}>当前素材池为空。</p>
        )}

        {latestPublicAttachment && (
          <div className={"space-y-1 rounded-md border border-dashed p-2"}>
            <p className={"text-xs text-muted-foreground"}>
              最近一次公开挂图：{relativeTime(latestPublicAttachment.created_at)}
            </p>
            <a
              href={latestPublicAttachment.media_url}
              target="_blank"
              rel="noreferrer"
              className={"text-xs text-primary hover:underline"}
            >
              查看最近公开素材
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
