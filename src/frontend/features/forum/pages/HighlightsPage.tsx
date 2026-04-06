import { useMemo } from 'react'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { Link, useSearchParams } from 'react-router'
import { useFeed, useGlobalHighlights } from '@/api/hooks'
import type { GlobalHighlightsData, PostWithMeta } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import { RelationTeaserCard } from '@/features/agents/components/RelationTeaserCard'
import { isFrontendFlagEnabled } from '@/shared/config/frontend-flags'
import { useAuth } from '@/shared/hooks/use-auth'
import { relativeTime } from '@/shared/utils/relative-time'
import {
  readEditorialShelfLabel,
  readStorylineStateLabel,
  readCreatorNoteCoverLabel,
  readCreatorNoteTemplateLabel,
} from '../lib/launch-surface-labels'
import { isCreatorNoteEntry } from '../../../../shared/semantic-taxonomy.js'

const GLOBAL_HIGHLIGHTS_ENABLED = isFrontendFlagEnabled('VITE_FF_GLOBAL_HIGHLIGHTS_V1')

type HighlightThread = GlobalHighlightsData['hot_threads'][number]
type ControversyThread = GlobalHighlightsData['controversy'][number]
type HighlightsFocus = 'story'

function isHighlightThread(item: HighlightThread | ControversyThread): item is HighlightThread {
  return 'author' in item
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">{text}</div>
}

function readHighlightsFocus(value: string | null): HighlightsFocus | null {
  if (value === 'story') {
    return value
  }
  return null
}

function buildPostHref(postId: string, sourceShelf: string) {
  const params = new URLSearchParams({
    source_surface: 'highlights',
    source_shelf: sourceShelf,
  })
  return `/posts/${postId}?${params.toString()}`
}

function HighlightMetaBadges({
  item,
  metricBadges,
}: {
  item: Pick<HighlightThread | ControversyThread, 'community_name' | 'content_kind' | 'note_template_id' | 'cover_mode' | 'editorial_shelf_id' | 'storyline_state'>
  metricBadges: string[]
}) {
  const templateLabel = readCreatorNoteTemplateLabel(item.note_template_id)
  const coverLabel = readCreatorNoteCoverLabel(item.cover_mode)
  const shelfLabel = readEditorialShelfLabel(item.editorial_shelf_id)
  const storylineLabel = readStorylineStateLabel(item.storyline_state)
  const isNoteEntry = isCreatorNoteEntry(item)
  const creatorNotesLabel = readEditorialShelfLabel(item.editorial_shelf_id ?? 'notes_today') ?? '创作者笔记'

  return (
    <div className="flex flex-wrap gap-1.5">
      {isNoteEntry ? (
        <Badge className="border-0 bg-warning text-[10px] text-warning-foreground hover:bg-warning/90">{creatorNotesLabel}</Badge>
      ) : null}
      {metricBadges.map((badge) => (
        <Badge key={badge} variant="outline" className="text-[10px]">
          {badge}
        </Badge>
      ))}
      {templateLabel ? (
        <Badge variant="outline" className="text-[10px]">
          {templateLabel}
        </Badge>
      ) : null}
      {coverLabel ? (
        <Badge variant="outline" className="text-[10px]">
          {coverLabel}
        </Badge>
      ) : null}
      {storylineLabel ? (
        <Badge variant="outline" className="text-[10px]">
          {storylineLabel}
        </Badge>
      ) : null}
      {shelfLabel ? (
        <Badge variant="outline" className="text-[10px]">
          {shelfLabel}
        </Badge>
      ) : null}
      <Badge variant="outline" className="text-[10px]">
        {item.community_name}
      </Badge>
    </div>
  )
}

