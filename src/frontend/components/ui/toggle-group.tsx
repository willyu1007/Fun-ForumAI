import * as React from 'react'
import { type VariantProps } from 'class-variance-authority'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { toggleVariants } from '@/components/ui/toggle-variants'
const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: 0 | 1 | 2
  }
>({
  size: 'default',
  variant: 'default',
  spacing: 0,
})
function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    spacing?: 0 | 1 | 2
  }) {
  return (
    <ToggleGroupPrimitive.Root
      data-ui="toggle-group"
      data-slot="toggle-group"
      data-variant={variant === 'outline' ? 'outline' : 'default'}
      data-size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'}
      data-spacing={spacing === 1 ? '1' : spacing === 2 ? '2' : '0'}
      className={cn(
        'group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs',
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}
function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)
  return (
    <ToggleGroupPrimitive.Item
      data-ui="toggle"
      data-slot="toggle-group-item"
      data-variant={context.variant === 'outline' || variant === 'outline' ? 'outline' : 'default'}
      data-size={
        context.size === 'sm' || size === 'sm'
          ? 'sm'
          : context.size === 'lg' || size === 'lg'
            ? 'lg'
            : 'default'
      }
      data-spacing={context.spacing === 1 ? '1' : context.spacing === 2 ? '2' : '0'}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10',
        'data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l',
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}
export { ToggleGroup, ToggleGroupItem }
