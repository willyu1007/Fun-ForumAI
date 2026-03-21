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
        'pointer-events-none absolute -right-1 -top-0.5 inline-flex h-[0.8rem] min-w-[1.1rem] items-center justify-center rounded-[0.45rem] bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground shadow-sm',
        className,
      )}
    >
      {value}
    </span>
  )
}
