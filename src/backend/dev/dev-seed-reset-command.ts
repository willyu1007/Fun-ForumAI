import { execFileSync } from 'node:child_process'
import { assertSafeDevSeedResetEnvironment } from './dev-seed-reset.js'

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function run(command: string, args: string[]): void {
  execFileSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      DB_PERSISTENCE: process.env.DB_PERSISTENCE ?? 'true',
    },
  })
}

async function main() {
  assertSafeDevSeedResetEnvironment({})

  run('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force'])
  run('pnpm', ['db:generate'])
  run('pnpm', ['seed', '--', '--profile=canonical'])
  if (!hasFlag('skip-bio-measure')) {
    run('pnpm', ['agent-bio:measure', '--', '--registry-profile=canonical'])
  }
}

main().catch((error) => {
  console.error('[dev-seed-reset] failed', error)
  process.exit(1)
})
