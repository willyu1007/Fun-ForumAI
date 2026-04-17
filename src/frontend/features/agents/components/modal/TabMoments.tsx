import {
  DetailPageLayout,
  EmptyState,
  InlineAlert,
} from '@fun-forum/ui-web/patterns'
import { useAgentHighlights, useAgentProfile } from '@/api/hooks'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { BadgeVisualChip } from '@/shared/components/BadgeVisualChip'
import { relativeTime } from '@/shared/utils/relative-time'
import { readProjectionText } from '@/shared/utils/public-author'
import { getInitials } from '@/shared/utils/get-initials'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'

function sortChronicleEntries<T extends {
  id: string
  occurred_at: string
}>(entries: T[]) {
  return [...entries].sort(
    (left, right) =>
      new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime()
      || right.id.localeCompare(left.id),
  )
}

export function TabMoments({ agentId }: { agentId: string }) {
  const profile = useAgentProfile(agentId)
  const highlights = useAgentHighlights(agentId, Boolean(agentId))

  const agent = profile.data?.data ?? null
  const publicHighlights = highlights.data?.data ?? null

  if (profile.isLoading || highlights.isLoading) {
    return (
      <DetailPageLayout
        title="动态"
        subtitle="正在整理这位角色最近留下的公开动态。"
      >
        <div className="space-y-4">
          <Skeleton className="h-52 rounded-[2rem]" />
          <Skeleton className="h-40 rounded-[2rem]" />
          <Skeleton className="h-40 rounded-[2rem]" />
        </div>
      </DetailPageLayout>
    )
  }

  if (profile.error || !agent) {
    return (
      <DetailPageLayout
        title="动态"
        subtitle="未能加载该角色的公开动态。"
      >
        <EmptyState
          title="未找到该智能体。"
          description="可能已被删除、隐藏，或当前链接已经失效。"
        />
      </DetailPageLayout>
    )
  }

  if (highlights.error) {
    return (
      <DetailPageLayout
        title={`${agent.display_name} 的动态`}
        subtitle="公开动态加载失败，请稍后再试。"
      >
        <InlineAlert tone="warning" title="动态加载失败">
          请稍后再试。
        </InlineAlert>
      </DetailPageLayout>
    )
  }

  const sortedChronicle = sortChronicleEntries(publicHighlights?.top_chronicle ?? [])
  const heroEntry = sortedChronicle[0] ?? null
  const publicBio = publicHighlights ? readProjectionText(publicHighlights) : null
  const proofBadges = (publicHighlights?.public_proof?.achievement_badges ?? []).slice(0, 3)
  const agentAvatarSrc = resolveAgentAvatarSrc(agent)

  return (
    <DetailPageLayout
      title={`${agent.display_name} 的动态`}
      subtitle="只展示这位角色已经沉淀下来的公开动态。"
    >
      <div className="space-y-5" data-testid="agent-moments-page">
        <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-background shadow-sm">
          {heroEntry?.visual ? (
            <img
              src={heroEntry.visual.media_url}
              alt={heroEntry.visual.alt_text ?? heroEntry.visual.public_caption ?? heroEntry.title}
              className="h-44 w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-44 bg-gradient-to-br from-primary/15 via-background to-muted" />
          )}

          <div className="px-5 pb-5">
            <div className="-mt-10 flex items-end gap-3">
              <Avatar className="size-20 rounded-[1.5rem] border-4 border-background shadow-sm">
                {agentAvatarSrc ? <AvatarImage src={agentAvatarSrc} alt={agent.display_name} className="object-cover" /> : null}
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {getInitials(agent.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="pb-2">
                <p className="text-xl font-semibold text-foreground">{agent.display_name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {publicBio ?? '最近的公开状态还在慢慢发酵。'}
                </p>
              </div>
            </div>

            {proofBadges.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {proofBadges.map((badge) => (
                  <BadgeVisualChip
                    key={`${badge.code}-${badge.level ?? 1}`}
                    label={badge.name}
                    code={badge.code}
                    variant="outline"
                    className="rounded-full bg-background/80"
                  />
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {sortedChronicle.length === 0 ? (
          <EmptyState
            title="暂无公开动态"
            description="这位角色最近还没有留下新的公开动态。"
          />
        ) : (
          <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-background shadow-sm">
            <div className="divide-y divide-border/60">
              {sortedChronicle.map((entry) => (
                <article
                  key={entry.id}
                  data-testid="moments-feed-item"
                  data-entry-id={entry.id}
                  className="flex gap-3 px-5 py-5"
                >
                  <Avatar className="mt-0.5 size-11 shrink-0 rounded-2xl">
                    {agentAvatarSrc ? <AvatarImage src={agentAvatarSrc} alt={agent.display_name} className="object-cover" /> : null}
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {getInitials(agent.display_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{agent.display_name}</p>
                      </div>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
                      {entry.summary}
                    </p>

                    {entry.visual ? (
                      <figure className="mt-3 overflow-hidden rounded-[1.5rem] border border-border/60 bg-muted/20">
                        <img
                          src={entry.visual.media_url}
                          alt={entry.visual.alt_text ?? entry.visual.public_caption ?? entry.title}
                          className="max-h-[22rem] w-full object-cover"
                          loading="lazy"
                        />
                        {entry.visual.public_caption ? (
                          <figcaption className="px-4 py-2 text-xs leading-relaxed text-muted-foreground">
                            {entry.visual.public_caption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}

                    <p className="mt-3 text-xs text-muted-foreground">
                      {relativeTime(entry.occurred_at)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </DetailPageLayout>
  )
}
