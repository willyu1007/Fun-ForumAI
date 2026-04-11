#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SCHEMA_PATH = resolve(ROOT, 'prisma/schema.prisma')
const OUTPUT_ROOT = resolve(ROOT, '.ai/.tmp/database')
const LEGACY_MODEL_NAMES = new Set(['LegacyAgentMediaAsset', 'LegacyGrowthEventArchive'])

function readArg(name) {
  const argv = process.argv.slice(2)
  const index = argv.indexOf(`--${name}`)
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1]
  }
  return null
}

function formatRunId(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function toNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') return Number.parseInt(value, 10)
  return 0
}

function parseSchemaInventory() {
  const lines = readFileSync(SCHEMA_PATH, 'utf8').split('\n')
  const models = []
  let currentModel = null

  for (const line of lines) {
    const modelMatch = line.match(/^model\s+(\w+)\s+\{/)
    if (modelMatch) {
      currentModel = {
        modelName: modelMatch[1],
        tableName: modelMatch[1],
        metadataFields: [],
      }
      models.push(currentModel)
      continue
    }

    if (!currentModel) continue

    if (line.trim() === '}') {
      currentModel = null
      continue
    }

    const tableMapMatch = line.match(/^\s*@@map\("([^"]+)"\)/)
    if (tableMapMatch) {
      currentModel.tableName = tableMapMatch[1]
      continue
    }

    const fieldMatch = line.match(/^\s+(metaJson|metadataJson|moderationMetadataJson)\s+\w+/)
    if (!fieldMatch) continue

    const fieldName = fieldMatch[1]
    const columnMapMatch = line.match(/@map\("([^"]+)"\)/)
    currentModel.metadataFields.push({
      fieldName,
      columnName: columnMapMatch?.[1] ?? fieldName,
    })
  }

  return {
    metadataFields: models.flatMap((model) =>
      model.metadataFields.map((field) => ({
        modelName: model.modelName,
        tableName: model.tableName,
        fieldName: field.fieldName,
        columnName: field.columnName,
      })),
    ),
    legacyModels: models
      .filter((model) => LEGACY_MODEL_NAMES.has(model.modelName))
      .map((model) => ({
        modelName: model.modelName,
        tableName: model.tableName,
      })),
  }
}

async function fetchDatabaseName(prisma) {
  const [row] = await prisma.$queryRawUnsafe('select current_database() as database_name')
  return row?.database_name ?? null
}

async function fetchMetadataFieldInventory(prisma, field) {
  const summarySql = `
    select
      count(*)::bigint as total_rows,
      count(*) filter (where "${field.columnName}" is null)::bigint as null_rows,
      count(*) filter (where "${field.columnName}" is not null)::bigint as nonnull_rows,
      count(*) filter (
        where "${field.columnName}" is not null
          and jsonb_typeof("${field.columnName}") = 'object'
      )::bigint as object_rows,
      count(*) filter (
        where "${field.columnName}" is not null
          and jsonb_typeof("${field.columnName}") = 'array'
      )::bigint as array_rows,
      count(*) filter (
        where "${field.columnName}" is not null
          and jsonb_typeof("${field.columnName}") not in ('object', 'array')
      )::bigint as scalar_rows
    from "${field.tableName}";
  `

  const keySql = `
    select
      entry.key as key,
      count(*)::bigint as rows,
      array_agg(distinct jsonb_typeof(entry.value) order by jsonb_typeof(entry.value)) as value_types
    from "${field.tableName}"
    cross join lateral jsonb_each(
      case
        when jsonb_typeof("${field.columnName}") = 'object' then "${field.columnName}"
        else '{}'::jsonb
      end
    ) as entry(key, value)
    group by entry.key
    order by rows desc, entry.key asc;
  `

  const [summaryRow] = await prisma.$queryRawUnsafe(summarySql)
  const keyRows = await prisma.$queryRawUnsafe(keySql)

  const summary = {
    total_rows: toNumber(summaryRow?.total_rows),
    null_rows: toNumber(summaryRow?.null_rows),
    nonnull_rows: toNumber(summaryRow?.nonnull_rows),
    object_rows: toNumber(summaryRow?.object_rows),
    array_rows: toNumber(summaryRow?.array_rows),
    scalar_rows: toNumber(summaryRow?.scalar_rows),
  }

  return {
    ...field,
    summary: {
      ...summary,
      null_ratio: summary.total_rows === 0 ? 0 : Number((summary.null_rows / summary.total_rows).toFixed(4)),
    },
    keys: keyRows.map((row) => ({
      key: row.key,
      rows: toNumber(row.rows),
      value_types: Array.isArray(row.value_types) ? row.value_types : [],
    })),
  }
}

async function fetchLegacyModelInventory(prisma, legacyModel) {
  const [row] = await prisma.$queryRawUnsafe(
    `select count(*)::bigint as row_count from "${legacyModel.tableName}";`,
  )
  return {
    ...legacyModel,
    row_count: toNumber(row?.row_count),
  }
}

function renderMarkdownReport(report) {
  const lines = [
    '# Flag / Metadata / Legacy Inventory',
    '',
    `- Generated at: ${report.generated_at}`,
    `- Database: ${report.database_name ?? 'unknown'}`,
    `- Metadata fields: ${report.metadata_fields.length}`,
    `- Legacy models: ${report.legacy_models.length}`,
    '',
    '## Metadata Fields',
    '',
    '| Model | Field | Table | Total | Null | Non-null | Keys |',
    '| --- | --- | --- | ---: | ---: | ---: | --- |',
  ]

  report.metadata_fields.forEach((field) => {
    const keySummary = field.keys.length === 0
      ? 'none'
      : field.keys.slice(0, 6).map((entry) => `${entry.key} (${entry.rows})`).join(', ')
    lines.push(
      `| ${field.modelName} | ${field.fieldName} | ${field.tableName} | ${field.summary.total_rows} | ${field.summary.null_rows} | ${field.summary.nonnull_rows} | ${keySummary} |`,
    )
  })

  lines.push('', '## Legacy Models', '', '| Model | Table | Rows |', '| --- | --- | ---: |')

  report.legacy_models.forEach((model) => {
    lines.push(`| ${model.modelName} | ${model.tableName} | ${model.row_count} |`)
  })

  return `${lines.join('\n')}\n`
}

async function main() {
  const schemaInventory = parseSchemaInventory()
  const connectionString = process.env.DATABASE_URL ?? `postgresql://${process.env.USER ?? 'postgres'}@localhost:5432/llm_forum_dev`
  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter, log: ['error'] })
  const runId = formatRunId()
  const outputDir = readArg('output-dir') || resolve(OUTPUT_ROOT, runId)

  try {
    const databaseName = await fetchDatabaseName(prisma)
    const metadataFields = []

    for (const field of schemaInventory.metadataFields) {
      metadataFields.push(await fetchMetadataFieldInventory(prisma, field))
    }

    const legacyModels = []
    for (const model of schemaInventory.legacyModels) {
      legacyModels.push(await fetchLegacyModelInventory(prisma, model))
    }

    const report = {
      generated_at: new Date().toISOString(),
      database_name: databaseName,
      metadata_fields: metadataFields,
      legacy_models: legacyModels,
    }

    await mkdir(outputDir, { recursive: true })
    await writeFile(resolve(outputDir, 'flag-metadata-legacy-inventory.json'), `${JSON.stringify(report, null, 2)}\n`)
    await writeFile(resolve(outputDir, 'flag-metadata-legacy-inventory.md'), renderMarkdownReport(report))

    console.log(JSON.stringify({
      output_dir: outputDir,
      database_name: report.database_name,
      metadata_field_count: report.metadata_fields.length,
      legacy_model_count: report.legacy_models.length,
    }, null, 2))
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  console.error(message)
  process.exit(1)
})
