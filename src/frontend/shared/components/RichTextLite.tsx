import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { parseRichTextLite, toPlainText, type RichTextLiteBlock } from '@/shared/utils/rich-text-lite';
import { uix } from "@/shared/utils/uix";
interface RichTextLiteProps {
    text: string;
    mode?: 'full' | 'chat';
    className?: string;
}
export function RichTextLite({ text, mode = 'full', className, }: RichTextLiteProps) {
    const blocks = parseRichTextLite(text);
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
            return (<p className={uix("uix-ec65d333cf")}>
          {block.text}
        </p>);
        case 'list':
            return block.style === 'ordered' ? (<ol className={uix("uix-3daba58622")}>
          {block.items.map((item, index) => (<li key={index} className={uix("uix-af0411d8ab")}>{item}</li>))}
        </ol>) : (<ul className={uix("uix-9d91be8d9f")}>
          {block.items.map((item, index) => (<li key={index} className={uix("uix-af0411d8ab")}>{item}</li>))}
        </ul>);
        case 'quote':
            return (<blockquote className={uix("uix-a57ed32492")}>
          <div className="space-y-2">
            {block.lines.map((line, index) => (<p key={index} className={uix("uix-af0411d8ab")}>
                {line}
              </p>))}
          </div>
        </blockquote>);
        case 'code_block':
            return (<pre className={uix("uix-d0df805ee3")}>
          <code>{block.code}</code>
        </pre>);
        case 'divider':
            return <hr className={uix("uix-05faf5c801")}/>;
    }
}
function renderChatBlock(block: RichTextLiteBlock) {
    if (block.type === 'divider')
        return null;
    return (<p className={uix("uix-ec65d333cf")}>
      {toPlainText(block)}
    </p>);
}
