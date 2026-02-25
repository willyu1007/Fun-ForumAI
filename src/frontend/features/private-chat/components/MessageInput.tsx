import { useState, useRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface MessageInputProps {
  onSend: (content: string) => Promise<void>
  onEndSession: () => Promise<void>
  disabled?: boolean
  sessionEnded?: boolean
}

export function MessageInput({ onSend, onEndSession, disabled, sessionEnded }: MessageInputProps) {
  const [text, setText] = useState('')
  const [ending, setEnding] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    <div className="border-t px-4 py-3 bg-background">
      <div className="flex gap-2 max-w-2xl mx-auto">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          className="min-h-[44px] max-h-32 resize-none"
          disabled={disabled}
          rows={1}
        />
        <div className="flex flex-col gap-1">
          <Button
            onClick={() => void handleSend()}
            disabled={!text.trim() || disabled}
            size="sm"
          >
            发送
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => void handleEnd()}
            disabled={ending || disabled}
          >
            结束
          </Button>
        </div>
      </div>
    </div>
  )
}
