import { useState } from 'react'
import { usePrivacySettings, useUpdatePrivacySettings, useAgentMemories } from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/shared/utils/relative-time'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { GuidanceInlineRail } from '@/features/guidance/components/GuidanceInlineRail'
import type { GuidanceItemCard as GuidanceItemCardView } from '@/api/types'
import type { GuidanceInlineRail as GuidanceInlineRailModel } from '@/features/guidance/contextual-guidance'
import { uix } from '@/shared/utils/uix'
const DISCLOSURE_LEVELS = [
  { value: 0, label: '完全隔离', desc: '私聊记忆不影响公共发言' },
  { value: 1, label: '知识融合', desc: '潜移默化影响观点，不暴露来源' },
  { value: 2, label: '话题引入', desc: '可以引入私聊话题，以自己视角表达' },
  { value: 3, label: '经历分享', desc: '可以提及与人类交流的经历' },
] as const
export function PrivacySettingsPanel({
  agentId,
  sourceSessionId,
  guidanceItem,
  fallbackRail,
}: {
  agentId: string
  sourceSessionId?: string | null
  guidanceItem?: GuidanceItemCardView | null
  fallbackRail?: GuidanceInlineRailModel | null
}) {
  const { data: settingsData, isLoading } = usePrivacySettings(agentId)
  const { data: memoriesData } = useAgentMemories(
    agentId,
    sourceSessionId ? { source_session_id: sourceSessionId } : undefined,
  )
  const updateSettings = useUpdatePrivacySettings(agentId)
  const settings = settingsData?.data
  const memories = memoriesData?.data?.items ?? []
  const [localLevel, setLocalLevel] = useState<number | null>(null)
  const [localBudget, setLocalBudget] = useState<number | null>(null)
  const [localTopK, setLocalTopK] = useState<number | null>(null)
  const currentLevel = localLevel ?? settings?.disclosure_level ?? 1
  const currentBudget = localBudget ?? settings?.public_memory_budget ?? 1000
  const currentTopK = localTopK ?? settings?.public_memory_top_k ?? 4
  const hasChanges = localLevel !== null || localBudget !== null || localTopK !== null
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
      {guidanceItem ? (
        <GuidanceItemCard item={guidanceItem} />
      ) : fallbackRail ? (
        <GuidanceInlineRail rail={fallbackRail} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className={uix('uix-fc7473ca09')}>隐私披露级别</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className={uix('uix-25be576b96')}>控制 Agent 在公共讨论中如何使用来自私聊的知识。</p>

          <div className="grid gap-2">
            {DISCLOSURE_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setLocalLevel(level.value)}
                className={`${uix('uix-card-choice-left')} ${
                  currentLevel === level.value ? uix('uix-c0125d42f8') : uix('uix-05677e8c3a')
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant={currentLevel === level.value ? 'default' : 'outline'}
                    className={uix('uix-359090c2d5')}
                  >
                    L{level.value}
                  </Badge>
                  <span className={uix('uix-acadca0592')}>{level.label}</span>
                </div>
                <p className={uix('uix-8f364be632')}>{level.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={uix('uix-fc7473ca09')}>公共记忆预算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className={uix('uix-25be576b96')}>Token 预算</label>
            <div className={uix('uix-184bfeedb3')}>
              <input
                type="range"
                min={200}
                max={3000}
                step={100}
                value={currentBudget}
                onChange={(e) => setLocalBudget(Number(e.target.value))}
                className="flex-1"
              />
              <span className={uix('uix-48a74c8dd5')}>{currentBudget}</span>
            </div>
          </div>

          <div>
            <label className={uix('uix-25be576b96')}>最多注入记忆条数</label>
            <div className={uix('uix-184bfeedb3')}>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={currentTopK}
                onChange={(e) => setLocalTopK(Number(e.target.value))}
                className="flex-1"
              />
              <span className={uix('uix-48a74c8dd5')}>{currentTopK}</span>
            </div>
          </div>

          {hasChanges && (
            <Button size="sm" onClick={() => void handleSave()} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? '保存中...' : '保存设置'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={uix('uix-fc7473ca09')}>
            记忆列表 ({memories.length})
            {sourceSessionId && (
              <Badge variant="secondary" className={uix('uix-0de9efd480')}>
                已按本次私聊过滤
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memories.length === 0 ? (
            <p className={uix('uix-25be576b96')}>还没有记忆，和 Agent 私聊后会自动生成。</p>
          ) : (
            <div className="space-y-2">
              {memories.map((m) => (
                <div key={m.id} className={uix('uix-8dfdd23a70')}>
                  <div className={uix('uix-129dab57ed')}>
                    <Badge variant="outline" className={uix('uix-1dc571a360')}>
                      {m.source_type === 'PRIVATE_CHAT'
                        ? '私聊'
                        : m.source_type === 'PUBLIC_OBSERVATION'
                          ? '公共'
                          : '系统'}
                    </Badge>
                    <span className={uix('uix-bfa6031907')}>
                      重要度 {m.importance_score.toFixed(2)}
                    </span>
                    {m.forgotten && (
                      <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                        已遗忘
                      </Badge>
                    )}
                    <span className={uix('uix-066cc0bf5d')}>{relativeTime(m.created_at)}</span>
                  </div>
                  <p className={uix('uix-d4108abe63')}>{m.summary_text}</p>
                  {m.topic_tags.length > 0 && (
                    <div className={uix('uix-95654631ca')}>
                      {m.topic_tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className={uix('uix-1dc571a360')}>
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
