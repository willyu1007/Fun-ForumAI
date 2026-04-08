import type { ComponentPropsWithoutRef } from 'react'
import { Link } from 'react-router'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

type HelpMarkdownProps = {
  markdown: string
  compact?: boolean
  className?: string
}

function isInternalHref(href?: string) {
  return Boolean(href && href.startsWith('/'))
}

function headingAnchorClassName(compact: boolean) {
  return cn(
    'group relative scroll-mt-24 font-semibold tracking-tight text-foreground',
    compact ? 'text-base' : 'text-xl',
  )
}

type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean
}

function createMarkdownComponents(compact: boolean): Components {
  return {
    h2: ({ className, ...props }) => (
      <h2 className={cn(headingAnchorClassName(compact), 'mt-10 first:mt-0', className)} {...props} />
    ),
    h3: ({ className, ...props }) => (
      <h3
        className={cn(
          'mt-8 font-semibold tracking-tight text-foreground',
          compact ? 'text-sm' : 'text-lg',
          className,
        )}
        {...props}
      />
    ),
    p: ({ className, ...props }) => (
      <p
        className={cn(
          'leading-relaxed text-muted-foreground',
          compact ? 'text-xs leading-6' : 'text-base leading-7',
          className,
        )}
        {...props}
      />
    ),
    ul: ({ className, ...props }) => (
      <ul
        className={cn(
          'list-disc space-y-2 pl-5 text-muted-foreground',
          compact ? 'text-xs leading-6' : 'text-base leading-7',
          className,
        )}
        {...props}
      />
    ),
    ol: ({ className, ...props }) => (
      <ol
        className={cn(
          'list-decimal space-y-2 pl-5 text-muted-foreground',
          compact ? 'text-xs leading-6' : 'text-base leading-7',
          className,
        )}
        {...props}
      />
    ),
    blockquote: ({ className, ...props }) => (
      <blockquote
        className={cn(
          'border-l-2 border-border/60 pl-4 text-muted-foreground',
          compact ? 'text-xs leading-6' : 'text-base leading-7',
          className,
        )}
        {...props}
      />
    ),
    hr: ({ className, ...props }) => <hr className={cn('border-border/60', className)} {...props} />,
    table: ({ className, ...props }) => (
      <div className="overflow-x-auto">
        <table className={cn('w-full min-w-[28rem] border-collapse text-left', className)} {...props} />
      </div>
    ),
    thead: ({ className, ...props }) => <thead className={cn('bg-muted/30', className)} {...props} />,
    tbody: ({ className, ...props }) => <tbody className={cn('[&_tr:last-child]:border-b-0', className)} {...props} />,
    tr: ({ className, ...props }) => <tr className={cn('border-b border-border/50', className)} {...props} />,
    th: ({ className, ...props }) => (
      <th
        className={cn(
          'px-3 py-2 font-medium text-foreground',
          compact ? 'text-[11px]' : 'text-sm',
          className,
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }) => (
      <td
        className={cn(
          'px-3 py-2 align-top text-muted-foreground',
          compact ? 'text-[11px] leading-5' : 'text-sm leading-6',
          className,
        )}
        {...props}
      />
    ),
    pre: ({ className, ...props }) => (
      <pre
        className={cn(
          'overflow-x-auto rounded-xl border border-border/50 bg-muted/30 p-4',
          compact ? 'text-[11px]' : 'text-sm',
          className,
        )}
        {...props}
      />
    ),
    code: ({ inline, className, ...props }: MarkdownCodeProps) => (
      <code
        className={cn(
          inline
            ? 'rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.92em] text-foreground'
            : 'font-mono text-inherit',
          className,
        )}
        {...props}
      />
    ),
    a: ({ href, className, children, ...props }) => {
      const linkClassName = cn('font-medium text-primary underline-offset-4 hover:underline', className)

      if (isInternalHref(href)) {
        return (
          <Link to={href!} className={linkClassName}>
            {children}
          </Link>
        )
      }

      if (href?.startsWith('#')) {
        return (
          <a href={href} className={linkClassName} {...props}>
            {children}
          </a>
        )
      }

      return (
        <a
          href={href}
          className={linkClassName}
          target="_blank"
          rel="noreferrer noopener"
          {...props}
        >
          {children}
        </a>
      )
    },
  }
}

export function HelpMarkdown({ markdown, compact = false, className }: HelpMarkdownProps) {
  return (
    <div className={cn('space-y-6', compact && 'space-y-4', className)}>
      <ReactMarkdown
        components={createMarkdownComponents(compact)}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'append' }],
        ]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
