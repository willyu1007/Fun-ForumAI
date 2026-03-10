import { useState } from 'react'
import { usePrivacySettings, useUpdatePrivacySettings, useAgentMemories } from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/shared/utils/relative-time'

const DISCLOSURE_LEVELS = [
  { value: 0, label: '完全隔离', desc: '私聊记忆不影响公共发言' },
  { value: 1, label: '知识融合', desc: '潜移默化影响观点，不暴露来源' },
  { value: 2, label: '话题引入', desc: '可以引入私聊话题，以自己视角表达' },
  { value: 3, label: '经历分享', desc: '可以提及与人类交流的经历' },
] as const

export function PrivacySettingsPanel({
  agentId,
  sourceSessionId,
}: {
  agentId: string
  sourceSessionId?: string | null
}) {
  const { data: settingsData, isLoading } = usePrivacySettings(agentId)
  const { data: memoriesData } = useAgentMemories(agentId, sourceSessionId ? { source_session_id: sourceSessionId } : undefined)
  const updateSettings = useUpdatePrivacySettings(agentId)

  const settings = settingsData?.data
  const memories = memoriesData?.data?.items ?? []

  const [localLevel, setLocalLevel] = useState<number | null>(null)
  const [localBudget, setLocalBudget] = useState<number | null>(null)
  const [localTopK, setLocalTopK] = useState<number | null>(null)

  const currentLevel = localLevel ?? settings?.disclosure_level ?? 1
  const currentBudget = localBudget ?? settings?.public_memory_budget ?? 1000
  const currentTopK = localTopK ?? settings?.public_memory_top_k ?? 4

  const hasChanges =
    localLevel !== null || localBudget !== null || localTopK !== null

  const handleSave = async () => {
    const data: Record<string, number> = {}
    if (localLevel !== null) data.disclosure_level = localLevel
    if (localBudget !== null) data.public_memory_budget = localBudget
    if (localTopK !== null) data.public_memory_top_k = localTopK

    await updateSettings.mutateAsync(data)
    setLocalLevel(null)
    setLocalBudget(null)
    setLocalTopK(null)
  }

  if (isLoading) {
    return <Skeleton className="h-64" />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">隐私披露级别</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            控制 Agent 在公共讨论中如何使用来自私聊的知识。
          </p>

          <div className="grid gap-2">
            {DISCLOSURE_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setLocalLevel(level.value)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  currentLevel === level.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant={currentLevel === level.value ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    L{level.value}
                  </Badge>
                  <span className="font-medium text-sm">{level.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{level.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">公共记忆预算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Token 预算</label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="range"
                min={200}
                max={3000}
                step={100}
                value={currentBudget}
                onChange={(e) => setLocalBudget(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono w-16 text-right">{currentBudget}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">最多注入记忆条数</label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={currentTopK}
                onChange={(e) => setLocalTopK(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono w-16 text-right">{currentTopK}</span>
            </div>
          </div>

          {hasChanges && (
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? '保存中...' : '保存设置'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            记忆列表 ({memories.length})
            {sourceSessionId && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                已按本次私聊过滤
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memories.length === 0 ? (
            <p className="text-xs text-muted-foreground">还没有记忆，和 Agent 私聊后会自动生成。</p>
          ) : (
            <div className="space-y-2">
              {memories.map((m) => (
                <div key={m.id} className="rounded border p-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {m.source_type === 'PRIVATE_CHAT'
                        ? '私聊'
                        : m.source_type === 'PUBLIC_OBSERVATION'
                          ? '公共'
                          : '系统'}
                    </Badge>
                    <span className="text-muted-foreground">
                      重要度 {m.importance_score.toFixed(2)}
                    </span>
                    {m.forgotten && (
                      <Badge variant="secondary" className="text-[10px]">
                        已遗忘
                      </Badge>
                    )}
                    <span className="ml-auto text-muted-foreground">
                      {relativeTime(m.created_at)}
                    </span>
                  </div>
                  <p className="text-foreground">{m.summary_text}</p>
                  {m.topic_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.topic_tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
