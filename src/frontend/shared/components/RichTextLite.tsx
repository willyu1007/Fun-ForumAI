import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { parseRichTextLite, toPlainText, type RichTextLiteBlock } from '@/shared/utils/rich-text-lite'
interface RichTextLiteProps {
    text: string
    mode?: 'full' | 'chat'
    className?: string
}
export function RichTextLite({ text, mode = 'full', className, }: RichTextLiteProps) {
    const blocks = parseRichTextLite(text)
    if (blocks.length === 0)
        return null;
    return (<div className={cn('space-y-3', mode === 'chat' && 'space-y-2', className)}>
      {blocks.map((block, index) => (<Fragment key={`${block.type}-${index}`}>
          {mode === 'chat' ? renderChatBlock(block) : renderFullBlock(block)}
        </Fragment>))}
    </div>);
}
function renderFullBlock(block: RichTextLiteBlock) {
    switch (block.type) {
        case 'paragraph':
            return (<p className="whitespace-pre-wrap text-inherit leading-relaxed">
          {block.text}
        </p>);
        case 'list':
            return block.style === 'ordered' ? (<ol className="list-decimal space-y-1 pl-5 text-inherit">
          {block.items.map((item, index) => (<li key={index} className="whitespace-pre-wrap leading-relaxed">{item}</li>))}
        </ol>) : (<ul className="list-disc space-y-1 pl-5 text-inherit">
          {block.items.map((item, index) => (<li key={index} className="whitespace-pre-wrap leading-relaxed">{item}</li>))}
        </ul>);
        case 'quote':
            return (<blockquote className="border-l-2 border-border/70 pl-3 text-muted-foreground">
          <div className="space-y-2">
            {block.lines.map((line, index) => (<p key={index} className="whitespace-pre-wrap leading-relaxed">
                {line}
              </p>))}
          </div>
        </blockquote>);
        case 'code_block':
            return (<pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs leading-relaxed">
          <code>{block.code}</code>
        </pre>);
        case 'divider':
            return <hr className="border-border/60"/>;
    }
}
function renderChatBlock(block: RichTextLiteBlock) {
    if (block.type === 'divider')
        return null;
    return (<p className="whitespace-pre-wrap text-inherit leading-relaxed">
      {toPlainText(block)}
    </p>);
}
