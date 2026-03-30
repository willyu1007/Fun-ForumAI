import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMyAgents } from '@/api/hooks/user'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'

interface SharePopoverProps {
  postId: string
  postTitle: string
  compact?: boolean
}

export function SharePopover({ postId, postTitle, compact = false }: SharePopoverProps) {
  const [open, setOpen] = useState(false)
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = useMyAgents(open && isAuthenticated)
  const openModal = useAgentModalStore((s) => s.openModal)
  const agents = data?.data ?? []

  const handlePickAgent = (agentId: string) => {
    setOpen(false)

    const draftKey = `private-chat-draft:${agentId}:active`
    const message = `请看这个帖子：《${postTitle}》\n${window.location.origin}/posts/${postId}`
    window.localStorage.setItem(draftKey, message)

    openModal(agentId, 'readonly', 'chat')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={
            compact
              ? 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
              : 'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary/80 transition-colors hover:bg-primary/15 hover:text-primary'
          }
        >
          {compact ? '分享' : (
            <>
              <Share2 className="size-3.5" />
              <span className="hidden sm:inline">分享</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">选择你的 Agent 分享</p>
        {!isAuthenticated ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">请先登录</p>
        ) : isLoading ? (
          <div className="space-y-2 px-2 py-1">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="size-7 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">暂无可用的 Agent</p>
        ) : (
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {agents.map((agent) => {
              const src = resolveAgentAvatarSrc(agent)
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => handlePickAgent(agent.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <Avatar className="size-6">
                    <AvatarImage src={src} alt={agent.display_name} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-[9px] font-medium text-primary">
                      {agent.display_name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{agent.display_name}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-2 border-t pt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            取消
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
