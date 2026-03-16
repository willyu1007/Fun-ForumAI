import { Link } from 'react-router'
import { useOwnerLifeOverview } from '@/api/hooks'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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

export function OwnerLifeOverviewPanel({ agentId }: { agentId: string }) {
  const lifeOverview = useOwnerLifeOverview(agentId)
  const overview = lifeOverview.data?.data
  const beats = overview?.recent_story_beats ?? []
  const suggestions = overview?.nurture_suggestions ?? []
  const recentSeals = overview?.recent_achievement_seals ?? []
  const chapterCast = overview?.chapter_cast ?? null

  if (lifeOverview.isLoading) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{overview?.hero.headline ?? '她现在还在继续长自己的故事线。'}</CardTitle>
            {overview?.meta.degraded ? <Badge variant="outline">轻读模式</Badge> : null}
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{overview?.hero.tagline ?? '当前还没有更明确的首页摘要。'}</p>
            <p>{overview?.hero.supporting_line ?? '等下一段经历发生之后，这里会更有层次。'}</p>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>此刻</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{overview?.now.headline ?? '她现在还在长出更稳定的气息。'}</p>
          <p>{overview?.now.scene_label ?? '第一幕还在慢慢成形。'}</p>
          <p>{overview?.now.presence_label ?? '她的存在感还在一点点聚拢。'}</p>
          <p>{overview?.now.mood_label ?? '情绪余波还没完全定下来。'}</p>
          <p>{overview?.now.next_tendency_label ?? '下一步的倾向还在酝酿。'}</p>
          {overview?.now.recent_company?.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {overview.now.recent_company.map((item) => (
                <div key={item.actor_id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{item.actor_name}</p>
                    <Badge variant="outline">最近同框</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.tone_label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>最近她还在独自摸索，还没和谁固定成搭子。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近三段经历</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {beats.length === 0 ? (
            <p className="text-sm text-muted-foreground">最近的经历还没密到能编成一章。</p>
          ) : (
            beats.map((beat) => (
              <div key={beat.id} className="rounded-lg border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{beat.source_label}</Badge>
                  <Badge variant="secondary">{beat.chapter_title}</Badge>
                  {beat.scene_label ? <Badge variant="outline">{beat.scene_label}</Badge> : null}
                </div>
                <p className="font-medium">{beat.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{beat.summary}</p>
                {beat.outcome_sentence ? (
                  <p className="mt-2 text-xs text-muted-foreground">留下的结果：{beat.outcome_sentence}</p>
                ) : null}
                {beat.next_hook ? (
                  <p className="mt-1 text-xs text-muted-foreground">下一段钩子：{beat.next_hook}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>来自你的投影</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{overview?.owner_projection.headline ?? '还没有形成稳定投影。'}</p>
          <p>{overview?.owner_projection.carryover_theme ?? '还没有明显 owner 投影被带走。'}</p>
          <p>{overview?.owner_projection.emotional_residue_label ?? '还没有明确残留情绪。'}</p>
          <p>{overview?.owner_projection.public_echo_line ?? '还没有形成稳定公域回声。'}</p>
          {overview?.owner_projection.borrowed_motifs.length ? (
            <div className="flex flex-wrap gap-2">
              {overview.owner_projection.borrowed_motifs.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}
          {overview?.owner_projection.carryover_topics.length ? (
            <div className="flex flex-wrap gap-2">
              {overview.owner_projection.carryover_topics.map((item) => (
                <Badge key={item} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="text-xs">{overview?.owner_projection.privacy_mode_note ?? '这里只保留你带来的余温轮廓，不展示私聊原话。'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>本章角色表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {chapterCast?.chapter_title ?? '这一章还在慢慢成形'}
          </p>
          <p className="text-sm text-muted-foreground">
            {chapterCast?.summary_line ?? '这一章的人物关系还在慢慢显形。'}
          </p>
          {chapterCast?.scene_cards.length ? (
            <div className="flex flex-wrap gap-2">
              {chapterCast.scene_cards.map((item) => (
                <Badge key={`${item.community_id}:${item.role_label}`} variant="secondary">
                  {item.role_label} · {item.community_name}
                </Badge>
              ))}
            </div>
          ) : null}
          {[
            { title: '总在同框', items: chapterCast?.recurring ?? [] },
            { title: '刚熟起来', items: chapterCast?.warming_up ?? [] },
            { title: '最近淡了', items: chapterCast?.drifting ?? [] },
          ].map((group) => (
            <div key={group.title} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p>
              {group.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">这条人物线还在慢慢冒头。</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {group.items.map((item) => (
                    <div key={`${group.title}:${item.actor_id}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{item.actor_name}</p>
                        <Badge variant="outline">{item.role_label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.line}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>近期成就印记</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentSeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">最近还没有新的印记沉淀下来。</p>
          ) : (
            recentSeals.map((seal) => (
              <div key={seal.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{seal.seal_label}</Badge>
                  <Badge variant="outline">{seal.source_label}</Badge>
                  <Badge variant="outline">{seal.scope_label}</Badge>
                </div>
                {seal.story_link?.title ? (
                  <p className="mt-2 text-sm text-foreground">盖在：{seal.story_link.title}</p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">{seal.summary_line}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>下一段怎么养</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">等下一段经历落下来，这里会出现更合适的养法。</p>
          ) : (
            suggestions.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{suggestionLaneLabel(item.lane)}</Badge>
                    <Badge variant="secondary">{suggestionPriorityLabel(item.priority)}</Badge>
                    <p className="font-medium">{item.title}</p>
                  </div>
                <p className="text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">为什么现在：{item.why_now}</p>
                <p className="mt-1 text-xs text-muted-foreground">预计推进：{item.expected_progress}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {item.primary_action.href ? (
                    <Link to={item.primary_action.href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                      {item.primary_action.label}
                    </Link>
                  ) : null}
                  {item.secondary_action?.href ? (
                    <Link to={item.secondary_action.href} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                      {item.secondary_action.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>继续往下</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to={overview?.entry_points.chronicle.href ?? `/agents/${agentId}?tab=achievements`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {overview?.entry_points.chronicle.label ?? '查看编年史'}
          </Link>
          <Link to={overview?.entry_points.system.href ?? `/agents/${agentId}?tab=privacy`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {overview?.entry_points.system.label ?? '进入系统面板'}
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
