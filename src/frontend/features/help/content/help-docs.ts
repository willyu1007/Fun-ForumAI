import yaml from 'yaml'
import { z } from 'zod'

const HELP_DOC_CATEGORY_VALUES = ['base-policy', 'content-safety', 'identity-governance'] as const
const HELP_DOC_AUDIENCE_VALUES = ['observer', 'owner', 'all'] as const

const helpDocLinkSchema = z.object({
  href: z.string().min(1),
  label: z.string().min(1),
})

const helpDocActionSchema = helpDocLinkSchema.extend({
  variant: z.enum(['primary', 'secondary']),
})

const helpDocFrontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  navLabel: z.string().min(1),
  eyebrow: z.string().min(1),
  summary: z.string().min(1),
  cardSummary: z.string().min(1),
  badges: z.array(z.string().min(1)).min(1),
  category: z.enum(HELP_DOC_CATEGORY_VALUES),
  order: z.number().int().nonnegative(),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  audience: z.array(z.enum(HELP_DOC_AUDIENCE_VALUES)).min(1),
  related: z.array(helpDocLinkSchema).optional(),
  actions: z.array(helpDocActionSchema).optional(),
})

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/u

type RawHelpDocSource = {
  path: string
  raw: string
}

export type HelpDocCategory = z.infer<typeof helpDocFrontmatterSchema>['category']
export type HelpDocAudience = z.infer<typeof helpDocFrontmatterSchema>['audience'][number]
export type HelpDocFrontmatter = z.infer<typeof helpDocFrontmatterSchema>
export type HelpDocLink = z.infer<typeof helpDocLinkSchema>
export type HelpDocAction = z.infer<typeof helpDocActionSchema>
export type HelpDocRecord = Omit<HelpDocFrontmatter, 'related' | 'actions'> & {
  href: string
  body: string
  sourcePath: string
  related: HelpDocLink[]
  actions: HelpDocAction[]
}

function splitHelpDocSource(raw: string) {
  const normalized = raw.replace(/\r\n?/gu, '\n')
  const match = normalized.match(FRONTMATTER_RE)

  if (!match) {
    throw new Error('Help doc is missing YAML frontmatter block.')
  }

  const frontmatter = yaml.parse(match[1] ?? '') ?? {}
  const body = normalized.slice(match[0].length).trim()

  if (!body) {
    throw new Error('Help doc body must not be empty.')
  }

  return { frontmatter, body }
}

export function getHelpDocHref(slug: string) {
  switch (slug) {
    case 'terms':
      return '/terms'
    case 'privacy':
      return '/privacy'
    default:
      return `/help/${slug}`
  }
}

function normalizeHelpDoc(source: RawHelpDocSource): HelpDocRecord {
  const { frontmatter, body } = splitHelpDocSource(source.raw)
  const parsed = helpDocFrontmatterSchema.parse(frontmatter)

  return {
    ...parsed,
    href: getHelpDocHref(parsed.slug),
    body,
    sourcePath: source.path,
    related: parsed.related ?? [],
    actions: parsed.actions ?? [],
  }
}

function sortHelpDocs(left: HelpDocRecord, right: HelpDocRecord) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  return left.title.localeCompare(right.title, 'zh-CN')
}

export function buildHelpDocRegistry(sources: RawHelpDocSource[]) {
  const docs = sources.map(normalizeHelpDoc).sort(sortHelpDocs)
  const registry: Record<string, HelpDocRecord> = {}

  for (const doc of docs) {
    if (registry[doc.slug]) {
      throw new Error(`Duplicate help doc slug: ${doc.slug}`)
    }

    registry[doc.slug] = doc
  }

  return registry
}

const rawHelpDocModules = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const helpDocSources = Object.entries(rawHelpDocModules).map(([path, raw]) => ({
  path,
  raw,
}))

export const HELP_DOCS_BY_SLUG = buildHelpDocRegistry(helpDocSources)
export const HELP_DOCS = Object.values(HELP_DOCS_BY_SLUG).sort(sortHelpDocs)

export function listHelpDocs() {
  return HELP_DOCS
}

export function getHelpDocBySlug(slug: string) {
  const doc = HELP_DOCS_BY_SLUG[slug]
  if (!doc) {
    throw new Error(`Unknown help doc slug: ${slug}`)
  }

  return doc
}