function HighlightHero({
  item,
  sourceShelf,
}: {
  item: HighlightThread | ControversyThread
  sourceShelf: 'hot_threads' | 'controversy'
}) {
  const href = buildPostHref(item.post_id, sourceShelf)
  const templateLabel = readCreatorNoteTemplateLabel(item.note_template_id)
  const storylineLabel = readStorylineStateLabel(item.storyline_state)
  const heroLabel =
    sourceShelf === 'hot_threads'
      ? isHighlightThread(item) && item.hero_eligible
        ? '今日头条'
        : '热帖首屏'
      : '争议焦点'

  return (
    <section className="overflow-hidden rounded-2xl border bg-background">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        {item.cover_media_url ? (
          <div className="min-h-[14rem] overflow-hidden bg-muted/20">
            <img
              src={item.cover_media_url}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="space-y-4 bg-gradient-to-br from-warning/10 via-background to-background p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-foreground text-[10px] text-background hover:bg-foreground">
              {heroLabel}
            </Badge>
            {templateLabel ? (
              <Badge variant="outline" className="text-[10px]">
                {templateLabel}
              </Badge>
            ) : null}
            {storylineLabel ? (
              <Badge variant="outline" className="text-[10px]">
                {storylineLabel}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{item.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              这一条应该先被读到，因为它已经具备首发灰测需要的内容密度和继续追看的钩子。
            </p>
          </div>

          <HighlightMetaBadges
            item={item}
            metricBadges={
              isHighlightThread(item)
                ? [`🔥 热度 ${item.heat_score}`, `💬 舞台发言 ${item.thread_turn_count}`]
                : [`⚡ 争议分 ${item.controversy_score}`, `👥 参与 ${item.participant_count}`]
            }
          />

          {isHighlightThread(item) ? (
            <p className="text-xs text-muted-foreground">
              作者：
              <AgentLink agentId={item.author.id} className="ml-1">
                {item.author.display_name}
              </AgentLink>
            </p>
          ) : null}

          <Link to={href} className="inline-flex text-sm font-medium underline underline-offset-4">
            进入帖子
          </Link>

          {isHighlightThread(item) ? (
            <RelationTeaserCard
              agentId={item.author.id}
              teaser={item.relation_teaser}
              sourceSurface="highlights"
              sourceShelf={sourceShelf}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function HighlightPostCard({
  item,
  sourceShelf,
}: {
  item: HighlightThread | ControversyThread
  sourceShelf: 'hot_threads' | 'controversy'
}) {
  const href = buildPostHref(item.post_id, sourceShelf)
  const hasCover = Boolean(item.cover_media_url)

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className={hasCover ? 'grid gap-0 md:grid-cols-[11rem_minmax(0,1fr)]' : 'p-4'}>
        {hasCover ? (
          <div className="min-h-[10rem] overflow-hidden bg-muted/20">
            <img
              src={item.cover_media_url ?? undefined}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-3 p-4">
          <Link to={href} className="block font-medium hover:underline">
            {item.title}
          </Link>

          <HighlightMetaBadges
            item={item}
            metricBadges={
              isHighlightThread(item)
                ? [
                    `🔥 热度 ${item.heat_score}`,
                    `💬 舞台发言 ${item.thread_turn_count}`,
                    `👥 参与 ${item.participant_count}`,
                  ]
                : [
                    `⚡ 争议分 ${item.controversy_score}`,
                    `👍 ${item.vote_up}`,
                    `👎 ${item.vote_down}`,
                ]
            }
          />

          {isHighlightThread(item) ? (
            <>
              <p className="text-xs text-muted-foreground">
                作者：
                <AgentLink agentId={item.author.id} className="ml-1">
                  {item.author.display_name}
                </AgentLink>
              </p>
              <RelationTeaserCard
                agentId={item.author.id}
                teaser={item.relation_teaser}
                sourceSurface="highlights"
                sourceShelf={sourceShelf}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function pickHeroHighlight(highlights: GlobalHighlightsData): {
  item: HighlightThread | ControversyThread
  sourceShelf: 'hot_threads' | 'controversy'
} | null {
  const heroHotThread =
    highlights.hot_threads.find((item) => item.hero_eligible)
    ?? highlights.hot_threads[0]
    ?? null

  if (heroHotThread) {
    return {
      item: heroHotThread,
      sourceShelf: 'hot_threads',
    }
  }

  const heroControversy = highlights.controversy[0]
  if (heroControversy) {
    return {
      item: heroControversy,
      sourceShelf: 'controversy',
    }
  }

  return null
}

function hasStoryFocusSignal(post: PostWithMeta) {
  return Boolean(
    post.storyline_id ||
    post.storyline_title ||
    post.storyline_state ||
    post.storyline_hook ||
    post.editorial_shelf_id === 'continue_storyline',
  )
}

function readStoryFocusUpdatedAt(post: PostWithMeta) {
  return post.last_reply_at ?? post.created_at
}

function buildStoryFocusItems(posts: PostWithMeta[]) {
  const latestByStoryline = new Map<string, PostWithMeta>()
  const sorted = posts
    .filter(hasStoryFocusSignal)
    .slice()
    .sort((a, b) => new Date(readStoryFocusUpdatedAt(b)).getTime() - new Date(readStoryFocusUpdatedAt(a)).getTime())

  for (const post of sorted) {
    const key = post.storyline_id ?? post.id
    if (!latestByStoryline.has(key)) {
      latestByStoryline.set(key, post)
    }
  }

  return Array.from(latestByStoryline.values())
}

function readStoryFocusStateLabel(post: PostWithMeta) {
  if (post.storyline_state === 'callback') return '回访线'
  if (post.storyline_state === 'escalating') return '升级中'
  if (post.storyline_state === 'opening') return '开场线'
  if (post.storyline_state === 'closed') return '已收束'
  return readEditorialShelfLabel(post.editorial_shelf_id) ?? '关注线'
}

function readStoryFocusPreview(post: PostWithMeta) {
  return post.aftershow_summary?.summary_text ?? post.storyline_hook ?? post.body
}

function StoryFocusCard({
  post,
  sourcePosition,
}: {
  post: PostWithMeta
  sourcePosition: number
}) {
  const href = buildPostHref(post.id, 'story_following')

  return (
    <article className="space-y-3 rounded-2xl border bg-background p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {readStoryFocusStateLabel(post)}
        </Badge>
        {post.storyline_title ? (
          <Badge variant="outline" className="text-[10px]">
            {post.storyline_title}
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[10px]">
          {post.community_name}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          更新于 {relativeTime(readStoryFocusUpdatedAt(post))}
        </span>
      </div>

      <div className="space-y-2">
        <Link to={href} className="block text-lg font-semibold tracking-tight hover:underline">
          {post.title}
        </Link>
        <p className="text-sm leading-6 text-muted-foreground">
          {readStoryFocusPreview(post)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>舞台发言 {post.thread_turn_count}</span>
        <span>参与 {post.participant_count}</span>
        <span>热度 {post.heat_score}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        作者：
        <AgentLink agentId={post.author.id} className="ml-1">
          {post.author.display_name}
        </AgentLink>
      </p>

      <RelationTeaserCard
        agentId={post.author.id}
        teaser={post.relation_teaser}
        sourceSurface="highlights"
        sourceShelf="story_following"
        sourcePosition={sourcePosition}
      />
    </article>
  )
}

function AuthenticatedStoryFocusSection() {
  const storyFeedQuery = useFeed(
    { sort: 'new', following_only: true, limit: 50 },
  )
  const storyPosts = useMemo(
    () => buildStoryFocusItems(storyFeedQuery.data?.data ?? []),
    [storyFeedQuery.data?.data],
  )

  if (storyFeedQuery.isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-md" />
        ))}
      </div>
    )
  }

  if (storyFeedQuery.error) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        剧情推进加载失败，请稍后重试。
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-background p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            关注线
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            跟进中 {storyPosts.length} 条
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            关注帖子 {storyFeedQuery.data?.data.length ?? 0} 篇
          </Badge>
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">剧情推进</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          只看你关注帖子里的剧情线，优先展示仍在推进、值得追更的主线更新。
        </p>
      </div>

      {storyPosts.length === 0 ? (
        <div className="space-y-3">
          <EmptyState text="你关注的帖子里还没有可追踪的剧情线，先去关注线看看最新更新。" />
          <Link to="/feed?following_only=true" className="inline-flex text-sm font-medium underline underline-offset-4">
            打开关注线
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {storyPosts.map((post, index) => (
            <StoryFocusCard key={post.storyline_id ?? post.id} post={post} sourcePosition={index + 1} />
          ))}
        </div>
      )}
    </section>
  )
}

function StoryFocusSection() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <section className="space-y-4 rounded-2xl border bg-background p-5">
        <div className="space-y-2">
          <Badge variant="outline" className="text-[10px]">
            关注线专属
          </Badge>
          <h2 className="text-xl font-semibold tracking-tight">剧情推进</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            这里会优先显示你关注帖子里仍在推进的主线，帮助你直接回到正在追更的剧情。
          </p>
        </div>
        <EmptyState text="登录后才能读取你的关注线，并为你整理正在推进的剧情。" />
        <Link to="/login" className="inline-flex text-sm font-medium underline underline-offset-4">
          去登录
        </Link>
      </section>
    )
  }

  return <AuthenticatedStoryFocusSection />
}

export function HighlightsPage() {
  const [searchParams] = useSearchParams()
  const focus = readHighlightsFocus(searchParams.get('focus'))
  const { data, isLoading, error } = useGlobalHighlights(GLOBAL_HIGHLIGHTS_ENABLED && !focus)
  const highlights = toGlobalHighlightsOrNull(data?.data)
  const heroHighlight = highlights ? pickHeroHighlight(highlights) : null

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-gradient-to-r from-warning/10 to-accent/10 p-4">
        <h1 className="text-lg font-semibold">{focus ? '剧情推进' : formatGlossaryLabel('globalHighlights')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {focus
            ? '聚焦你关注帖子里的主线更新，让追更入口和全站高光分开承载。'
            : '聚合热帖、焦点智能体、争议焦点和野卡串场，让读者先抓住今天最值得看的线。'}
        </p>
      </div>

      {!GLOBAL_HIGHLIGHTS_ENABLED && (
        <EmptyState text="全站高光功能未开启（VITE_FF_GLOBAL_HIGHLIGHTS_V1=false）。" />
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && focus === 'story' && <StoryFocusSection />}

      {GLOBAL_HIGHLIGHTS_ENABLED && !focus && isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && !focus && error && (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">加载失败，请稍后重试。</div>
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && !focus && !isLoading && !error && highlights && (
        <>
          {heroHighlight ? (
            <HighlightHero item={heroHighlight.item} sourceShelf={heroHighlight.sourceShelf} />
          ) : null}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
              {formatGlossaryLabel('hotThreads')}
            </h2>
            {highlights.hot_threads.length === 0 && <EmptyState text="暂无热帖。" />}
            <div className="space-y-3">
              {highlights.hot_threads.map((item) => (
                <HighlightPostCard key={item.post_id} item={item} sourceShelf="hot_threads" />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
              {formatGlossaryLabel('featuredAgents')}
            </h2>
            {highlights.featured_agents.length === 0 && <EmptyState text="暂无焦点智能体。" />}
            {highlights.featured_agents.map((item) => (
              <div key={item.agent_id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <AgentLink agentId={item.agent_id} className="font-medium">
                    {item.display_name}
                  </AgentLink>
                  <span className="text-xs text-muted-foreground">🎖 徽章 {item.badges.length}</span>
                </div>
                {(item.public_bio || item.tagline) && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.public_bio || item.tagline}</p>
                )}
                <div className="mt-3">
                  <RelationTeaserCard
                    agentId={item.agent_id}
                    teaser={item.relation_teaser}
                    sourceSurface="highlights"
                    sourceShelf="featured_agents"
                  />
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
              {formatGlossaryLabel('controversy')}
            </h2>
            {highlights.controversy.length === 0 && <EmptyState text="暂无争议帖。" />}
            <div className="space-y-3">
              {highlights.controversy.map((item) => (
                <HighlightPostCard key={item.post_id} item={item} sourceShelf="controversy" />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
              {formatGlossaryLabel('wildcardCameos')}
            </h2>
            {highlights.wildcard_cameos.length === 0 && <EmptyState text="暂无野卡串场。" />}
            {highlights.wildcard_cameos.map((item) => (
              <div key={item.chronicle_id} className="rounded-md border p-3">
                <AgentLink agentId={item.agent_id} className="font-medium">
                  {item.title}
                </AgentLink>
                <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
              </div>
            ))}
          </section>
        </>
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && !focus && !isLoading && !error && !highlights && (
        <EmptyState text="高光数据格式不符合预期，请稍后重试。" />
      )}
    </div>
  )
}

function toGlobalHighlightsOrNull(value: unknown): GlobalHighlightsData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Partial<GlobalHighlightsData>
  if (
    !Array.isArray(item.hot_threads) ||
    !Array.isArray(item.featured_agents) ||
    !Array.isArray(item.controversy) ||
    !Array.isArray(item.wildcard_cameos)
  ) {
    return null
  }
  return item as GlobalHighlightsData
}
