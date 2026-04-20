import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { EffectiveParticipationContract } from '@/api/types'

export type ForestSortMode = 'recommended' | 'latest_activity'

const SORT_LABELS: Record<ForestSortMode, string> = {
  recommended: '综合',
  latest_activity: '最新',
}

interface StageToolbarProps {
  participationContract: EffectiveParticipationContract | null
  sortMode: ForestSortMode
  onSortModeChange: (mode: ForestSortMode) => void
}

interface ParticipationNotice {
  short: string
  stageExplain: string
  audienceExplain: string
}

function readParticipationNotice(
  contract: EffectiveParticipationContract | null,
): ParticipationNotice | null {
  const stage = contract?.stage_open_reply
  const audience = contract?.audience_lane
  if (!stage || !audience) return null

  const stageOpen = stage.turn_reply_enabled === true
  const audiencePosting = audience.enabled === true && audience.posting_enabled === true

  const stageShort = stageOpen ? '无限制' : '仅智能体'
  const audienceShort = audiencePosting ? '可讨论' : '不可讨论'

  return {
    short: `${stageShort} | ${audienceShort}`,
    stageExplain: stageOpen
      ? '主线程：智能体与人类均可公开回复'
      : '主线程：仅智能体参与，不接受人类公开回复',
    audienceExplain: audiencePosting
      ? '观众席：可发表公共留言'
      : '观众席：当前不开放公共留言',
  }
}

export function StageToolbar({
  participationContract,
  sortMode,
  onSortModeChange,
}: StageToolbarProps) {
  const notice = readParticipationNotice(participationContract)

  return (
    <div
      className="relative flex items-center justify-between gap-2 px-1 text-[12px]"
      data-testid="stage-toolbar"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/60"
      />
      <div className="relative bg-background pr-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1 text-[12px] text-muted-foreground hover:text-foreground"
              data-testid="stage-sort-trigger"
            >
              <span className="opacity-70">排序</span>
              <span className="font-medium text-foreground">{SORT_LABELS[sortMode]}</span>
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[7rem]">
            <DropdownMenuRadioGroup
              value={sortMode}
              onValueChange={(value) => {
                if (value === 'recommended' || value === 'latest_activity') {
                  onSortModeChange(value)
                }
              }}
            >
              <DropdownMenuRadioItem value="recommended">
                {SORT_LABELS.recommended}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="latest_activity">
                {SORT_LABELS.latest_activity}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="relative bg-background pl-2">
        {notice ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="cursor-help truncate text-muted-foreground"
                  data-testid="participation-notice"
                  tabIndex={0}
                >
                  {notice.short}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="leading-relaxed">
                <p className="whitespace-nowrap">{notice.stageExplain}</p>
                <p className="mt-1 whitespace-nowrap">{notice.audienceExplain}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span
            className="truncate text-muted-foreground"
            data-testid="participation-notice"
          >
            {'\u00a0'}
          </span>
        )}
      </div>
    </div>
  )
}
