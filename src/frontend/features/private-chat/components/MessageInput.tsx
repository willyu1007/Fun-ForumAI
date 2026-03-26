import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { PrivateMessageAttachment, SendPrivateMessageInput } from '@/api/types'

interface MessageInputProps {
  onSend: (input: SendPrivateMessageInput) => Promise<void>
  onUploadAttachment: (file: File) => Promise<PrivateMessageAttachment>
  onCaptureScreenshot?: () => Promise<File | null>
  onEndSession: () => Promise<void>
  disabled?: boolean
  sessionEnded?: boolean
  toolbar?: (context: {
    openFilePicker: () => void
    captureScreenshot: () => void
    insertText: (value: string) => void
    disabled: boolean
    hasAttachment: boolean
    onEndSession: () => void
    ending: boolean
  }) => ReactNode
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
  onCaptureScreenshot,
  onEndSession,
  disabled,
  sessionEnded,
  toolbar,
}: MessageInputProps) {
  const messageInputId = 'private-chat-message-input'
  const fileInputId = 'private-chat-attachment-input'
  const [text, setText] = useState('')
  const [ending, setEnding] = useState(false)
  const [attachment, setAttachment] = useState<ComposerAttachmentState | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const insertTextAtCursor = (value: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setText((previous) => `${previous}${value}`)
      return
    }

    const selectionStart = textarea.selectionStart ?? text.length
    const selectionEnd = textarea.selectionEnd ?? text.length
    const nextValue = `${text.slice(0, selectionStart)}${value}${text.slice(selectionEnd)}`
    setText(nextValue)

    requestAnimationFrame(() => {
      textarea.focus()
      const nextCaret = selectionStart + value.length
      textarea.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const handleCaptureScreenshot = async () => {
    if (!onCaptureScreenshot || disabled) return
    const file = await onCaptureScreenshot()
    if (!file) return
    if (attachment?.preview_url) {
      URL.revokeObjectURL(attachment.preview_url)
    }
    await uploadAttachment(file)
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
    <div className={"border-t bg-background px-4 py-2"}>
      <div className={"mx-auto max-w-3xl"}>
        <input
          id={fileInputId}
          name="private_chat_attachment"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void handleFileChange(event)
          }}
        />

        {attachment && (
          <div className="mb-2 border-b border-border/60 pb-2">
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
                      : '图片已经准备好了，发送后会出现在这段聊天里。'}
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

        <div className="flex h-32 min-h-32 flex-col">
          {toolbar && (
            <div className="mb-1 flex min-h-7 items-center">
              {toolbar({
                openFilePicker: () => fileInputRef.current?.click(),
                captureScreenshot: () => {
                  void handleCaptureScreenshot()
                },
                insertText: insertTextAtCursor,
                disabled: Boolean(disabled),
                hasAttachment: Boolean(attachment),
                onEndSession: () => {
                  void handleEnd()
                },
                ending,
              })}
            </div>
          )}
          <textarea
            id={messageInputId}
            name="private_chat_message"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="发个消息…"
            className={"h-full min-h-0 w-full appearance-none resize-none overflow-y-auto border-0 rounded-none bg-transparent pl-2.5 pr-0 py-0 text-sm leading-6 text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground/80 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"}
            disabled={disabled}
            rows={4}
          />
        </div>
      </div>
    </div>
  )
}
