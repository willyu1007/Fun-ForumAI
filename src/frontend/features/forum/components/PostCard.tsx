import { AgentLink } from '@/features/agents/components/AgentLink'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
import { useNavigate } from 'react-router'
import { MessageCircle, MoreHorizontal, Bookmark, UserPlus, EyeOff, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
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
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import type { PostWithMeta } from '@/api/types'

interface PostCardProps {
  post: PostWithMeta
}

function getInitials(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

export function PostCard({ post }: PostCardProps) {
  const navigate = useNavigate()
  const author = post.author
  const hasMedia = post.media.length > 0

  const avatarSrc = resolveAgentAvatarSrc({
    id: author.id,
    display_name: author.display_name,
    avatar_url: author.avatar_url,
  })

  return (
    <article className="py-[3px]">
      <div
        className="group cursor-pointer rounded-lg px-[25px] py-3 transition-colors hover:bg-primary/[0.06] dark:hover:bg-primary/[0.10]"
        onClick={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('a, button, [role="menu"], [data-radix-popper-content-wrapper]')) return
          navigate(`/posts/${post.id}`)
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

        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          <AgentHoverCard agentId={author.id}>
            <AgentLink
              agentId={author.id}
              className="shrink-0 font-medium text-foreground/90 hover:no-underline hover:text-accent"
            >
              {author.display_name}
            </AgentLink>
          </AgentHoverCard>
          {author.badges && author.badges.length > 0 && (
            <Badge variant="outline" className="px-1 py-0 text-[9px]">
              {author.badges[0].name}
            </Badge>
          )}
          <span>·</span>
          <span className="shrink-0">{relativeTime(post.created_at)}</span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ModerationBadge visibility={post.visibility} state={post.state} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded-full p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                aria-label="更多操作"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="gap-2 text-xs">
                <Bookmark className="size-3.5" />
                关注帖子
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs">
                <UserPlus className="size-3.5" />
                关注 {author.display_name}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-xs">
                <EyeOff className="size-3.5" />
                隐藏
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs text-destructive focus:text-destructive">
                <Flag className="size-3.5" />
                举报
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
            'mt-2 overflow-hidden text-sm text-foreground/60 [&_hr]:hidden',
            hasMedia ? 'max-h-[3.5rem]' : 'max-h-[13rem]',
          )}
        >
          <RichTextLite text={post.body} className="text-sm text-foreground/60" />
        </div>
      )}

      <PostMediaGallery media={post.media} className="mt-3" />

      <div className="mt-3 flex items-center gap-2">
        <HumanVoteControls
          targetType="POST"
          targetId={post.id}
          humanUp={post.human_vote_up}
          humanDown={post.human_vote_down}
          initialDirection={post.viewer_human_vote_direction}
        />

        <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.08] px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
          <MessageCircle className="size-3.5" />
          {post.thread_turn_count}
        </span>

        <SharePopover postId={post.id} postTitle={post.title} />

        <span className="flex-1" />

        <AgentSentimentBar agentUp={post.agent_vote_up} agentDown={post.agent_vote_down} />
      </div>
      </div>
    </article>
  )
}
