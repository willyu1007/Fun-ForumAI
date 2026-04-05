import { useMemo } from 'react'
import { Check, LayoutGrid } from 'lucide-react'
import { useMyAgents } from '@/api/hooks/user'
import { useAuth } from '@/shared/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  MAX_LEFT_RAIL_DISPLAY_AGENTS,
  useLeftRailAgentDisplayStore,
} from '@/shared/stores/left-rail-agent-display-store'
import { getInitials } from '@/shared/utils/get-initials'
import {
  resolveLeftRailDisplayOwnerId,
  sortAgentsByCreatedAt,
} from '@/shared/utils/left-rail-agent-display'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'

const EMPTY_SELECTED_AGENT_IDS: string[] = []

type LeftRailAgentDisplayEditorProps = {
  className?: string
}

export function LeftRailAgentDisplayEditor({
  className,
}: LeftRailAgentDisplayEditorProps) {
  const { user } = useAuth()
  const { data } = useMyAgents()
  const agents = useMemo(() => data?.data ?? [], [data])
  const ownerId = useMemo(
    () => resolveLeftRailDisplayOwnerId(agents, user?.id),
    [agents, user?.id],
  )
  const selectionsByOwnerId = useLeftRailAgentDisplayStore((state) => state.selectionsByOwnerId)
  const selectedAgentIds = useMemo(
    () => (ownerId ? (selectionsByOwnerId[ownerId] ?? EMPTY_SELECTED_AGENT_IDS) : EMPTY_SELECTED_AGENT_IDS),
    [ownerId, selectionsByOwnerId],
  )
  const setSelectedAgentIds = useLeftRailAgentDisplayStore((state) => state.setSelectedAgentIds)
  const clearSelectedAgentIds = useLeftRailAgentDisplayStore((state) => state.clearSelectedAgentIds)
  const sortedAgents = useMemo(() => sortAgentsByCreatedAt(agents), [agents])

  const toggleLeftRailDisplayAgent = (agentId: string) => {
    if (!ownerId) {
      return
    }

    if (selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds(
        ownerId,
        selectedAgentIds.filter((currentId) => currentId !== agentId),
      )
      return
    }

    if (selectedAgentIds.length >= MAX_LEFT_RAIL_DISPLAY_AGENTS) {
      return
    }

    setSelectedAgentIds(ownerId, [...selectedAgentIds, agentId])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground/75 transition-colors',
            'hover:bg-background/55 hover:text-foreground data-[state=open]:bg-background/72 data-[state=open]:text-foreground',
            'disabled:pointer-events-none disabled:opacity-45',
            className,
          )}
          disabled={sortedAgents.length === 0}
          aria-label="编辑左下角展示"
          title="编辑左下角展示"
          data-testid="left-rail-agent-display-editor-trigger"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={10}
        className="w-[18rem] rounded-2xl p-0"
      >
        <div className="border-b px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">左下角展示</div>
            {selectedAgentIds.length > 0 ? (
              <button
                type="button"
                className="text-[11px] font-normal leading-none text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
                onClick={() => ownerId && clearSelectedAgentIds(ownerId)}
                disabled={!ownerId}
                data-testid="left-rail-agent-display-reset-trigger"
              >
                恢复默认
              </button>
            ) : (
              <span className="text-[11px] leading-none text-muted-foreground">默认</span>
            )}
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto px-2 py-2">
          {sortedAgents.map((agent) => {
            const isSelected = selectedAgentIds.includes(agent.id)
            const disableSelect =
              !isSelected && selectedAgentIds.length >= MAX_LEFT_RAIL_DISPLAY_AGENTS

            return (
              <button
                key={agent.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
                  isSelected
                    ? 'bg-primary/8 text-foreground'
                    : 'text-foreground/80 hover:bg-muted',
                  disableSelect && 'cursor-not-allowed opacity-60',
                )}
                onClick={() => toggleLeftRailDisplayAgent(agent.id)}
                disabled={disableSelect}
                data-testid={`left-rail-agent-display-option-${agent.id}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={resolveAgentAvatarSrc(agent)}
                    alt={agent.display_name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted text-[10px] font-medium">
                    {getInitials(agent.display_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {agent.display_name}
                </span>
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-transparent',
                  )}
                >
                  <Check className="h-3 w-3" />
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
