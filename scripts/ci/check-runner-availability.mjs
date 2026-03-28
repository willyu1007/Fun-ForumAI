#!/usr/bin/env node

const args = process.argv.slice(2)

function readFlag(name, fallback = '') {
  const index = args.indexOf(`--${name}`)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

function required(name, value) {
  if (value) return value
  console.error(`[error] Missing required value for ${name}.`)
  process.exit(1)
}

function parseLabels(raw) {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

async function main() {
  const repo = required('repo', readFlag('repo', process.env.GITHUB_REPOSITORY))
  const token = required('token', process.env.GITHUB_TOKEN)
  const labels = parseLabels(
    required('labels', readFlag('labels', process.env.REQUIRED_RUNNER_LABELS || 'self-hosted,linux,x64,aliyun-vpc,acr-publish')),
  )

  const response = await fetch(`https://api.github.com/repos/${repo}/actions/runners?per_page=100`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  const body = await response.json()
  if (!response.ok) {
    console.error(`[error] Failed to list self-hosted runners: ${response.status} ${body?.message ?? ''}`.trim())
    process.exit(1)
  }

  const matches = (body.runners ?? []).filter((runner) => {
    if (runner.status !== 'online' || runner.busy) return false
    const runnerLabels = new Set((runner.labels ?? []).map((label) => label.name))
    return labels.every((label) => runnerLabels.has(label))
  })

  if (matches.length === 0) {
    const available = (body.runners ?? []).map((runner) => ({
      name: runner.name,
      status: runner.status,
      busy: runner.busy,
      labels: (runner.labels ?? []).map((label) => label.name).join(','),
    }))
    console.error(
      `[error] No online self-hosted runner matches labels: ${labels.join(', ')}.\n${JSON.stringify(available, null, 2)}`,
    )
    process.exit(1)
  }

  console.log(`[ok] Matching self-hosted runner(s): ${matches.map((runner) => runner.name).join(', ')}`)
}

main().catch((error) => {
  console.error(`[error] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
