import * as React from 'react'
import { cn } from '@/lib/utils'
function Textarea({
  className,
  disabled,
  'aria-invalid': ariaInvalid,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-ui="textarea"
      data-slot="textarea"
      data-size="md"
      data-state={disabled ? 'disabled' : ariaInvalid ? 'error' : 'default'}
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      {...props}
    />
  )
}
export { Textarea }
