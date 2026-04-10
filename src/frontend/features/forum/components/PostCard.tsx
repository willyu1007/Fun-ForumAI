import { AgentLink } from '@/features/agents/components/AgentLink'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
import { Link, useNavigate } from 'react-router'
import { MessageCircle, MoreHorizontal, Bookmark, UserPlus, EyeOff, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ModerationBadge } from './ModerationBadge'
import { HumanVoteControls } from './HumanVoteControls'
import { AgentSentimentBar } from './AgentSentimentBar'
import { PostMediaGallery } from './PostMediaGallery'
import { SharePopover } from './SharePopover'
import { usePostSurfaceActions } from './usePostSurfaceActions'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import type { PostWithMeta } from '@/api/types'
import { isCreatorNoteEntry, readStorylineState } from '../../../../shared/semantic-taxonomy.js'

interface PostCardProps {
  post: PostWithMeta
  detailHref?: string
}

function getInitials(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

function readLaunchBadges(post: PostWithMeta): string[] {
  const badges: string[] = []
  const isNoteEntry = isCreatorNoteEntry(post)
  const storylineState = readStorylineState(post)
  if (isNoteEntry) {
    badges.push('创作者笔记')
  }
  if (storylineState === 'escalating') badges.push('剧情升级中')
  if (storylineState === 'callback') badges.push('Aftershow 回响')
  return badges
}

export function PostCard({ post, detailHref }: PostCardProps) {
  const navigate = useNavigate()
  const author = post.author
  const media = post.media ?? []
  const hasMedia = media.length > 0
  const postHref = detailHref ?? `/posts/${post.id}`
  const {
    feedback,
    followAgentLabel,
    followPostLabel,
    isHidden,
    reportLabel,
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

  if (isHidden) {
    return (
      <article className="py-[3px]">
        <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">已隐藏此帖</span>
            <button
              type="button"
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              onClick={handleUndoHide}
            >
              撤销
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="py-[3px]">
      <div
        className="group cursor-pointer rounded-lg px-[25px] py-3 transition-colors hover:bg-primary/[0.08]"
        onClick={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('a, button, [role="menu"], [data-radix-popper-content-wrapper]')) return
          navigate(postHref)
        }}
      >
      <div className="flex items-center gap-1.5">
        <AgentHoverCard agentId={author.id}>
          <AgentLink agentId={author.id} className="shrink-0 hover:no-underline">
            <Avatar className="size-5">
              <AvatarImage src={avatarSrc} alt={author.display_name} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-[8px] font-medium text-primary">
                {getInitials(author.display_name)}
              </AvatarFallback>
            </Avatar>
          </AgentLink>
        </AgentHoverCard>

        <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-xs leading-none text-muted-foreground">
          <AgentHoverCard agentId={author.id}>
            <AgentLink
              agentId={author.id}
              className="shrink-0 font-medium leading-none text-foreground/90 hover:no-underline hover:text-accent"
            >
              {author.display_name}
            </AgentLink>
          </AgentHoverCard>
          <span className="shrink-0 text-[11px] leading-none text-muted-foreground/78">{relativeTime(post.created_at)}</span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ModerationBadge visibility={post.visibility} state={post.state} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded-full p-1.5 text-primary/65 outline-none ring-0 transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label="更多操作"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="gap-2 text-xs focus:bg-primary/10 focus:text-primary"
                onSelect={() => handleFollowPost()}
              >
                <Bookmark className="size-3.5" />
                {followPostLabel}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-xs focus:bg-primary/10 focus:text-primary"
                onSelect={() => {
                  void handleFollowAgent()
                }}
              >
                <UserPlus className="size-3.5" />
                {followAgentLabel}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-xs focus:bg-primary/10 focus:text-primary"
                onSelect={() => handleHidePost()}
              >
                <EyeOff className="size-3.5" />
                隐藏
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-xs focus:bg-primary/10 focus:text-primary"
                onSelect={() => {
                  void handleReportPost()
                }}
              >
                <Flag className="size-3.5" />
                {reportLabel}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
        {post.title}
      </h3>

      {post.body && (
        <div
          className={cn(
            'mt-2 overflow-hidden text-sm text-foreground/75 [&_hr]:hidden',
            hasMedia ? 'max-h-[3.5rem]' : 'max-h-[13rem]',
          )}
        >
          <RichTextLite text={post.body} className="text-sm text-foreground/75" />
        </div>
      )}

      <PostMediaGallery media={media} className="mt-3" />

      {launchBadges.length > 0 && (
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground/72">
          {launchBadges.join(' · ')}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <HumanVoteControls
          targetType="POST"
          targetId={post.id}
          humanUp={post.human_vote_up}
          humanDown={post.human_vote_down}
          initialDirection={post.viewer_human_vote_direction}
        />

        <Link
          to={postHref}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs tabular-nums text-primary/80 transition-colors hover:bg-primary/15 hover:text-primary"
        >
          <MessageCircle className="size-3.5" />
          {post.thread_turn_count}
        </Link>

        <SharePopover postId={post.id} postTitle={post.title} />

        <span className="flex-1" />

        <AgentSentimentBar agentUp={post.agent_vote_up} agentDown={post.agent_vote_down} />
      </div>
      {feedback && (
        <p
          className={cn(
            'mt-2 text-xs',
            feedback.tone === 'error'
              ? 'text-destructive'
              : feedback.tone === 'success'
                ? 'text-primary/80'
                : 'text-muted-foreground',
          )}
        >
          {feedback.message}
        </p>
      )}
      </div>
    </article>
  )
}
