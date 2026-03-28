import { describe, expect, it } from 'vitest'
import { buildMatchPresentation, buildPreviewSource, buildSnippet, toSearchPreviewText } from '../search-snippet.js'

describe('buildMatchPresentation', () => {
  it('keeps direct field reasons when the query is explicitly present', () => {
    const result = buildMatchPresentation('talk show', [
      { reason: '命中标题', code: 'title', field: 'title', value: 'Late-night talk show opening' },
      { reason: '命中社区', code: 'community', field: 'community', value: 'Comedy Forum' },
    ], { fallback_text: 'Late-night talk show opening' })

    expect(result.match_reasons).toContain('命中标题')
    expect(result.match_reason_codes).toContain('title')
    expect(result.highlights[0]).toMatchObject({
      field: 'title',
    })
  })

  it('falls back to fuzzy relevance when only weak character overlap exists', () => {
    const result = buildMatchPresentation('abc', [
      { reason: '命中标题', code: 'title', field: 'title', value: 'alone wolf night' },
      { reason: '命中社区', code: 'community', field: 'community', value: 'zeta ring' },
    ], { fallback_text: 'fallback body for fuzzy hit' })

    expect(result.match_reasons).toEqual(['文本相关'])
    expect(result.match_reason_codes).toEqual(['fuzzy_relevance'])
    expect(result.highlights).toEqual([
      { field: 'text', snippet: 'fallback body for fuzzy hit' },
    ])
  })
})

describe('buildSnippet', () => {
  it('drops fenced code blocks and keeps inline code as plain text', () => {
    const snippet = buildSnippet(
      [
        '最近我尝试用 Rust 的零成本抽象来实现 BFS 和 DFS。',
        '',
        '```rust',
        'struct Graph<T> {',
        '  nodes: Vec<Node<T>>,',
        '}',
        '```',
        '',
        '关键洞察在于使用 `Vec` 做索引。',
      ].join('\n'),
      'Graph',
      180,
    )

    expect(snippet).toContain('最近我尝试用 Rust 的零成本抽象来实现 BFS 和 DFS。')
    expect(snippet).toContain('关键洞察在于使用 Vec 做索引。')
    expect(snippet).not.toContain('struct Graph<T>')
    expect(snippet).not.toContain('```')
    expect(snippet).not.toContain('`Vec`')
  })
})

describe('search preview helpers', () => {
  it('converts markdown content into plain text preview text', () => {
    const preview = toSearchPreviewText([
      '# 标题',
      '',
      '这是 [链接](https://example.com) 和 `inline code`。',
      '',
      '```ts',
      'const hidden = true',
      '```',
    ].join('\n'))

    expect(preview).toBe('标题 这是 链接 和 inline code。')
  })

  it('joins preview parts without leaving empty separators for removed code blocks', () => {
    const preview = buildPreviewSource([
      '第一段正文',
      '```rust\nstruct Graph<T> {}\n```',
      '第二段正文',
    ])

    expect(preview).toBe('第一段正文 · 第二段正文')
  })
})
