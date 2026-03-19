#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const ROOT = path.resolve(__dirname, '../..')
export const DEFAULT_BUDGET_FILE = 'ui/config/bundle-budget.json'
export const DEFAULT_REPORT_FILE = 'dist/frontend/bundle-report.json'
export const DEFAULT_BASELINE_FILE = 'ui/config/bundle-baseline.json'

export function resolveRootPath(relativePath) {
  return path.resolve(ROOT, relativePath)
}

export function readJsonFile(relativePath) {
  const absolutePath = resolveRootPath(relativePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing JSON file: ${relativePath}`)
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
}

export function readBundleBudgetConfig(relativePath = DEFAULT_BUDGET_FILE) {
  return readJsonFile(relativePath)
}

export function writeJsonFile(relativePath, value) {
  const absolutePath = resolveRootPath(relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function getOptionValue(argv, flag, fallback) {
  const index = argv.indexOf(flag)
  if (index === -1) {
    return fallback
  }
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Expected a value after ${flag}`)
  }
  return value
}

export function resolveBundleCliOptions(argv, defaults = {}) {
  const budgetFile = getOptionValue(argv, '--budget-file', defaults.budgetFile ?? DEFAULT_BUDGET_FILE)
  const budget = readBundleBudgetConfig(budgetFile)
  return {
    reportFile: getOptionValue(
      argv,
      '--report-file',
      defaults.reportFile ?? budget.reportPath ?? DEFAULT_REPORT_FILE,
    ),
    budgetFile,
    baselineFile: getOptionValue(
      argv,
      '--baseline-file',
      defaults.baselineFile ?? budget.baselinePath ?? DEFAULT_BASELINE_FILE,
    ),
    top: Number(getOptionValue(argv, '--top', String(defaults.top ?? 5))),
    budget,
  }
}

export function formatBytes(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`
}

export function formatDelta(bytes) {
  if (bytes === 0) {
    return '0.00 kB'
  }

  const sign = bytes > 0 ? '+' : '-'
  return `${sign}${formatBytes(Math.abs(bytes))}`
}

export function getJsChunks(report) {
  return [...(report.jsChunks ?? [])].sort((left, right) => right.rawBytes - left.rawBytes)
}

export function getTopJsChunks(report, limit = 5) {
  return getJsChunks(report).slice(0, limit)
}

export function findRootEntryChunk(report, budget) {
  const rootModuleId = budget.rootEntry?.moduleId
  if (!rootModuleId) {
    return null
  }

  return (
    report.jsChunks?.find((chunk) => chunk.moduleIds?.includes(rootModuleId)) ??
    report.jsChunks?.find((chunk) => chunk.isEntry && chunk.name === 'index') ??
    null
  )
}

export function toBaselineMap(baseline) {
  return new Map((baseline.topJsChunks ?? []).map((chunk) => [chunk.name, chunk]))
}

export function evaluateBundle(report, budget, baseline, context = {}) {
  const errors = []
  const warnings = []
  const jsChunks = getJsChunks(report)
  const largestJsChunk = jsChunks[0] ?? null
  const rootEntryChunk = findRootEntryChunk(report, budget)
  const reportFilePath = context.reportFile ?? budget.reportPath ?? DEFAULT_REPORT_FILE

  if (!rootEntryChunk) {
    errors.push(
      `Root entry chunk containing ${budget.rootEntry.moduleId} was not found in ${reportFilePath}.`,
    )
  } else {
    if (rootEntryChunk.rawBytes > budget.rootEntry.maxRawBytes) {
      errors.push(
        `Root entry chunk ${rootEntryChunk.fileName} is ${formatBytes(rootEntryChunk.rawBytes)}, above the hard limit ${formatBytes(budget.rootEntry.maxRawBytes)}.`,
      )
    }

    if (rootEntryChunk.gzipBytes > budget.rootEntry.maxGzipBytes) {
      errors.push(
        `Root entry chunk ${rootEntryChunk.fileName} gzips to ${formatBytes(rootEntryChunk.gzipBytes)}, above the hard limit ${formatBytes(budget.rootEntry.maxGzipBytes)}.`,
      )
    }
  }

  const acceptedLargestRawBytes = baseline.largestJsChunk?.rawBytes ?? null
  if (
    largestJsChunk &&
    typeof acceptedLargestRawBytes === 'number' &&
    largestJsChunk.rawBytes > acceptedLargestRawBytes
  ) {
    errors.push(
      `Largest JS chunk regressed from ${formatBytes(acceptedLargestRawBytes)} to ${formatBytes(largestJsChunk.rawBytes)} (${largestJsChunk.name} / ${largestJsChunk.fileName}).`,
    )
  }

  for (const route of budget.requiredAsyncRoutes ?? []) {
    const routeChunk = jsChunks.find(
      (chunk) => chunk.isDynamicEntry && chunk.moduleIds?.includes(route.moduleId),
    )
    const leakedIntoEntry = rootEntryChunk?.moduleIds?.includes(route.moduleId) ?? false

    if (leakedIntoEntry) {
      errors.push(`${route.name} leaked back into the root entry chunk.`)
    }

    if (!routeChunk) {
      errors.push(`${route.name} no longer has its own async chunk.`)
    }
  }

  for (const chunk of jsChunks) {
    if (!chunk.isDynamicEntry || !chunk.facadeModuleId?.startsWith('src/frontend/features/')) {
      continue
    }

    const isHeavyRoute = (budget.heavyRouteChunkNames ?? []).includes(chunk.name)
    const maxRawBytes = isHeavyRoute
      ? budget.warnBudgets.heavyRouteMaxRawBytes
      : budget.warnBudgets.defaultRouteMaxRawBytes

    if (chunk.rawBytes > maxRawBytes) {
      warnings.push(
        `${chunk.name} is ${formatBytes(chunk.rawBytes)} raw, above the advisory limit ${formatBytes(maxRawBytes)}.`,
      )
    }
  }

  return {
    errors,
    warnings,
    jsChunks,
    largestJsChunk,
    rootEntryChunk,
  }
}

export function printTopChunkTable(report, baseline, limit = 5) {
  const baselineMap = toBaselineMap(baseline)
  const topChunks = getTopJsChunks(report, limit)

  console.log('Top JS chunks:')
  for (const chunk of topChunks) {
    const baselineChunk = baselineMap.get(chunk.name)
    const rawDelta = baselineChunk ? chunk.rawBytes - baselineChunk.rawBytes : null
    const gzipDelta = baselineChunk ? chunk.gzipBytes - baselineChunk.gzipBytes : null

    console.log(
      [
        `- ${chunk.name}`,
        `${chunk.fileName}`,
        `raw=${formatBytes(chunk.rawBytes)}`,
        `gzip=${formatBytes(chunk.gzipBytes)}`,
        baselineChunk
          ? `baseline raw=${formatBytes(baselineChunk.rawBytes)} (${formatDelta(rawDelta)})`
          : 'baseline raw=n/a',
        baselineChunk
          ? `baseline gzip=${formatBytes(baselineChunk.gzipBytes)} (${formatDelta(gzipDelta)})`
          : 'baseline gzip=n/a',
      ].join(' | '),
    )
  }
}
