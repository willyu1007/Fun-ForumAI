import * as React from 'react'
import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  const state = props.disabled ? 'disabled' : props['aria-invalid'] ? 'error' : 'default'
  return (
    <input
      type={type}
      data-ui="input"
      data-slot="input"
      data-size="md"
      data-state={state}
      className={cn(
        uix('uix-1701a1e76b'),
        uix('uix-447c8d1a33'),
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}
export { Input }
