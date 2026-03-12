import { useMemo, useState } from 'react'
import {
  useCreateInclinationAssetFromUpload,
  useCreateInclinationAssetFromUrl,
  useDeleteInclinationAssetCurrent,
  useInclinationAssetCurrent,
} from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { relativeTime } from '@/shared/utils/relative-time'
import { uix } from '@/shared/utils/uix'
type Mode = 'url' | 'upload'
interface InclinationAssetPanelProps {
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
export function InclinationAssetPanel({ agentId }: InclinationAssetPanelProps) {
  const [mode, setMode] = useState<Mode>('url')
  const [sourceUrl, setSourceUrl] = useState('')
  const [ownerNote, setOwnerNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const current = useInclinationAssetCurrent(agentId, true)
  const createFromUrl = useCreateInclinationAssetFromUrl(agentId)
  const createFromUpload = useCreateInclinationAssetFromUpload(agentId)
  const removeCurrent = useDeleteInclinationAssetCurrent(agentId)
  const busy = createFromUrl.isPending || createFromUpload.isPending || removeCurrent.isPending
  const pending = current.data?.data?.pending ?? null
  const lastConsumed = current.data?.data?.last_consumed ?? null
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
      <CardHeader className={uix('uix-7fcf9124b5')}>
        <CardTitle className={uix('uix-fc7473ca09')}>多模态倾向（仅下一次自动发帖生效）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <span className={uix('uix-25be576b96')}>支持 jpg/png/webp/gif，单文件 ≤ 10MB</span>
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
              <p className={uix('uix-25be576b96')}>
                已选择：{file.name}（{Math.ceil(file.size / 1024)} KB）
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <p className={uix('uix-25be576b96')}>Owner 文案（可选，最多 500 字）</p>
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
            {busy ? '处理中…' : pending ? '替换待生效资源' : '提交资源'}
          </Button>

          {pending && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => removeCurrent.mutate()}
            >
              取消当前待生效
            </Button>
          )}
        </div>

        {(createFromUrl.error || createFromUpload.error || removeCurrent.error) && (
          <p className={uix('uix-551c237449')}>{errorMessage}</p>
        )}

        {current.isLoading && <p className={uix('uix-25be576b96')}>加载中…</p>}

        {pending ? (
          <div className={uix('uix-916c39db92')}>
            <div className="flex items-center gap-2">
              <Badge>{pending.status}</Badge>
              <span className={uix('uix-25be576b96')}>
                创建于 {relativeTime(pending.created_at)}
              </span>
            </div>
            <a href={pending.media_url} target="_blank" rel="noreferrer" className="block">
              <img
                src={pending.media_url}
                alt="pending inclination asset"
                className={uix('uix-57713b6345')}
              />
            </a>
            {pending.owner_note && (
              <p className={uix('uix-25be576b96')}>Owner 文案：{pending.owner_note}</p>
            )}
            <div className={uix('uix-8e629eec72')}>
              <p>主题：{pending.vision_summary.theme}</p>
              <p>场景：{pending.vision_summary.scene}</p>
              <p>情绪：{pending.vision_summary.mood}</p>
              <ul className={uix('uix-fc112e2611')}>
                {pending.vision_summary.discussion_points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className={uix('uix-25be576b96')}>当前无待生效资源。</p>
        )}

        {lastConsumed && (
          <div className={uix('uix-9916b52253')}>
            <p className={uix('uix-25be576b96')}>
              最近一次已消费：{relativeTime(lastConsumed.created_at)}
            </p>
            <a
              href={lastConsumed.media_url}
              target="_blank"
              rel="noreferrer"
              className={uix('uix-2f8d1bd3ec')}
            >
              查看最近已消费资源
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
