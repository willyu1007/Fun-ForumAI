import { useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Flame } from 'lucide-react'
import { useFeed } from '@/api/hooks/forum'
import type { PostWithMeta } from '@/api/types'
import { relativeTime } from '@/shared/utils/relative-time'
import { getInitials } from '@/shared/utils/get-initials'
import { cn } from '@/lib/utils'
import { ShellIconHint } from './ShellIconHint'
import { topBarIconTriggerClassName } from './top-bar-icon-trigger'
import { TopBarCountBadge } from './TopBarCountBadge'

function activityCountLabel(count: number) {
  return count > 9 ? '9+' : String(count)
}

function getAuthorInitials(name: string) {
  return getInitials(name)
}

function buildActivityPreview(posts: PostWithMeta[]) {
  const latestByAuthor = new Map<string, PostWithMeta>()

  for (const post of posts) {
    const current = latestByAuthor.get(post.author.id)
    if (!current || new Date(post.created_at).getTime() > new Date(current.created_at).getTime()) {
      latestByAuthor.set(post.author.id, post)
    }
  }

  const items = Array.from(latestByAuthor.values()).sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  )

  return {
    count: latestByAuthor.size,
    items: items.slice(0, 5),
  }
}

export function ActivityPanelWidget() {
  const navigate = useNavigate()
  const { data } = useFeed({ sort: 'new', following_only: true, limit: 20 })
  const posts = data?.data ?? []
  const preview = buildActivityPreview(posts)

  return (
    <DropdownMenu>
      <ShellIconHint label="动态">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(topBarIconTriggerClassName, 'relative size-9')}
            aria-label="动态"
            title="动态"
          >
            <Flame className="h-[18px] w-[18px]" />
            {preview.count > 0 && (
              <TopBarCountBadge value={activityCountLabel(preview.count)} />
            )}
          </button>
        </DropdownMenuTrigger>
      </ShellIconHint>
      <DropdownMenuContent
        align="end"
        className="w-[23rem] overflow-hidden rounded-3xl border border-border/70 p-0 shadow-xl"
      >
        <div className="border-b border-border/70 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <DropdownMenuLabel className="p-0 text-[15px] font-semibold text-foreground">
              动态
            </DropdownMenuLabel>
            <span className="text-[11px] text-muted-foreground">
              {preview.count > 0
                ? `${preview.count} 个关注对象有更新`
                : '关注对象最近还没有更新'}
            </span>
          </div>
        </div>
        {preview.items.length === 0 ? (
          <div className="px-5 py-8 text-center text-[11px] text-muted-foreground">
            你关注的对象最近还没有新动态。
          </div>
        ) : (
          <div className="max-h-[24rem] overflow-y-auto py-1">
            {preview.items.map((post) => (
              <DropdownMenuItem
                key={post.author.id}
                className="flex cursor-pointer items-start gap-3 rounded-none px-5 py-3"
                onClick={() => navigate(`/posts/${post.id}`)}
              >
                <Avatar className="mt-0.5 h-10 w-10 shrink-0">
                  {post.author.avatar_url ? (
                    <AvatarImage src={post.author.avatar_url} alt={post.author.display_name} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground/80">
                    {getAuthorInitials(post.author.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="line-clamp-1 text-[12px] font-semibold leading-5 text-foreground">
                      {post.author.display_name}
                    </span>
                    <span className="shrink-0 pt-0.5 text-[10px] leading-none text-muted-foreground">
                      {relativeTime(post.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-[1.35] text-muted-foreground">
                    在 {post.community_name} 发布了新帖：{post.title}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <div className="h-4 border-t border-border/70 bg-muted/25" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
