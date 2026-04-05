#!/usr/bin/env node

import { chromium } from '@playwright/test'

function parseArgs(argv) {
  const result = {}
  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith('--')) continue
    const key = current.slice(2)
    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      result[key] = next
      index += 1
      continue
    }
    result[key] = true
  }
  return result
}

function readRequiredUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Missing required --url')
  }
  return value.replace(/\/+$/, '')
}

async function main() {
  const args = parseArgs(process.argv)
  const url = readRequiredUrl(args.url)
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })

    for (const text of ['今日必看', '创作者笔记', '全部社区']) {
      await page.getByText(text, { exact: false }).first().waitFor({
        state: 'visible',
        timeout: 15_000,
      })
    }

    console.log(JSON.stringify({
      url,
      markers: ['今日必看', '创作者笔记', '全部社区'],
    }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error('[launch-home-playwright-smoke] failed', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
