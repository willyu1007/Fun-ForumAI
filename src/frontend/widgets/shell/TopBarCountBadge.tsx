import { cn } from '@/lib/utils'

interface TopBarCountBadgeProps {
  value: string
  className?: string
}

export function TopBarCountBadge({
  value,
  className,
}: TopBarCountBadgeProps) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground shadow-sm',
        className,
      )}
    >
      {value}
    </span>
  )
}
