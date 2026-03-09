import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SecretResolver } from '../secret-resolver.js'

describe('SecretResolver', () => {
  it('resolves env-backed secret refs from the environment secret file', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'secret-resolver-'))
    const secretsFilePath = join(tempDir, 'dev.ref.yaml')
    const policyPath = join(tempDir, 'policy.yaml')

    writeFileSync(secretsFilePath, [
      'version: 1',
      'secrets:',
      '  dashscope_api_key:',
      '    backend: env',
      '    ref: env://DASHSCOPE_API_KEY',
      '',
    ].join('\n'))
    writeFileSync(policyPath, 'policy: {}\n')

    const resolver = new SecretResolver({
      appEnv: 'dev',
      env: {
        DASHSCOPE_API_KEY: 'secret-token',
      },
      secretsFilePath,
      policyPath,
    })

    expect(resolver.resolve('secret-ref:dashscope_api_key')).toBe('secret-token')
  })

  it('resolves file-backed secrets', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'secret-resolver-file-'))
    const secretValuePath = join(tempDir, 'value.txt')
    const secretsFilePath = join(tempDir, 'dev.ref.yaml')
    const policyPath = join(tempDir, 'policy.yaml')

    writeFileSync(secretValuePath, 'file-secret\n')
    writeFileSync(secretsFilePath, [
      'version: 1',
      'secrets:',
      `  local_secret:`,
      '    backend: file',
      `    ref: file://${secretValuePath}`,
      '',
    ].join('\n'))
    writeFileSync(policyPath, 'policy: {}\n')

    const resolver = new SecretResolver({
      appEnv: 'dev',
      env: {},
      secretsFilePath,
      policyPath,
    })

    expect(resolver.resolve('secret-ref:local_secret')).toBe('file-secret')
  })
})
