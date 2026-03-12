import * as React from 'react'
import { Avatar as AvatarPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'
function Avatar({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: 'default' | 'sm' | 'lg'
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(uix('uix-7b70d80c61'), className)}
      {...props}
    />
  )
}
function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full', className)}
      {...props}
    />
  )
}
function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(uix('uix-b2a51095ee'), className)}
      {...props}
    />
  )
}
function AvatarBadge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        uix('uix-1b185f144c'),
        uix('uix-dc0fb21892'),
        uix('uix-1eaa5b7438'),
        uix('uix-7919bab121'),
        className,
      )}
      {...props}
    />
  )
}
function AvatarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="avatar-group" className={cn(uix('uix-b384c3b2b8'), className)} {...props} />
  )
}
function AvatarGroupCount({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(uix('uix-279ac43607'), className)}
      {...props}
    />
  )
}
export { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount }
