import * as React from 'react'
import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-ui="card"
      data-slot="card"
      data-variant="default"
      data-elevation="none"
      className={cn(uix('uix-12f0fa7fc7'), className)}
      {...props}
    />
  )
}
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn(uix('uix-dc6512f118'), className)} {...props} />
}
function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn(uix('uix-a446c31cc7'), className)} {...props} />
}
function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-description" className={cn(uix('uix-fcceb93b0e'), className)} {...props} />
  )
}
function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  )
}
function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn(uix('uix-f92d02360b'), className)} {...props} />
  )
}
function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn(uix('uix-9c2be7fadb'), className)} {...props} />
}
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
