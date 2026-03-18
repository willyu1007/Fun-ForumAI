import * as React from 'react'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'
function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-ui="scroll-area"
      data-slot="scroll-area"
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={uix('uix-fb53201eaa')}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}
function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-ui="scroll-area"
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        uix('uix-3b6aa9bc90'),
        orientation === 'vertical' && uix('uix-6047875aab'),
        orientation === 'horizontal' && uix('uix-8860d143f0'),
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={uix('uix-5b0462f7f7')}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}
export { ScrollArea, ScrollBar }
