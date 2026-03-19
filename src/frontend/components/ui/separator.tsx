'use client'

import * as React from 'react'
import { Separator as SeparatorPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-ui="divider"
      data-slot="separator"
      data-orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'}
      data-tone="default"
      decorative={decorative}
      orientation={orientation}
      className={cn('bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px', className)}
      {...props}
    />
  )
}
export { Separator }
