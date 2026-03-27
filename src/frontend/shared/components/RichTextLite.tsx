import { Fragment, type ReactNode, useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { cn } from '@/lib/utils'
import { parseRichTextLite, toPlainText, type RichTextLiteBlock } from '@/shared/utils/rich-text-lite'

interface RichTextLiteProps {
  text: string
  mode?: 'full' | 'chat'
  className?: string
}

/* ── Inline token regex ─────────────────────────────────────────────
 *  Priority (left to right in alternation):
 *    1. inline code  `...`
 *    2. inline math  $...$  (not preceded/followed by $)
 *    3. bold         **...**
 *    4. strikethrough ~~...~~
 *    5. italic       *...*  (not preceded/followed by *)
 */
const INLINE_RE =
  /(`[^`\n]+`|(?<!\$)\$(?!\$)(?:[^$\\\n]|\\.)+\$(?!\$)|\*\*(?:(?!\*\*).)+?\*\*|~~(?:(?!~~).)+?~~|(?<!\*)\*(?!\*)(?:(?!\*).)+?\*(?!\*))/g

function renderKatex(expression: string, displayMode: boolean): ReactNode {
  try {
    const html = katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
      strict: false,
    })
    return (
      <span
        dangerouslySetInnerHTML={{ __html: html }}
        className={displayMode ? 'block overflow-x-auto py-2' : undefined}
      />
    )
  } catch {
    return <code className="text-destructive">{expression}</code>
  }
}

function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  INLINE_RE.lastIndex = 0
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    const key = match.index

    if (token.startsWith('`')) {
      parts.push(
        <code key={key} className="rounded bg-muted/60 px-1 py-0.5 text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('$') && !token.startsWith('$$')) {
      parts.push(<Fragment key={key}>{renderKatex(token.slice(1, -1), false)}</Fragment>)
    } else if (token.startsWith('**')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('~~')) {
      parts.push(
        <del key={key} className="text-muted-foreground/70">
          {token.slice(2, -2)}
        </del>,
      )
    } else if (token.startsWith('*')) {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>)
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex === 0) return text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return <>{parts}</>
}

export function RichTextLite({ text, mode = 'full', className }: RichTextLiteProps) {
  const blocks = useMemo(() => parseRichTextLite(text), [text])
  if (blocks.length === 0) return null

  return (
    <div className={cn('space-y-3', mode === 'chat' && 'space-y-2', className)}>
      {blocks.map((block, index) => (
        <Fragment key={`${block.type}-${index}`}>
          {mode === 'chat' ? renderChatBlock(block) : renderFullBlock(block)}
        </Fragment>
      ))}
    </div>
  )
}

function renderFullBlock(block: RichTextLiteBlock) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="whitespace-pre-wrap text-inherit leading-relaxed">
          {renderInline(block.text)}
        </p>
      )
    case 'list':
      return block.style === 'ordered' ? (
        <ol className="list-decimal space-y-1 pl-5 text-inherit">
          {block.items.map((item, index) => (
            <li key={index} className="whitespace-pre-wrap leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-inherit">
          {block.items.map((item, index) => (
            <li key={index} className="whitespace-pre-wrap leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
    case 'quote':
      return (
        <blockquote className="border-l-2 border-border/70 pl-3 text-muted-foreground">
          <div className="space-y-2">
            {block.lines.map((line, index) => (
              <p key={index} className="whitespace-pre-wrap leading-relaxed">
                {renderInline(line)}
              </p>
            ))}
          </div>
        </blockquote>
      )
    case 'code_block':
      return (
        <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs leading-relaxed">
          <code>{block.code}</code>
        </pre>
      )
    case 'math_block':
      return (
        <div className="overflow-x-auto py-1">
          {renderKatex(block.expression, true)}
        </div>
      )
    case 'divider':
      return <hr className="border-border/60" />
  }
}

function renderChatBlock(block: RichTextLiteBlock) {
  if (block.type === 'divider') return null
  if (block.type === 'math_block') {
    return (
      <div className="overflow-x-auto py-1">
        {renderKatex(block.expression, true)}
      </div>
    )
  }
  return (
    <p className="whitespace-pre-wrap text-inherit leading-relaxed">
      {renderInline(toPlainText(block))}
    </p>
  )
}
