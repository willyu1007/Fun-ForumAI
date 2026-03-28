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

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  const text = await response.text()
  let body = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { message: text }
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  }
}

async function main() {
  const repo = required('repo', readFlag('repo', process.env.GITHUB_REPOSITORY))
  const branch = required('branch', readFlag('branch', process.env.GITHUB_REF_NAME || 'main'))
  const visibility =
    readFlag('visibility', process.env.REPOSITORY_VISIBILITY || process.env.GITHUB_REPOSITORY_VISIBILITY)
  const token = required('token', process.env.GITHUB_TOKEN)

  const repoRes = visibility
    ? { ok: true, body: { visibility } }
    : await fetchJson(`https://api.github.com/repos/${repo}`, token)
  if (!repoRes.ok) {
    console.error(
      `[error] Failed to read repository visibility for ${repo}: ${repoRes.status} ${repoRes.body?.message ?? ''}`.trim(),
    )
    process.exit(1)
  }

  if (repoRes.body.visibility !== 'public') {
    console.log(`[info] Repository visibility is ${repoRes.body.visibility}; public-branch guard skipped.`)
    return
  }

  const branchRes = await fetchJson(`https://api.github.com/repos/${repo}/branches/${branch}`, token)
  if (!branchRes.ok) {
    console.error(
      `[error] Failed to read branch metadata for ${repo}@${branch}: ${branchRes.status} ${branchRes.body?.message ?? ''}`.trim(),
    )
    process.exit(1)
  }

  if (branchRes.body.protected !== true) {
    console.error(
      `[error] ${repo}@${branch} is public but not branch-protected. Enable branch protection before allowing publish credentials on this workflow.`,
    )
    process.exit(1)
  }

  console.log(`[ok] ${repo}@${branch} is branch-protected.`)
}

main().catch((error) => {
  console.error(`[error] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
