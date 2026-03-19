#!/usr/bin/env node

import {
  evaluateBundle,
  printTopChunkTable,
  readJsonFile,
  formatBytes,
  resolveBundleCliOptions,
} from './bundle-budget-lib.mjs'

function main() {
  const options = resolveBundleCliOptions(process.argv.slice(2))
  const budget = options.budget
  const report = readJsonFile(options.reportFile)
  const baseline = readJsonFile(options.baselineFile)
  const evaluation = evaluateBundle(report, budget, baseline, {
    reportFile: options.reportFile,
  })

  console.log(`Bundle report: ${options.reportFile}`)
  console.log(`Accepted baseline: ${options.baselineFile}`)

  if (evaluation.rootEntryChunk) {
    console.log(
      `Root entry: ${evaluation.rootEntryChunk.fileName} | raw=${formatBytes(evaluation.rootEntryChunk.rawBytes)} | gzip=${formatBytes(evaluation.rootEntryChunk.gzipBytes)}`,
    )
  }

  if (evaluation.largestJsChunk) {
    console.log(
      `Largest JS chunk: ${evaluation.largestJsChunk.name} (${evaluation.largestJsChunk.fileName}) | raw=${formatBytes(evaluation.largestJsChunk.rawBytes)} | gzip=${formatBytes(evaluation.largestJsChunk.gzipBytes)}`,
    )
  }

  printTopChunkTable(report, baseline, options.top)

  if (evaluation.warnings.length > 0) {
    console.log('\nWarnings:')
    for (const warning of evaluation.warnings) {
      console.log(`- ${warning}`)
    }
  }

  if (evaluation.errors.length > 0) {
    console.log('\nBlocking issues:')
    for (const error of evaluation.errors) {
      console.log(`- ${error}`)
    }
  }
}

main()
