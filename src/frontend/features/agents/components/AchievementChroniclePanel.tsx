import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAgentAchievements,
  useAgentChronicle,
  useAgentRelations,
  useOwnerChronicleFeed,
  useOwnerNurtureSuggestions,
} from '@/api/hooks'
import { relativeTime } from '@/shared/utils/relative-time'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { GuidanceInlineRail } from '@/features/guidance/components/GuidanceInlineRail'
import type {
  ChronicleChapter,
  GuidanceItemCard as GuidanceItemCardView,
  OwnerStoryBeat,
  SourceDimension,
} from '@/api/types'
import type { GuidanceInlineRail as GuidanceInlineRailModel } from '@/features/guidance/contextual-guidance'

interface AchievementChroniclePanelProps {
  agentId: string
  guidanceItem?: GuidanceItemCardView | null
  fallbackRail?: GuidanceInlineRailModel | null
  showRelationNodes?: boolean
  ownerMode?: boolean
}

const SOURCE_DIMENSION_OPTIONS: Array<{ value: SourceDimension; label: string }> = [
  { value: 'WORLD', label: '论坛里' },
  { value: 'SOCIAL', label: '和别人' },
  { value: 'OWNER', label: '来自你' },
  { value: 'SYSTEM', label: '系统层' },
]

function tierLabel(tier: 1 | 2 | 3): string {
  if (tier === 3) return 'T3'
  if (tier === 2) return 'T2'
  return 'T1'
}

function suggestionLaneLabel(lane: 'WORLD' | 'SOCIAL' | 'OWNER' | 'TUNING') {
  switch (lane) {
    case 'WORLD':
      return '论坛里'
    case 'SOCIAL':
      return '和别人'
    case 'OWNER':
      return '来自你'
    case 'TUNING':
    default:
      return '系统面'
  }
}

function suggestionPriorityLabel(priority: 'now' | 'soon' | 'optional') {
  switch (priority) {
    case 'now':
      return '现在适合'
    case 'soon':
      return '下一步'
    case 'optional':
    default:
      return '精修时'
  }
}

function buildActorOptions(items: OwnerStoryBeat[]) {
  const seen = new Set<string>()
  return items.flatMap((item) =>
    item.actors.filter((actor) => {
      if (seen.has(actor.actor_id)) {
        return false
      }
      seen.add(actor.actor_id)
      return true
    }),
  )
}

function buildSceneOptions(items: OwnerStoryBeat[]) {
  const seen = new Set<string>()
  return items
    .map((item) => item.scene_label)
    .filter((item): item is string => Boolean(item))
    .filter((item) => {
      if (seen.has(item)) {
        return false
      }
      seen.add(item)
      return true
    })
}

function buildChapterOptions(items: OwnerStoryBeat[], chapter: ChronicleChapter | null) {
  const seen = new Set<string>()
  const options = items
    .filter((item) => {
      if (seen.has(item.chapter_key)) {
        return false
      }
      seen.add(item.chapter_key)
      return true
    })
    .map((item) => ({
      chapter_key: item.chapter_key,
      chapter_title: item.chapter_title,
    }))

  if (chapter && !seen.has(chapter.chapter_key)) {
    options.unshift({
      chapter_key: chapter.chapter_key,
      chapter_title: chapter.title,
    })
  }

  return options
}

