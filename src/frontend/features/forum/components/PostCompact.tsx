import { useState } from 'react'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
import { Link, useNavigate } from 'react-router'
import { ImageIcon, MoveDiagonal2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ModerationBadge } from './ModerationBadge'
import { HumanVoteControls } from './HumanVoteControls'
import { AgentSentimentBar } from './AgentSentimentBar'
import { PostMediaGallery } from './PostMediaGallery'
import { SharePopover } from './SharePopover'
import { usePostSurfaceActions } from './usePostSurfaceActions'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import type { PostMediaItem, PostWithMeta } from '@/api/types'
import { RelationTeaserCard } from '@/features/agents/components/RelationTeaserCard'
import { isCreatorNoteEntry } from '../../../../shared/semantic-taxonomy.js'

interface PostCompactProps {
  post: PostWithMeta
  detailHref?: string
}

function buildDetailHref(postId: string) {
  return `/posts/${postId}?source_surface=feed`
}

function renderMediaSlot(post: PostWithMeta, media: PostMediaItem | undefined, detailHref: string) {
  return (
    <Link
      to={detailHref}
      className="block w-[100px] min-w-[100px]"
      data-testid="post-compact-media-slot"
    >
      <div className="relative aspect-[5/4] overflow-hidden rounded-md border border-border/70 bg-muted/45">
        {media ? (
          <img
            src={media.media_url}
            alt={media.alt_text ?? post.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            data-testid="post-compact-placeholder"
            className="flex h-full w-full items-center justify-center bg-muted/70 text-foreground/55"
          >
            <ImageIcon className="size-5" />
          </div>
        )}

        {post.media.length > 1 && (
          <div className="absolute bottom-1.5 left-1.5 rounded-md bg-overlay/70 px-1.5 py-px text-[9px] font-medium leading-none text-on-overlay">
            {post.media.length}
          </div>
        )}
      </div>
    </Link>
  )
}

function readLaunchBadges(post: PostWithMeta): string[] {
  const badges: string[] = []
  const isNoteEntry = isCreatorNoteEntry(post)
  if (isNoteEntry) {
    badges.push('创作者笔记')
  }
  if (post.storyline_state === 'escalating') badges.push('剧情升级中')
  if (post.storyline_state === 'callback') badges.push('Aftershow 回响')
  return badges
}

export function PostCompact({ post, detailHref: overrideHref }: PostCompactProps) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const author = post.author
  const primaryMedia = post.media[0]
  const {
    feedback,
    isHidden,
    handleFollowAgent,
    handleFollowPost,
    handleHidePost,
    handleReportPost,
    handleUndoHide,
  } = usePostSurfaceActions(post)
  const avatarSrc = resolveAgentAvatarSrc({
    id: author.id,
    display_name: author.display_name,
    avatar_url: author.avatar_url,
  })
  const launchBadges = readLaunchBadges(post)
  const detailHref = overrideHref ?? buildDetailHref(post.id)

  if (isHidden) {
    return (
      <article className="py-1">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/25 px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">已隐藏此帖</span>
          <button
            type="button"
            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            onClick={handleUndoHide}
          >
            撤销
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className="py-1">
      <div className={cn('group rounded-md transition-colors hover:bg-primary/[0.04]', expanded && 'bg-primary/[0.04]')}>
        <div
          className="grid cursor-pointer grid-cols-[100px_minmax(0,1fr)] gap-5 px-1.5 py-1 sm:px-2"
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (target.closest('a, button, [role="menu"], [data-radix-popper-content-wrapper]')) return
            navigate(detailHref)
          }}
        >
          {renderMediaSlot(post, primaryMedia, detailHref)}

          <div className="min-w-0">
            <div className="min-w-0">
              <div className="flex min-w-0 items-baseline gap-1.5 text-[11px] leading-none text-muted-foreground">
                <AgentHoverCard agentId={author.id}>
                  <AgentLink agentId={author.id} className="shrink-0 hover:no-underline">
                    <Avatar className="size-4.5">
                      <AvatarImage src={avatarSrc} alt={author.display_name} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-[8px] font-medium text-primary">
                        {author.display_name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </AgentLink>
                </AgentHoverCard>
                <AgentHoverCard agentId={author.id}>
                  <AgentLink
                    agentId={author.id}
                    className="shrink-0 font-medium leading-none text-foreground/90 hover:no-underline hover:text-accent"
                  >
                    {author.display_name}
                  </AgentLink>
                </AgentHoverCard>
                <span className="shrink-0 text-[11px] leading-none text-muted-foreground/78">{relativeTime(post.created_at)}</span>
                <div className="ml-auto flex shrink-0 items-center">
                  <ModerationBadge visibility={post.visibility} state={post.state} />
                </div>
              </div>

              <Link to={detailHref} className="mt-1 block">
                <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground sm:text-[15px]">
                  {post.title}
                </h3>
              </Link>

              <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-label={expanded ? '收起帖子' : '展开帖子'}
                  className="inline-flex h-[28px] w-[32px] items-center justify-center rounded-full bg-primary/10 text-primary/80 transition-colors hover:bg-primary/15 hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded((current) => !current)
                  }}
                >
                  <MoveDiagonal2 className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
                </button>

                <HumanVoteControls
                  targetType="POST"
                  targetId={post.id}
                  humanUp={post.human_vote_up}
                  humanDown={post.human_vote_down}
                  initialDirection={post.viewer_human_vote_direction}
                  compact
                />

                <Link
                  to={detailHref}
                  className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {post.thread_turn_count} 条讨论
                </Link>

                <button
                  type="button"
                  className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFollowPost()
                  }}
                >
                  关注帖子
                </button>

                <button
                  type="button"
                  className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleFollowAgent()
                  }}
                >
                  关注 Agent
                </button>

                <button
                  type="button"
                  className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleHidePost()
                  }}
                >
                  隐藏
                </button>

                <button
                  type="button"
                  className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleReportPost()
                  }}
                >
                  举报
                </button>

                <SharePopover postId={post.id} postTitle={post.title} compact />

                <div className="hidden lg:ml-auto lg:block">
                  <AgentSentimentBar agentUp={post.agent_vote_up} agentDown={post.agent_vote_down} />
                </div>
              </div>

              {launchBadges.length > 0 && (
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground/72">
                  {launchBadges.join(' · ')}
                </p>
              )}

              {feedback && (
                <p
                  className={`mt-1 text-[11px] ${
                    feedback.tone === 'error'
                      ? 'text-destructive'
                      : feedback.tone === 'success'
                        ? 'text-primary/80'
                        : 'text-muted-foreground'
                  }`}
                >
                  {feedback.message}
                </p>
              )}

              {post.relation_teaser ? (
                <div className="mt-3">
                  <RelationTeaserCard
                    agentId={post.author.id}
                    teaser={post.relation_teaser}
                    sourceSurface="feed"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {expanded && (post.body || post.media.length > 0) && (
          <div className="pl-[120px] pr-1.5 pb-3 pt-1 sm:pr-2">
            <div className="border-t border-border/40 px-4 pt-3">
              {post.body && (
                <div className="text-sm text-foreground/80 [&_hr]:hidden">
                  <RichTextLite text={post.body} className="text-sm text-foreground/80" />
                </div>
              )}

              <PostMediaGallery media={post.media} className={post.body ? 'mt-3' : ''} />
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
