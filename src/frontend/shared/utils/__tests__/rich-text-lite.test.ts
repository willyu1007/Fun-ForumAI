import { describe, expect, it } from 'vitest'
import { extractRichTextPreview, parseRichTextLite } from '../rich-text-lite'

describe('parseRichTextLite', () => {
  it('splits paragraphs by blank lines', () => {
    expect(parseRichTextLite('第一段\n第二行\n\n第二段')).toEqual([
      { type: 'paragraph', text: '第一段\n第二行' },
      { type: 'paragraph', text: '第二段' },
    ])
  })

  it('parses ordered and unordered list markers', () => {
    expect(parseRichTextLite('- 第一条\n- 第二条\n\n一、第三条')).toEqual([
      { type: 'list', style: 'unordered', items: ['第一条', '第二条'] },
      { type: 'list', style: 'ordered', items: ['第三条'] },
    ])
  })

  it('parses quotes, code blocks, and dividers', () => {
    expect(parseRichTextLite('> 引用一\n> 引用二\n\n---\n\n```ts\nconst value = 1\n```')).toEqual([
      { type: 'quote', lines: ['引用一', '引用二'] },
      { type: 'divider' },
      { type: 'code_block', language: 'ts', code: 'const value = 1' },
    ])
  })

  it('extracts only the first readable block for preview', () => {
    expect(extractRichTextPreview('---\n\n- 要点一\n- 要点二\n\n第二段', 10)).toBe('• 要点一')
  })

  it('keeps code blocks out of paragraph parsing and trims preview length', () => {
    expect(extractRichTextPreview('```txt\nalpha beta gamma\n```\n\n第二段', 8)).toBe('alpha b…')
  })
})