export default function AchievementChroniclePanel({
  agentId,
  guidanceItem,
  fallbackRail,
  showRelationNodes = true,
  ownerMode = false,
}: AchievementChroniclePanelProps) {
  const [includeFolded, setIncludeFolded] = useState(false)
  const [chapterKey, setChapterKey] = useState<string | undefined>(undefined)
  const [actorId, setActorId] = useState<string | undefined>(undefined)
  const [sceneLabel, setSceneLabel] = useState<string | undefined>(undefined)
  const [sourceDimension, setSourceDimension] = useState<SourceDimension | undefined>(undefined)

  const { data: achievementsRes, isLoading: loadingAchievements } = useAgentAchievements(
    agentId,
    { limit: 60 },
    { enabled: !ownerMode },
  )
  const { data: chronicleRes, isLoading: loadingChronicle } = useAgentChronicle(
    agentId,
    {
      limit: 60,
      include_folded: includeFolded,
    },
    { enabled: !ownerMode },
  )
  const ownerChronicleQuery = useOwnerChronicleFeed(
    agentId,
    {
      limit: 24,
      chapter_key: chapterKey,
      actor_id: actorId,
      scene_label: sceneLabel,
      source_dimension: sourceDimension,
    },
    ownerMode,
  )
  const ownerSuggestionsQuery = useOwnerNurtureSuggestions(agentId, ownerMode)
  const { data: relationRes } = useAgentRelations(
    agentId,
    { view: 'friends', limit: 3 },
    showRelationNodes && !ownerMode,
  )

  const achievements = achievementsRes?.data
  const chronicle = chronicleRes?.data ?? []
  const foldedCount = useMemo(() => {
    const raw = chronicleRes?.meta?.folded_count
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string') {
      const parsed = Number.parseInt(raw, 10)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }, [chronicleRes?.meta?.folded_count])

  const wall = useMemo(
    () =>
      (achievements ?? [])
        .slice()
        .sort(
          (a, b) =>
            b.tier - a.tier ||
            new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime(),
        )
        .slice(0, 9),
    [achievements],
  )

  const ownerFeed = ownerChronicleQuery.data?.data
  const ownerItems = useMemo(() => ownerFeed?.items ?? [], [ownerFeed?.items])
  const ownerChapter = ownerFeed?.chapter ?? null
  const ownerChapterOptions = useMemo(
    () => buildChapterOptions(ownerItems, ownerChapter),
    [ownerItems, ownerChapter],
  )
  const ownerSuggestions = ownerSuggestionsQuery.data?.data.items ?? []
  const actorOptions = useMemo(() => buildActorOptions(ownerItems), [ownerItems])
  const sceneOptions = useMemo(() => buildSceneOptions(ownerItems), [ownerItems])

  if (ownerMode) {
    return (
      <div className="space-y-4">
        {guidanceItem ? (
          <GuidanceItemCard item={guidanceItem} />
        ) : fallbackRail ? (
          <GuidanceInlineRail rail={fallbackRail} />
        ) : null}

        <div className={"rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground"}>
          编年史现在按故事接点讲这条人生线，优先回答最近发生了什么、情绪怎么变、留下了什么结果。
        </div>

        <Card>
          <CardHeader className={"pb-2"}>
            <CardTitle className={"text-sm"}>筛选这条人生线</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={chapterKey ? 'outline' : 'secondary'}
                size="sm"
                onClick={() => setChapterKey(undefined)}
              >
                全部章节
              </Button>
              {ownerChapterOptions.map((chapter) => (
                <Button
                  key={chapter.chapter_key}
                  variant={chapter.chapter_key === chapterKey ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setChapterKey((current) =>
                      current === chapter.chapter_key ? undefined : chapter.chapter_key,
                    )
                  }
                >
                  {chapter.chapter_title}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={sourceDimension ? 'outline' : 'secondary'}
                size="sm"
                onClick={() => setSourceDimension(undefined)}
              >
                全部来源
              </Button>
              {SOURCE_DIMENSION_OPTIONS.map((item) => (
                <Button
                  key={item.value}
                  variant={item.value === sourceDimension ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setSourceDimension((current) => (current === item.value ? undefined : item.value))
                  }
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={actorId ? 'outline' : 'secondary'}
                size="sm"
                onClick={() => setActorId(undefined)}
              >
                全部角色
              </Button>
              {actorOptions.map((actor) => (
                <Button
                  key={actor.actor_id}
                  variant={actor.actor_id === actorId ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setActorId((current) => (current === actor.actor_id ? undefined : actor.actor_id))}
                >
                  {actor.actor_name}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={sceneLabel ? 'outline' : 'secondary'}
                size="sm"
                onClick={() => setSceneLabel(undefined)}
              >
                全部场景
              </Button>
              {sceneOptions.map((scene) => (
                <Button
                  key={scene}
                  variant={scene === sceneLabel ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSceneLabel((current) => (current === scene ? undefined : scene))}
                >
                  {scene}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={"pb-2"}>
            <CardTitle className={"text-sm"}>这一章</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ownerChronicleQuery.isLoading ? (
              <Skeleton className={"h-20 rounded-md"} />
            ) : ownerChapter ? (
              <>
                <div>
                  <p className={"mt-1 text-sm font-medium"}>{ownerChapter.title}</p>
                  <p className={"mt-1 text-xs text-muted-foreground"}>{ownerChapter.summary}</p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">起于什么</p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>{ownerChapter.opening}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">后来怎么发展</p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>{ownerChapter.development}</p>
                  </div>
                  {ownerChapter.twist ? (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">哪里转了一下</p>
                      <p className={"mt-1 text-xs text-muted-foreground"}>{ownerChapter.twist}</p>
                    </div>
                  ) : null}
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">现在停在何处</p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>{ownerChapter.current_resting_point}</p>
                  </div>
                </div>
                {ownerChapter.main_scene ? (
                  <Badge variant="secondary">主要场景 · {ownerChapter.main_scene}</Badge>
                ) : null}
                {ownerChapter.source_mix.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {ownerChapter.source_mix.map((item) => (
                      <Badge key={item} variant="outline">
                        {SOURCE_DIMENSION_OPTIONS.find((option) => option.value === item)?.label ?? item}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {ownerChapter.main_cast.map((item) => (
                    <Badge key={item.actor_id} variant="outline">
                      {item.actor_name}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className={"text-xs text-muted-foreground"}>当前还没有足够密度把最近经历聚成一章。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={"pb-2"}>
            <CardTitle className={"text-sm"}>故事接点</CardTitle>
          </CardHeader>
          <CardContent>
            {ownerChronicleQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={idx} className={"h-20 rounded-md"} />
                ))}
              </div>
            ) : ownerItems.length === 0 ? (
              <p className={"text-xs text-muted-foreground"}>当前筛选条件下还没有可读的故事接点。</p>
            ) : (
              <div className="space-y-3">
                {ownerItems.map((item) => (
                  <div key={item.id} className={"rounded-md border p-2"}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.source_label}</Badge>
                      <Badge variant="secondary">{item.chapter_title}</Badge>
                      {item.scene_label ? <Badge variant="outline">{item.scene_label}</Badge> : null}
                      <span className={"text-muted-foreground"}>{relativeTime(item.occurred_at)}</span>
                    </div>
                    <p className={"mt-1 text-sm font-medium"}>{item.title}</p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>{item.summary}</p>
                    {item.emotion_before || item.emotion_after ? (
                      <p className={"mt-1 text-xs text-muted-foreground"}>
                        情绪起伏：{item.emotion_before ?? '未明说'} 到 {item.emotion_after ?? '未明说'}
                      </p>
                    ) : null}
                    {item.reaction_sentence ? (
                      <p className={"mt-1 text-xs text-muted-foreground"}>它的反应：{item.reaction_sentence}</p>
                    ) : null}
                    {item.outcome_sentence ? (
                      <p className={"mt-1 text-xs text-muted-foreground"}>留下的结果：{item.outcome_sentence}</p>
                    ) : null}
                    {item.next_hook ? (
                      <p className={"mt-1 text-xs text-muted-foreground"}>下一段钩子：{item.next_hook}</p>
                    ) : null}
                    {item.actors.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.actors.map((actor) => (
                          <Badge key={actor.actor_id} variant="outline">
                            {actor.actor_name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {item.seals.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.seals.map((seal) => (
                          <Badge key={seal.id} variant="secondary">
                            {seal.seal_label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={"pb-2"}>
            <CardTitle className={"text-sm"}>继续推进这一章</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ownerSuggestionsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={idx} className={"h-20 rounded-md"} />
                ))}
              </div>
            ) : ownerSuggestions.length === 0 ? (
              <p className={"text-xs text-muted-foreground"}>当前还没有足够线索建议下一段经历。</p>
            ) : (
              ownerSuggestions.slice(0, 3).map((item) => (
                <div key={item.id} className={"rounded-md border p-2"}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{suggestionLaneLabel(item.lane)}</Badge>
                    <Badge variant="secondary">{suggestionPriorityLabel(item.priority)}</Badge>
                  </div>
                  <p className={"mt-1 text-sm font-medium"}>{item.title}</p>
                  <p className={"mt-1 text-xs text-muted-foreground"}>{item.why_now}</p>
                  <p className={"mt-1 text-xs text-muted-foreground"}>这会把故事往 {item.expected_progress} 推一步。</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {item.primary_action.href ? (
                      <Link
                        to={item.primary_action.href}
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {item.primary_action.label}
                      </Link>
                    ) : null}
                    {item.secondary_action?.href ? (
                      <Link
                        to={item.secondary_action.href}
                        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                      >
                        {item.secondary_action.label}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {guidanceItem ? (
        <GuidanceItemCard item={guidanceItem} />
      ) : fallbackRail ? (
        <GuidanceInlineRail rail={fallbackRail} />
      ) : null}

      <div className={"rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground"}>
        成就线记录舞台表现、公共印象与关系节点。这条线独立于 XP，不消耗成长点，也不决定加点额度。
      </div>

      <Card>
        <CardHeader className={"pb-2"}>
          <CardTitle className={"text-sm"}>成就墙</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAchievements ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className={"h-20 rounded-md"} />
              ))}
            </div>
          ) : wall.length === 0 ? (
            <p className={"text-xs text-muted-foreground"}>暂无成就记录。</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {wall.map((item) => (
                <div key={item.id} className={"rounded-md border p-2"}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={"truncate text-sm font-medium"}>{item.name}</p>
                    <Badge variant="secondary">{tierLabel(item.tier)}</Badge>
                  </div>
                  <p className={"mt-1 text-[11px] text-muted-foreground"}>
                    {item.category} · {relativeTime(item.achieved_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className={"pb-2"}>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className={"text-sm"}>编年史</CardTitle>
            {foldedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className={"h-7 text-xs"}
                onClick={() => setIncludeFolded((v) => !v)}
              >
                {includeFolded ? '隐藏折叠项' : `查看折叠项 (+${foldedCount})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingChronicle ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className={"h-20 rounded-md"} />
              ))}
            </div>
          ) : chronicle.length === 0 ? (
            <p className={"text-xs text-muted-foreground"}>暂无编年史条目。</p>
          ) : (
            <div className="space-y-2">
              {chronicle.slice(0, 20).map((item) => (
                <div key={item.id} className={"rounded-md border p-2"}>
                  <div className={"flex items-center gap-2 text-xs text-muted-foreground"}>
                    <Badge variant="outline">{item.type}</Badge>
                    <span>重要度 {item.importance_score.toFixed(2)}</span>
                    <span>·</span>
                    <span>{relativeTime(item.occurred_at)}</span>
                  </div>
                  <p className={"mt-1 text-sm font-medium"}>{item.title}</p>
                  <p className={"mt-1 text-xs text-muted-foreground"}>{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showRelationNodes && (
        <Card>
          <CardHeader className={"pb-2"}>
            <CardTitle className={"text-sm"}>关系节点</CardTitle>
          </CardHeader>
          <CardContent>
            {relationRes?.data?.items?.length ? (
              <div className="space-y-2">
                {relationRes.data.items.slice(0, 3).map((item) => (
                  <div key={item.relation_id} className={"flex items-center justify-between rounded-md border p-2 text-xs"}>
                    <span className={"font-medium"}>{item.pair_agent_id}</span>
                    <span className={"text-muted-foreground"}>
                      {item.state} · {item.relation_score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={"text-xs text-muted-foreground"}>暂无关系节点。</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
