import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const scanRoots = [
  'src',
  'scripts',
  'dev-docs/active',
  'dev-docs/archive',
  '.ai/project/main',
]

const forbiddenTokens = [
  'docs/stage-templates/v1',
  'library.manifest.yaml',
  'legacy-v1',
  'projectLegacyTemplateToStageTemplateV2',
  'parseLegacyStageTemplateDocument',
  'projectLegacyLifecycleStatus',
]

const allowlist = new Set([
  path.join('scripts', 'check-stage-template-legacy-tokens.mjs'),
])

async function listFiles() {
  const { stdout } = await execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard', ...scanRoots], {
    cwd: root,
    maxBuffer: 10 * 1024 * 1024,
  })

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !allowlist.has(file))
}

async function main() {
  const files = await listFiles()
  const hits = []

  for (const file of files) {
    const absolutePath = path.join(root, file)
    const stat = await fs.stat(absolutePath).catch(() => null)
    if (!stat?.isFile()) {
      continue
    }

    const content = await fs.readFile(absolutePath, 'utf8').catch(() => null)
    if (content == null) {
      continue
    }

    const lines = content.split('\n')
    lines.forEach((line, index) => {
      forbiddenTokens.forEach((token) => {
        if (line.includes(token)) {
          hits.push({
            file,
            lineNumber: index + 1,
            token,
            line,
          })
        }
      })
    })
  }

  if (hits.length === 0) {
    console.log(`Legacy token guard passed: scanned ${files.length} files, found 0 violations.`)
    return
  }

  console.error(`Legacy token guard failed: scanned ${files.length} files, found ${hits.length} violations.`)
  for (const hit of hits) {
    console.error(`${hit.file}:${hit.lineNumber}: forbidden token "${hit.token}"`)
    console.error(`  ${hit.line}`)
  }
  process.exitCode = 1
}

await main()
