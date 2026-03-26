import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrivateMessageAttachment } from '@/api/types'
import { MessageInput } from '../MessageInput'

describe('MessageInput attachment preview', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:preview-image'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    window.localStorage.clear()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    })
  })

  it('renders a compact image-only preview without filename or helper copy', async () => {
    const uploadedAttachment: PrivateMessageAttachment = {
      asset_id: 'asset-1',
      display_variant: 'original',
      display_url: 'https://example.test/image.png',
      placeholder: null,
      mime_type: 'image/png',
      alt_text: '截图预览',
      width: 320,
      height: 180,
      state: 'ready',
    }

    const onUploadAttachment = vi.fn(async () => uploadedAttachment)

    const { container } = render(
      <MessageInput
        onSend={vi.fn(async () => undefined)}
        onUploadAttachment={onUploadAttachment}
        onEndSession={vi.fn(async () => undefined)}
        toolbar={() => <div>toolbar</div>}
      />,
    )

    expect(screen.queryByTestId('composer-attachment-row')).toBeNull()

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(fileInput).toBeTruthy()

    const file = new File(['image-bytes'], 'forum-screenshot.png', { type: 'image/png' })

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    })

    fireEvent.change(fileInput!)

    await waitFor(() => {
      expect(onUploadAttachment).toHaveBeenCalledWith(file)
    })

    const toolbarRow = screen.getByTestId('composer-toolbar-row')
    const attachmentRow = screen.getByTestId('composer-attachment-row')
    const attachmentFrame = screen.getByTestId('composer-attachment-frame')
    const textarea = screen.getByPlaceholderText('发个消息…')

    expect(screen.getByRole('img', { name: '截图预览' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '移除图片' })).toBeTruthy()
    expect(screen.queryByText('forum-screenshot.png')).toBeNull()
    expect(screen.queryByText('图片已经准备好了，发送后会出现在这段聊天里。')).toBeNull()
    expect(attachmentFrame.className).toContain('border')
    expect(toolbarRow.compareDocumentPosition(attachmentRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(attachmentRow.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the text input editable while the attachment upload is still pending', async () => {
    const uploadController: {
      resolve: ((value: PrivateMessageAttachment) => void) | null
    } = { resolve: null }
    const onUploadAttachment = vi.fn(
      () =>
        new Promise<PrivateMessageAttachment>((resolve) => {
          uploadController.resolve = resolve
        }),
    )

    const { container } = render(
      <MessageInput
        onSend={vi.fn(async () => undefined)}
        onUploadAttachment={onUploadAttachment}
        onEndSession={vi.fn(async () => undefined)}
      />,
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(fileInput).toBeTruthy()

    const file = new File(['image-bytes'], 'forum-screenshot.png', { type: 'image/png' })

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    })

    fireEvent.change(fileInput!)

    await waitFor(() => {
      expect(onUploadAttachment).toHaveBeenCalledWith(file)
    })

    const textarea = screen.getByPlaceholderText('发个消息…') as HTMLTextAreaElement
    expect(textarea.disabled).toBe(false)

    fireEvent.change(textarea, { target: { value: '上传中也能继续写字' } })
    expect(textarea.value).toBe('上传中也能继续写字')

    const finishUpload = uploadController.resolve
    if (!finishUpload) {
      throw new Error('upload resolver was not captured')
    }

    finishUpload({
      asset_id: 'asset-1',
      display_variant: 'original',
      display_url: 'https://example.test/image.png',
      placeholder: null,
      mime_type: 'image/png',
      alt_text: '截图预览',
      width: 320,
      height: 180,
      state: 'ready',
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '移除图片' })).toBeTruthy()
    })
  })

  it('accepts pasted images into the attachment row while keeping text paste for normal input', async () => {
    const uploadedAttachment: PrivateMessageAttachment = {
      asset_id: 'asset-paste',
      display_variant: 'original',
      display_url: 'https://example.test/paste.png',
      placeholder: null,
      mime_type: 'image/png',
      alt_text: '粘贴截图',
      width: 320,
      height: 180,
      state: 'ready',
    }

    const onUploadAttachment = vi.fn(async () => uploadedAttachment)

    render(
      <MessageInput
        onSend={vi.fn(async () => undefined)}
        onUploadAttachment={onUploadAttachment}
        onEndSession={vi.fn(async () => undefined)}
      />,
    )

    const textarea = screen.getByTestId('private-chat-composer-textarea') as HTMLTextAreaElement
    const pastedFile = new File(['paste-bytes'], 'clipboard.png', { type: 'image/png' })

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => pastedFile,
          },
        ],
      },
    })

    await waitFor(() => {
      expect(onUploadAttachment).toHaveBeenCalledWith(pastedFile)
    })

    expect(screen.getByRole('img', { name: '粘贴截图' })).toBeTruthy()

    fireEvent.change(textarea, { target: { value: '继续补一句话' } })
    expect(textarea.value).toBe('继续补一句话')
  })

  it('restores the unsent draft text when the same chat composer is reopened', () => {
    const draftStorageKey = 'private-chat-draft:agent-2:session-1'

    const view = render(
      <MessageInput
        onSend={vi.fn(async () => undefined)}
        onUploadAttachment={vi.fn(async () => {
          throw new Error('should not upload in draft restore test')
        })}
        onEndSession={vi.fn(async () => undefined)}
        draftStorageKey={draftStorageKey}
      />,
    )

    const textarea = screen.getByTestId('private-chat-composer-textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '这段话先留着，下次回来继续写' } })

    expect(window.localStorage.getItem(draftStorageKey)).toBe('这段话先留着，下次回来继续写')

    view.unmount()

    render(
      <MessageInput
        onSend={vi.fn(async () => undefined)}
        onUploadAttachment={vi.fn(async () => {
          throw new Error('should not upload in draft restore test')
        })}
        onEndSession={vi.fn(async () => undefined)}
        draftStorageKey={draftStorageKey}
      />,
    )

    expect((screen.getByTestId('private-chat-composer-textarea') as HTMLTextAreaElement).value).toBe('这段话先留着，下次回来继续写')
  })
})
