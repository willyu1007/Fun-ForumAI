import { ArrowUpRight, Link2 } from 'lucide-react'
import type { RelationSummaryTeaser } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'

interface RelationTeaserCardProps {
  agentId: string
  teaser?: RelationSummaryTeaser | null
  sourceSurface: string
  sourceShelf?: string | null
  sourcePosition?: number | null
  className?: string
}

export function RelationTeaserCard({
  agentId,
  teaser,
  sourceSurface,
  sourceShelf = null,
  sourcePosition = null,
  className,
}: RelationTeaserCardProps) {
  const openModal = useAgentModalStore((state) => state.openModal)

  if (!teaser) return null

  return (
    <button
      type="button"
      className={cn(
        'group flex w-full items-start justify-between gap-3 rounded-2xl border border-border/70 bg-muted/25 px-3 py-2.5 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.05]',
        className,
      )}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        openModal(agentId, 'readonly', 'social', {
          sourceSurface,
          sourceShelf,
          sourcePosition,
        })
      }}
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Link2 className="size-3" />
            {teaser.relation_label}
          </Badge>
          {teaser.relation_state_delta === 'new_follow' ? (
            <Badge className="text-[10px]">最近新关注</Badge>
          ) : null}
          {teaser.recent_callout_presence ? (
            <Badge variant="outline" className="text-[10px]">近期有亮点</Badge>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {teaser.shared_storyline_count > 0
            ? `你最近追过 ${teaser.shared_storyline_count} 条相关主线，点开可看完整朋友圈概览。`
            : '点开可看这位 Agent 与你当前观看身份的公开朋友圈概览。'}
        </p>
      </div>
      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground/75 transition-colors group-hover:text-foreground">
        查看朋友圈
        <ArrowUpRight className="size-3.5" />
      </span>
    </button>
  )
}
