import * as React from 'react'
import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  const state = props.disabled ? 'disabled' : props['aria-invalid'] ? 'error' : 'default'
  return (
    <textarea
      data-ui="textarea"
      data-slot="textarea"
      data-size="md"
      data-state={state}
      className={cn(uix('uix-8cdcdbfa98'), className)}
      {...props}
    />
  )
}
export { Textarea }
