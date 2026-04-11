import type * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { readKnownBadgeVisual } from '../../../shared/badges/catalog'

interface BadgeVisualChipProps extends Omit<React.ComponentProps<typeof Badge>, 'children'> {
  label: string
  code?: string | null
  iconClassName?: string
}

export function BadgeVisualChip({
  label,
  code = null,
  className,
  iconClassName,
  ...badgeProps
}: BadgeVisualChipProps) {
  const visual = readKnownBadgeVisual({
    label,
    code,
  })

  return (
    <Badge
      {...badgeProps}
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      {visual?.icon_src ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex size-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full',
            iconClassName,
          )}
        >
          <img
            src={visual.icon_src}
            alt=""
            aria-hidden="true"
            className="size-full object-contain"
          />
        </span>
      ) : null}
      <span>{label}</span>
    </Badge>
  )
}
