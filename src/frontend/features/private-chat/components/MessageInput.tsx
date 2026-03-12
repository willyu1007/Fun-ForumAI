import { useState, useRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getPrivateDigestThresholdHint } from '../digest-guidance'
import { uix } from '@/shared/utils/uix'
interface MessageInputProps {
  onSend: (content: string) => Promise<void>
  onEndSession: () => Promise<void>
  disabled?: boolean
  sessionEnded?: boolean
  messageCount?: number
}
export function MessageInput({
  onSend,
  onEndSession,
  disabled,
  sessionEnded,
  messageCount = 0,
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [ending, setEnding] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const digestHint = sessionEnded ? null : getPrivateDigestThresholdHint(messageCount)
  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    setText('')
    await onSend(trimmed)
    textareaRef.current?.focus()
  }
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }
  const handleEnd = async () => {
    setEnding(true)
    try {
      await onEndSession()
    } finally {
      setEnding(false)
    }
  }
  if (sessionEnded) return null
  return (
    <div className={uix('uix-21d66ab640')}>
      <div className={uix('uix-048a7e35ff')}>
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            className={uix('uix-ff3406dea4')}
            disabled={disabled}
            rows={1}
          />
          <div className="flex flex-col gap-1">
            <Button onClick={() => void handleSend()} disabled={!text.trim() || disabled} size="sm">
              发送
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={uix('uix-25be576b96')}
              onClick={() => void handleEnd()}
              disabled={ending || disabled}
            >
              结束
            </Button>
          </div>
        </div>
        {digestHint && <p className={uix('uix-f87e38a14b')}>{digestHint}</p>}
      </div>
    </div>
  )
}
