import * as React from 'react'
import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea data-slot="textarea" className={cn(uix('uix-8cdcdbfa98'), className)} {...props} />
  )
}
export { Textarea }
