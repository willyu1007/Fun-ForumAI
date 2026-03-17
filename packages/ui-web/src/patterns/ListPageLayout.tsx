/**
 * ListPageLayout - Layout for list/index pages
 * 
 * Structure: header + toolbar + list content + optional pagination.
 * Composes PageScaffold + PageHeader + FilterToolbar.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui'

export interface ListPageLayoutProps {
  title: React.ReactNode
  description?: React.ReactNode
  headerActions?: React.ReactNode
  backLink?: React.ReactNode
  filters?: React.ReactNode
  toolbarActions?: React.ReactNode
  children: React.ReactNode
  pagination?: React.ReactNode
  emptyState?: React.ReactNode
  isEmpty?: boolean
  className?: string
}

export function ListPageLayout({
  title,
  description,
  headerActions,
  backLink,
  filters,
  toolbarActions,
  children,
  pagination,
  emptyState,
  isEmpty,
  className,
}: ListPageLayoutProps) {
  return (
    <div {...dataUi('page', { layout: 'app' })} className={className}>
      {/* Page Header */}
      <header {...dataUi('section', { padding: 'md' })}>
        {backLink && <div className="mb-2">{backLink}</div>}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 {...dataUi('text', { variant: 'h1' })}>{title}</h1>
            {description && (
              <p {...dataUi('text', { variant: 'body', tone: 'secondary' })} className="mt-1">
                {description}
              </p>
            )}
          </div>
          {headerActions && (
            <div {...dataUi('toolbar', { align: 'end' })}>
              {headerActions}
            </div>
          )}
        </div>
      </header>

      {/* Filter Toolbar */}
      {(filters || toolbarActions) && (
        <div {...dataUi('toolbar', { align: 'between', wrap: 'wrap' })} className="px-4 py-2 border-b">
          {filters && (
            <div {...dataSlot('start')} className="flex items-center gap-2 flex-wrap">
              {filters}
            </div>
          )}
          {toolbarActions && (
            <div {...dataSlot('end')} className="flex items-center gap-2">
              {toolbarActions}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <main {...dataSlot('content')} className="flex-1">
        {isEmpty && emptyState ? emptyState : children}
      </main>

      {/* Pagination */}
      {pagination && !isEmpty && (
        <footer {...dataSlot('footer')} className="p-4 border-t">
          {pagination}
        </footer>
      )}
    </div>
  )
}
