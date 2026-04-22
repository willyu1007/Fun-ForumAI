export type RichTextLiteBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; style: 'unordered' | 'ordered'; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'code_block'; language: string | null; code: string }
  | { type: 'math_block'; expression: string }
  | { type: 'divider' }

const BLANK_LINE_RE = /^\s*$/
const DIVIDER_RE = /^\s*(?:---|\*\*\*)\s*$/
const MATH_FENCE_RE = /^\s*\$\$\s*$/
const CODE_FENCE_RE = /^\s*```([\w-]+)?\s*$/
const QUOTE_LINE_RE = /^\s*>\s?(.*)$/
const UNORDERED_LIST_RE = /^\s*[-*•·]\s+(.*)$/
const ORDERED_LIST_RE = /^\s*(?:\d+[.)]|[一二三四五六七八九十]+、|（\d+）)\s*(.*)$/
const LIST_CONTINUATION_RE = /^\s{2,}\S/

export function parseRichTextLite(input: string): RichTextLiteBlock[] {
  const text = input.replace(/\r\n?/g, '\n').trim()
  if (!text) return []

  const lines = text.split('\n')
  const blocks: RichTextLiteBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (BLANK_LINE_RE.test(line)) {
      index += 1
      continue
    }

    if (MATH_FENCE_RE.test(line)) {
      const mathLines: string[] = []
      index += 1
      while (index < lines.length && !MATH_FENCE_RE.test(lines[index] ?? '')) {
        mathLines.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length && MATH_FENCE_RE.test(lines[index] ?? '')) {
        index += 1
      }
      blocks.push({ type: 'math_block', expression: mathLines.join('\n').trim() })
      continue
    }

    const codeFenceMatch = line.match(CODE_FENCE_RE)
    if (codeFenceMatch) {
      const language = codeFenceMatch[1] ?? null
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !CODE_FENCE_RE.test(lines[index] ?? '')) {
        codeLines.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length && CODE_FENCE_RE.test(lines[index] ?? '')) {
        index += 1
      }
      blocks.push({ type: 'code_block', language, code: codeLines.join('\n').trimEnd() })
      continue
    }

    if (DIVIDER_RE.test(line)) {
      blocks.push({ type: 'divider' })
      index += 1
      continue
    }

    const quoteMatch = line.match(QUOTE_LINE_RE)
    if (quoteMatch) {
      const quoteLines: string[] = []
      while (index < lines.length) {
        const currentLine = lines[index] ?? ''
        const currentQuoteMatch = currentLine.match(QUOTE_LINE_RE)
        if (!currentQuoteMatch) break
        quoteLines.push(currentQuoteMatch[1].trimEnd())
        index += 1
      }
      blocks.push({ type: 'quote', lines: quoteLines })
      continue
    }

    const listBlock = parseListBlock(lines, index)
    if (listBlock) {
      blocks.push(listBlock.block)
      index = listBlock.nextIndex
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const currentLine = lines[index] ?? ''
      if (
        BLANK_LINE_RE.test(currentLine)
        || DIVIDER_RE.test(currentLine)
        || MATH_FENCE_RE.test(currentLine)
        || CODE_FENCE_RE.test(currentLine)
        || QUOTE_LINE_RE.test(currentLine)
        || UNORDERED_LIST_RE.test(currentLine)
        || ORDERED_LIST_RE.test(currentLine)
      ) {
        break
      }
      paragraphLines.push(currentLine.trimEnd())
      index += 1
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphLines.join('\n').trim() })
      continue
    }

    index += 1
  }

  return blocks
}

export function extractRichTextPreview(input: string, maxLength = 160): string {
  const blocks = parseRichTextLite(input)
  const firstReadable = blocks.find((block) => block.type !== 'divider')
  if (!firstReadable) {
    return normalizePreviewText(input, maxLength)
  }

  return normalizePreviewText(toPreviewText(firstReadable), maxLength)
}

export function extractRichTextPlainPreview(
  input: string,
  maxLength = 160,
  options?: { reserve?: number },
): string {
  const blocks = parseRichTextLite(input)
  const firstReadable = blocks.find((block) => block.type !== 'divider')
  if (!firstReadable) {
    return normalizePreviewText(input, maxLength, options)
  }

  return normalizePreviewText(toPlainPreviewText(firstReadable), maxLength, options)
}

export function toPlainText(block: RichTextLiteBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.text
    case 'list':
      return block.items.map((item) => `• ${item}`).join('\n')
    case 'quote':
      return block.lines.map((line) => `> ${line}`).join('\n')
    case 'code_block':
      return block.code
    case 'math_block':
      return block.expression
    case 'divider':
      return ''
  }
}

function toPreviewText(block: RichTextLiteBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.text
    case 'list':
      return block.items[0] ? `• ${block.items[0]}` : ''
    case 'quote':
      return block.lines[0] ? `> ${block.lines[0]}` : ''
    case 'code_block':
      return block.code
    case 'math_block':
      return block.expression
    case 'divider':
      return ''
  }
}

function toPlainPreviewText(block: RichTextLiteBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.text
    case 'list':
      return block.items.join(' ')
    case 'quote':
      return block.lines.join(' ')
    case 'code_block':
      return block.code
    case 'math_block':
      return block.expression
    case 'divider':
      return ''
  }
}

function parseListBlock(
  lines: string[],
  startIndex: number,
): { block: Extract<RichTextLiteBlock, { type: 'list' }>; nextIndex: number } | null {
  const firstLine = lines[startIndex] ?? ''
  const firstMatch = matchListLine(firstLine)
  if (!firstMatch) return null

  const items = [firstMatch.text]
  const style = firstMatch.style
  let index = startIndex + 1

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (BLANK_LINE_RE.test(line)) break

    const nextMatch = matchListLine(line)
    if (nextMatch) {
      items.push(nextMatch.text)
      index += 1
      continue
    }

    if (LIST_CONTINUATION_RE.test(line) && items.length > 0) {
      items[items.length - 1] = `${items[items.length - 1]}\n${line.trim()}`
      index += 1
      continue
    }

    break
  }

  return {
    block: { type: 'list', style, items },
    nextIndex: index,
  }
}

function matchListLine(line: string): { style: 'unordered' | 'ordered'; text: string } | null {
  const unordered = line.match(UNORDERED_LIST_RE)
  if (unordered) {
    return { style: 'unordered', text: unordered[1].trim() }
  }

  const ordered = line.match(ORDERED_LIST_RE)
  if (ordered) {
    return { style: 'ordered', text: ordered[1].trim() }
  }

  return null
}

function normalizePreviewText(
  text: string,
  maxLength: number,
  options?: { reserve?: number },
): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized

  const hardLimit = Math.max(0, maxLength - 1)
  const reserve = Math.max(0, Math.min(options?.reserve ?? 0, hardLimit))
  const boundaryCutoff = reserve > 0
    ? findPreviewBoundary(normalized, Math.max(0, hardLimit - reserve), hardLimit)
    : null
  const cutoff = boundaryCutoff ?? hardLimit

  return `${normalized.slice(0, cutoff).trimEnd()}…`
}

function findPreviewBoundary(text: string, start: number, end: number): number | null {
  let weakBoundary: number | null = null
  let whitespaceBoundary: number | null = null

  for (let index = end - 1; index >= start; index -= 1) {
    const char = text[index] ?? ''
    if (!char) continue
    if (/[。！？!?；;…]/.test(char)) {
      return index + 1
    }
    if (weakBoundary === null && /[，,、：:]/.test(char)) {
      weakBoundary = index + 1
    }
    if (whitespaceBoundary === null && /\s/.test(char)) {
      whitespaceBoundary = index
    }
  }

  return weakBoundary ?? whitespaceBoundary
}
