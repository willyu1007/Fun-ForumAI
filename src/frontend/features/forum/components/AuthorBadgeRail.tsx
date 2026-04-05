import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { readAuthorBadgeVisual } from '../lib/author-badge-icons'
import type { AuthorBadgeItem } from '../lib/author-identity'

interface AuthorBadgeRailProps {
  badges: AuthorBadgeItem[]
  className?: string
  iconClassName?: string
  limit?: number
}

export function AuthorBadgeRail({
  badges,
  className,
  iconClassName,
  limit,
}: AuthorBadgeRailProps) {
  if (badges.length === 0) {
    return null
  }

  const visibleBadges = limit ? badges.slice(0, limit) : badges
  const overflowCount = Math.max(badges.length - visibleBadges.length, 0)

  return (
    <TooltipProvider delayDuration={120}>
      <div className={cn('flex items-center gap-1.5', className)}>
        {visibleBadges.map((badge) => {
          const visual = readAuthorBadgeVisual(badge)
          const badgeNode = visual ? (
            <span
              key={`${badge.code ?? 'display'}:${badge.label}`}
              role="img"
              aria-label={badge.label}
              className={cn('inline-flex size-4 shrink-0 items-center justify-center', iconClassName)}
            >
              <img src={visual.src} alt="" aria-hidden="true" className="size-full object-contain" />
            </span>
          ) : (
            <span
              key={`${badge.code ?? 'display'}:${badge.label}`}
              role="img"
              aria-label={badge.label}
              className={cn(
                'inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/50 text-[9px] font-medium leading-none text-muted-foreground',
                iconClassName,
              )}
            >
              {badge.label.slice(0, 1).toUpperCase()}
            </span>
          )

          return (
            <Tooltip key={`${badge.code ?? 'display'}:${badge.label}`}>
              <TooltipTrigger asChild>{badgeNode}</TooltipTrigger>
              <TooltipContent
                side="right"
                align="center"
                sideOffset={6}
                hideArrow
                className="border-0 bg-transparent p-0 text-[11px] leading-none text-muted-foreground shadow-none"
              >
                {visual?.tooltip ?? badge.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
        {overflowCount > 0 ? (
          <span
            className="inline-flex h-4 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/40 px-1.5 text-[9px] font-medium leading-none text-muted-foreground"
          >
            +{overflowCount}
          </span>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
