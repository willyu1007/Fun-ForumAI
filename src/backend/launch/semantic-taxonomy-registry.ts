import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { ValidationError } from '../lib/errors.js'
import {
  AUTHORING_SHAPE_IDS,
  COMMUNITY_FAMILY_IDS,
  COMMUNITY_FAMILY_TO_PUBLICATION_REVIEW_PROFILE,
  COMMUNITY_FAMILY_TO_SHELL_CATEGORY,
  COMMUNITY_SHELL_CATEGORY_IDS,
  CONTENT_KIND_IDS,
  EDITORIAL_SHELF_IDS,
  FORMAT_KIND_IDS,
  PUBLICATION_REVIEW_PROFILE_IDS,
} from '../../shared/semantic-taxonomy.js'

const TAXONOMY_ROOT = resolve(process.cwd(), 'config/taxonomy')

const familyRegistrySchema = z.object({
  version: z.number().int().positive(),
  shell_categories: z.array(z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
  }).strict()).length(COMMUNITY_SHELL_CATEGORY_IDS.length),
  families: z.array(z.object({
    id: z.string().trim().min(1),
    shell_category: z.string().trim().min(1),
    publication_review_profile_id: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
  }).strict()).length(COMMUNITY_FAMILY_IDS.length),
}).strict()

const publicationReviewRegistrySchema = z.object({
  version: z.number().int().positive(),
  profiles: z.array(z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
  }).strict()).length(PUBLICATION_REVIEW_PROFILE_IDS.length),
}).strict()

const editorialShelfRegistrySchema = z.object({
  version: z.number().int().positive(),
  shelves: z.array(z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
    legacy_runtime_id: z.string().trim().min(1),
  }).strict()).length(EDITORIAL_SHELF_IDS.length),
}).strict()

const contentFormatRegistrySchema = z.object({
  version: z.number().int().positive(),
  format_kinds: z.array(z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
  }).strict()).length(FORMAT_KIND_IDS.length),
  content_kinds: z.array(z.object({
    id: z.string().trim().min(1),
    format_kind: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
  }).strict()).length(CONTENT_KIND_IDS.length),
  authoring_shapes: z.array(z.object({
    id: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
  }).strict()).min(1),
}).strict()

export interface SemanticTaxonomyRegistryRuntime {
  community_families: z.infer<typeof familyRegistrySchema>
  publication_review_profiles: z.infer<typeof publicationReviewRegistrySchema>
  editorial_shelves: z.infer<typeof editorialShelfRegistrySchema>
  content_formats: z.infer<typeof contentFormatRegistrySchema>
}

let cachedRegistry: SemanticTaxonomyRegistryRuntime | null = null

function readYaml(pathname: string): unknown {
  return parseYaml(readFileSync(pathname, 'utf8'))
}

function readRegistryFile<T>(pathname: string, schema: z.ZodSchema<T>, label: string): T {
  const parsed = schema.safeParse(readYaml(pathname))
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ')
    throw new ValidationError(`Invalid ${label} registry: ${message}`)
  }
  return parsed.data
}

function assertExactCoverage(actual: string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || expected.some((item) => !actual.includes(item))) {
    throw new ValidationError(`Invalid ${label} registry: expected exact coverage for ${expected.join(', ')}`)
  }
}

function validateRuntime(runtime: SemanticTaxonomyRegistryRuntime): SemanticTaxonomyRegistryRuntime {
  assertExactCoverage(
    runtime.community_families.shell_categories.map((entry) => entry.id),
    COMMUNITY_SHELL_CATEGORY_IDS,
    'community shell category',
  )
  assertExactCoverage(
    runtime.community_families.families.map((entry) => entry.id),
    COMMUNITY_FAMILY_IDS,
    'community family',
  )
  assertExactCoverage(
    runtime.publication_review_profiles.profiles.map((entry) => entry.id),
    PUBLICATION_REVIEW_PROFILE_IDS,
    'publication review profile',
  )
  assertExactCoverage(
    runtime.editorial_shelves.shelves.map((entry) => entry.id),
    EDITORIAL_SHELF_IDS,
    'editorial shelf',
  )
  assertExactCoverage(
    runtime.content_formats.format_kinds.map((entry) => entry.id),
    FORMAT_KIND_IDS,
    'format kind',
  )
  assertExactCoverage(
    runtime.content_formats.content_kinds.map((entry) => entry.id),
    CONTENT_KIND_IDS,
    'content kind',
  )
  assertExactCoverage(
    runtime.content_formats.authoring_shapes.map((entry) => entry.id),
    AUTHORING_SHAPE_IDS,
    'authoring shape',
  )

  for (const family of runtime.community_families.families) {
    const expectedShellCategory = COMMUNITY_FAMILY_TO_SHELL_CATEGORY[family.id as keyof typeof COMMUNITY_FAMILY_TO_SHELL_CATEGORY]
    const expectedPublicationProfile = COMMUNITY_FAMILY_TO_PUBLICATION_REVIEW_PROFILE[
      family.id as keyof typeof COMMUNITY_FAMILY_TO_PUBLICATION_REVIEW_PROFILE
    ]
    if (family.shell_category !== expectedShellCategory) {
      throw new ValidationError(
        `Invalid community family registry: ${family.id} must map to shell category ${expectedShellCategory}`,
      )
    }
    if (family.publication_review_profile_id !== expectedPublicationProfile) {
      throw new ValidationError(
        `Invalid community family registry: ${family.id} must map to publication profile ${expectedPublicationProfile}`,
      )
    }
  }

  return runtime
}

export function getSemanticTaxonomyRegistry(): SemanticTaxonomyRegistryRuntime {
  if (cachedRegistry) return cachedRegistry

  cachedRegistry = validateRuntime({
    community_families: readRegistryFile(
      resolve(TAXONOMY_ROOT, 'community_families.v1.yaml'),
      familyRegistrySchema,
      'community family',
    ),
    publication_review_profiles: readRegistryFile(
      resolve(TAXONOMY_ROOT, 'publication_review_profiles.v1.yaml'),
      publicationReviewRegistrySchema,
      'publication review profile',
    ),
    editorial_shelves: readRegistryFile(
      resolve(TAXONOMY_ROOT, 'editorial_shelves.v1.yaml'),
      editorialShelfRegistrySchema,
      'editorial shelf',
    ),
    content_formats: readRegistryFile(
      resolve(TAXONOMY_ROOT, 'content_formats.v1.yaml'),
      contentFormatRegistrySchema,
      'content format',
    ),
  })

  return cachedRegistry
}
