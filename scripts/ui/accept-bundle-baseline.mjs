#!/usr/bin/env node

import {
  findRootEntryChunk,
  getJsChunks,
  readJsonFile,
  resolveBundleCliOptions,
  writeJsonFile,
  formatBytes,
} from './bundle-budget-lib.mjs'

function toBaselineChunk(chunk) {
  if (!chunk) {
    return null
  }

  return {
    name: chunk.name,
    fileName: chunk.fileName,
    rawBytes: chunk.rawBytes,
    gzipBytes: chunk.gzipBytes,
    isEntry: chunk.isEntry,
    isDynamicEntry: chunk.isDynamicEntry,
    facadeModuleId: chunk.facadeModuleId,
  }
}

function main() {
  const options = resolveBundleCliOptions(process.argv.slice(2), { top: 10 })
  const budget = options.budget
  const report = readJsonFile(options.reportFile)
  const jsChunks = getJsChunks(report)
  const rootEntryChunk = findRootEntryChunk(report, budget)

  const baseline = {
    schemaVersion: 1,
    acceptedAt: new Date().toISOString(),
    sourceReport: options.reportFile,
    rootEntryChunk: toBaselineChunk(rootEntryChunk),
    largestJsChunk: toBaselineChunk(jsChunks[0] ?? null),
    topJsChunks: jsChunks.slice(0, options.top).map((chunk) => toBaselineChunk(chunk)),
  }

  writeJsonFile(options.baselineFile, baseline)

  console.log(`Accepted ${baseline.topJsChunks.length} JS chunks into ${options.baselineFile}.`)
  if (baseline.largestJsChunk) {
    console.log(
      `Largest JS chunk baseline: ${baseline.largestJsChunk.name} | raw=${formatBytes(baseline.largestJsChunk.rawBytes)} | gzip=${formatBytes(baseline.largestJsChunk.gzipBytes)}`,
    )
  }
}

main()
