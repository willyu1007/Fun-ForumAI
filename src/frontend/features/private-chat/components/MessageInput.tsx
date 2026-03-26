import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { AlertCircle, LoaderCircle, X } from 'lucide-react'
import type { PrivateMessageAttachment, SendPrivateMessageInput } from '@/api/types'
import { cn } from '@/lib/utils'

interface MessageInputProps {
  onSend: (input: SendPrivateMessageInput) => Promise<void>
  onUploadAttachment: (file: File) => Promise<PrivateMessageAttachment>
  onCaptureScreenshot?: () => Promise<File | null>
  onEndSession: () => Promise<void>
  draftStorageKey?: string
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
  draftStorageKey,
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

  useEffect(() => {
    if (typeof window === 'undefined' || !draftStorageKey) return

    const savedDraft = window.localStorage.getItem(draftStorageKey)
    setText(savedDraft ?? '')
  }, [draftStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftStorageKey) return

    if (text) {
      window.localStorage.setItem(draftStorageKey, text)
      return
    }

    window.localStorage.removeItem(draftStorageKey)
  }, [draftStorageKey, text])

  const inputDisabled = Boolean(disabled)
  const canSend = Boolean(text.trim() || attachment?.uploaded) && !attachment?.uploading && !inputDisabled

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
    if (!file || inputDisabled) return
    if (attachment?.preview_url) {
      URL.revokeObjectURL(attachment.preview_url)
    }
    await uploadAttachment(file)
  }

  const handleRetryUpload = async () => {
    if (!attachment || inputDisabled) return
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
    if (!onCaptureScreenshot || inputDisabled) return
    const file = await onCaptureScreenshot()
    if (!file) return
    if (attachment?.preview_url) {
      URL.revokeObjectURL(attachment.preview_url)
    }
    await uploadAttachment(file)
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (inputDisabled) return

    const imageItem = Array.from(event.clipboardData.items).find(
      (item) => item.kind === 'file' && item.type.startsWith('image/'),
    )

    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return

    if (attachment) {
      event.preventDefault()
      return
    }

    event.preventDefault()

    void uploadAttachment(file)
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

        <div className="flex flex-col pl-2.5">
          {toolbar && (
            <div className="mb-1 flex min-h-7 items-center" data-testid="composer-toolbar-row">
              {toolbar({
                openFilePicker: () => fileInputRef.current?.click(),
                captureScreenshot: () => {
                  void handleCaptureScreenshot()
                },
                insertText: insertTextAtCursor,
                disabled: inputDisabled,
                hasAttachment: Boolean(attachment),
                onEndSession: () => {
                  void handleEnd()
                },
                ending,
              })}
            </div>
          )}
          {attachment && (
            <div className="mb-1 ml-1.5 flex items-center" data-testid="composer-attachment-row">
              <div
                data-testid="composer-attachment-frame"
                className={cn(
                  'group relative overflow-hidden rounded-md border border-border/70 bg-muted/20 p-1',
                  attachment.error && 'ring-1 ring-destructive/50',
                )}
              >
                <img
                  src={attachment.preview_url}
                  alt={attachment.uploaded?.alt_text ?? attachment.file.name}
                  className="h-14 w-14 rounded-sm object-cover"
                />
                <button
                  type="button"
                  aria-label="移除图片"
                  title="移除图片"
                  onClick={handleRemoveAttachment}
                  disabled={attachment.uploading || disabled}
                  className={cn(
                    'absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity',
                    'group-hover:opacity-100 group-focus-within:opacity-100',
                    (attachment.uploading || disabled) && 'pointer-events-none',
                  )}
                >
                  <X className="size-3" />
                </button>
                {attachment.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/12">
                    <LoaderCircle className="size-4 animate-spin text-foreground" />
                  </div>
                )}
                {attachment.error && !attachment.uploading && (
                  <button
                    type="button"
                    aria-label="重试上传"
                    title={attachment.error}
                    onClick={() => void handleRetryUpload()}
                    disabled={disabled}
                    className="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-destructive transition-opacity hover:text-destructive focus-visible:outline-none"
                  >
                    <AlertCircle className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="ml-1.5 flex h-32 min-h-32 flex-col">
            <textarea
              id={messageInputId}
              name="private_chat_message"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder="发个消息…"
              data-testid="private-chat-composer-textarea"
              className={"h-full min-h-0 w-full appearance-none resize-none overflow-y-auto border-0 rounded-none bg-transparent pl-0 pr-0 py-0 text-sm leading-6 text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground/80 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"}
              disabled={inputDisabled}
              rows={4}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
