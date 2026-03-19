#!/usr/bin/env node

import {
  evaluateBundle,
  printTopChunkTable,
  readJsonFile,
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

  printTopChunkTable(report, baseline, options.top)

  if (evaluation.warnings.length > 0) {
    console.log('\nWarnings:')
    for (const warning of evaluation.warnings) {
      console.log(`- ${warning}`)
    }
  }

  if (evaluation.errors.length > 0) {
    console.error('\nBundle budget check failed:')
    for (const error of evaluation.errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log('\nBundle budget check passed.')
}

main()
