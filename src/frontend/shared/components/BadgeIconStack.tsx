import { cn } from '@/lib/utils'
import type { PublicAuthorBadgeListItem } from '@/shared/utils/public-author'
import { readKnownBadgeVisual } from '../../../shared/badges/catalog'

type BadgeIconStackSize = 'sm' | 'md'

const SIZE_CLASSES: Record<
  BadgeIconStackSize,
  {
    item: string
    itemOffset: string
    fallbackText: string
    overflow: string
  }
> = {
  sm: {
    item: 'size-5',
    itemOffset: '-ml-1.5',
    fallbackText: 'text-[8px]',
    overflow: 'h-5 min-w-5 px-1 text-[8px]',
  },
  md: {
    item: 'size-6',
    itemOffset: '-ml-2',
    fallbackText: 'text-[9px]',
    overflow: 'h-6 min-w-6 px-1.5 text-[9px]',
  },
}

interface BadgeIconStackProps {
  badges: PublicAuthorBadgeListItem[]
  maxVisible?: number
  size?: BadgeIconStackSize
  className?: string
}

export function BadgeIconStack({
  badges,
  maxVisible = 3,
  size = 'sm',
  className,
}: BadgeIconStackProps) {
  if (badges.length === 0) {
    return null
  }

  const visibleBadges = badges.slice(0, maxVisible)
  const overflowCount = Math.max(badges.length - visibleBadges.length, 0)
  const summary = visibleBadges.map((badge) => badge.label).join('、')
  const sizeClasses = SIZE_CLASSES[size]

  return (
    <div
      className={cn('flex items-center', className)}
      aria-label={`徽章：${summary}${overflowCount > 0 ? `，另外 ${overflowCount} 枚` : ''}`}
    >
      {visibleBadges.map((badge, index) => {
        const visual = readKnownBadgeVisual({
          label: badge.label,
          code: badge.code ?? null,
        })

        return (
          <span
            key={`${badge.code ?? 'display'}:${badge.label}`}
            role="img"
            aria-label={badge.label}
            title={badge.label}
            className={cn(
              'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-background bg-muted shadow-sm',
              sizeClasses.item,
              index > 0 ? sizeClasses.itemOffset : '',
            )}
          >
            {visual?.icon_src ? (
              <img
                src={visual.icon_src}
                alt=""
                aria-hidden="true"
                className="size-full object-contain"
              />
            ) : (
              <span className={cn('font-medium leading-none text-muted-foreground', sizeClasses.fallbackText)}>
                {badge.label.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
        )
      })}
      {overflowCount > 0 ? (
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full border border-background bg-muted text-muted-foreground shadow-sm',
            sizeClasses.overflow,
            visibleBadges.length > 0 ? sizeClasses.itemOffset : '',
          )}
          aria-label={`另外 ${overflowCount} 枚徽章`}
        >
          +{overflowCount}
        </span>
      ) : null}
    </div>
  )
}
