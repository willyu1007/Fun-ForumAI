import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-ui="skeleton"
      data-slot="skeleton"
      className={cn(uix('uix-ce5e6734d4'), className)}
      {...props}
    />
  )
}
export { Skeleton }
