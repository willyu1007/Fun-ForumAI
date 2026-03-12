import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { uixPrimitive as uix } from '@/shared/utils/uix-primitives'
function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(uix('tabsRoot'), className)}
      {...props}
    />
  )
}
const tabsListVariants = cva(
  uix('tabsListBase'),
  {
    variants: {
      variant: {
        default: uix('tabsListVariantDefault'),
        line: uix('tabsListVariantLine'),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)
function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        uix('tabsTriggerBase'),
        uix('tabsTriggerLineVariant'),
        uix('tabsTriggerActive'),
        uix('tabsTriggerIndicator'),
        className,
      )}
      {...props}
    />
  )
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(uix('tabsContent'), className)}
      {...props}
    />
  )
}
export { Tabs, TabsList, TabsTrigger, TabsContent }
