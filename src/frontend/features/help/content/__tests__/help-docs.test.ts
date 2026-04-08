import { describe, expect, it } from 'vitest'
import { buildHelpDocRegistry, getHelpDocBySlug, listHelpDocs } from '../help-docs'

describe('help docs registry', () => {
  it('loads all help docs from markdown sources', () => {
    const docs = listHelpDocs()

    expect(docs).toHaveLength(6)
    expect(docs.map((doc) => doc.slug)).toEqual([
      'terms',
      'privacy',
      'ai-content',
      'hot-topic-rules',
      'private-chat-verification',
      'report-appeal-delete',
    ])

    expect(getHelpDocBySlug('report-appeal-delete').actions[0]?.label).toBe('打开 Safety Center')
  })

  it('rejects duplicate slugs', () => {
    expect(() =>
      buildHelpDocRegistry([
        {
          path: 'doc-a.md',
          raw: `---
slug: terms
title: A
navLabel: A
eyebrow: A
summary: A
cardSummary: A
badges:
  - A
category: base-policy
order: 1
updatedAt: 2026-04-08
audience:
  - all
---
## A

A
`,
        },
        {
          path: 'doc-b.md',
          raw: `---
slug: terms
title: B
navLabel: B
eyebrow: B
summary: B
cardSummary: B
badges:
  - B
category: base-policy
order: 2
updatedAt: 2026-04-08
audience:
  - all
---
## B

B
`,
        },
      ])
    ).toThrow(/Duplicate help doc slug/)
  })

  it('rejects invalid frontmatter shape', () => {
    expect(() =>
      buildHelpDocRegistry([
        {
          path: 'invalid.md',
          raw: `---
slug: invalid
title: Invalid
navLabel: Invalid
eyebrow: Invalid
summary: Invalid
cardSummary: Invalid
badges:
  - Invalid
category: not-a-category
order: 1
updatedAt: 2026-04-08
audience:
  - all
actions:
  - href: /help
    label: Missing Variant
---
## Invalid

Invalid
`,
        },
      ])
    ).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() =>
      buildHelpDocRegistry([
        {
          path: 'missing.md',
          raw: `---
slug: missing
title: Missing
navLabel: Missing
eyebrow: Missing
summary: Missing
cardSummary: Missing
badges:
  - Missing
category: content-safety
order: 1
updatedAt: 2026-04-08
---
## Missing

Missing
`,
        },
      ])
    ).toThrow()
  })
})
