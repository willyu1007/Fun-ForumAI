import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { PrivateMessageAttachment, SendPrivateMessageInput } from '@/api/types'
import { getPrivateDigestThresholdHint } from '../digest-guidance'

interface MessageInputProps {
  onSend: (input: SendPrivateMessageInput) => Promise<void>
  onUploadAttachment: (file: File) => Promise<PrivateMessageAttachment>
  onEndSession: () => Promise<void>
  disabled?: boolean
  sessionEnded?: boolean
  messageCount?: number
}

interface ComposerAttachmentState {
  file: File
  preview_url: string
  uploaded: PrivateMessageAttachment | null
  uploading: boolean
  error: string | null
}

export function MessageInput({
  onSend,
  onUploadAttachment,
  onEndSession,
  disabled,
  sessionEnded,
  messageCount = 0,
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [ending, setEnding] = useState(false)
  const [attachment, setAttachment] = useState<ComposerAttachmentState | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const digestHint = sessionEnded ? null : getPrivateDigestThresholdHint(messageCount)

  useEffect(() => {
    return () => {
      if (attachment?.preview_url) {
        URL.revokeObjectURL(attachment.preview_url)
      }
    }
  }, [attachment?.preview_url])

  const canSend = Boolean(text.trim() || attachment?.uploaded) && !attachment?.uploading && !disabled

  const uploadAttachment = async (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setAttachment({
      file,
      preview_url: previewUrl,
      uploaded: null,
      uploading: true,
      error: null,
    })

    try {
      const uploaded = await onUploadAttachment(file)
      setAttachment({
        file,
        preview_url: previewUrl,
        uploaded,
        uploading: false,
        error: null,
      })
    } catch (error) {
      setAttachment({
        file,
        preview_url: previewUrl,
        uploaded: null,
        uploading: false,
        error: error instanceof Error ? error.message : '图片上传失败，请重试。',
      })
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || disabled) return
    if (attachment?.preview_url) {
      URL.revokeObjectURL(attachment.preview_url)
    }
    await uploadAttachment(file)
  }

  const handleRetryUpload = async () => {
    if (!attachment || disabled) return
    await uploadAttachment(attachment.file)
  }

  const handleRemoveAttachment = () => {
    if (attachment?.preview_url) {
      URL.revokeObjectURL(attachment.preview_url)
    }
    setAttachment(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSend = async () => {
    if (!canSend) return
    await onSend({
      content: text,
      attachment_asset_ids: attachment?.uploaded ? [attachment.uploaded.asset_id] : undefined,
    })
    setText('')
    if (attachment?.preview_url) {
      URL.revokeObjectURL(attachment.preview_url)
    }
    setAttachment(null)
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
    <div className={"border-t bg-background px-4 py-3"}>
      <div className={"mx-auto max-w-2xl"}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void handleFileChange(event)
          }}
        />

        {attachment && (
          <div className="mb-3 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-start gap-3">
              <img
                src={attachment.preview_url}
                alt={attachment.uploaded?.alt_text ?? attachment.file.name}
                className="h-20 w-20 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attachment.file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {attachment.uploading
                    ? '上传中...'
                    : attachment.error
                      ? attachment.error
                      : '图片已就绪，发送后会进入当前私聊与后续 private memory。'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachment.error && (
                    <Button size="sm" variant="outline" onClick={() => void handleRetryUpload()} disabled={disabled}>
                      重试上传
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={handleRemoveAttachment} disabled={attachment.uploading || disabled}>
                    移除图片
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              className={"min-h-[44px] max-h-32 resize-none"}
              disabled={disabled}
              rows={1}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={Boolean(attachment) || disabled}
              >
                添加图片
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Button onClick={() => void handleSend()} disabled={!canSend} size="sm">
              发送
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={"text-xs text-muted-foreground"}
              onClick={() => void handleEnd()}
              disabled={ending || disabled}
            >
              结束
            </Button>
          </div>
        </div>

        {digestHint && <p className={"mt-2 text-xs text-muted-foreground"}>{digestHint}</p>}
      </div>
    </div>
  )
}
