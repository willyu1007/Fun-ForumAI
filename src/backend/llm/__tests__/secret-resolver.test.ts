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
      '  llm_api_default:',
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

    expect(resolver.resolve('secret-ref:llm_api_default')).toBe('secret-token')
  })

  it('throws when a provider-specific env key is absent', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'secret-resolver-fallback-'))
    const secretsFilePath = join(tempDir, 'dev.ref.yaml')
    const policyPath = join(tempDir, 'policy.yaml')

    writeFileSync(secretsFilePath, [
      'version: 1',
      'secrets:',
      '  llm_api_default:',
      '    backend: env',
      '    ref: env://DASHSCOPE_API_KEY',
      '',
    ].join('\n'))
    writeFileSync(policyPath, 'policy: {}\n')

    const resolver = new SecretResolver({
      appEnv: 'dev',
      env: {},
      secretsFilePath,
      policyPath,
    })

    expect(() => resolver.resolve('secret-ref:llm_api_default')).toThrow(
      'Environment secret is missing: DASHSCOPE_API_KEY',
    )
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

  it('prefers deploy-time env injection over Bitwarden refs when contract maps the secret_ref', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'secret-resolver-env-first-'))
    const secretsFilePath = join(tempDir, 'staging.ref.yaml')
    const policyPath = join(tempDir, 'policy.yaml')
    const contractPath = join(tempDir, 'contract.yaml')

    writeFileSync(secretsFilePath, [
      'version: 1',
      'secrets:',
      '  llm_api_default:',
      '    backend: bws',
      '    project_name: test-project',
      '    key: llm_api_default',
      '',
    ].join('\n'))
    writeFileSync(policyPath, 'policy: {}\n')
    writeFileSync(contractPath, [
      'version: 1',
      'variables:',
      '  DASHSCOPE_API_KEY:',
      '    type: string',
      '    required: false',
      '    secret: true',
      '    secret_ref: llm_api_default',
      '',
    ].join('\n'))

    const resolver = new SecretResolver({
      appEnv: 'staging',
      env: {
        DASHSCOPE_API_KEY: 'deploy-time-token',
      },
      secretsFilePath,
      policyPath,
      contractPath,
    })

    expect(resolver.resolve('secret-ref:llm_api_default')).toBe('deploy-time-token')
  })

  it('disables Bitwarden fallback by default for staging runtime', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'secret-resolver-bws-disabled-'))
    const secretsFilePath = join(tempDir, 'staging.ref.yaml')
    const policyPath = join(tempDir, 'policy.yaml')
    const contractPath = join(tempDir, 'contract.yaml')

    writeFileSync(secretsFilePath, [
      'version: 1',
      'secrets:',
      '  llm_api_default:',
      '    backend: bws',
      '    project_name: test-project',
      '    key: llm_api_default',
      '',
    ].join('\n'))
    writeFileSync(policyPath, 'policy: {}\n')
    writeFileSync(contractPath, [
      'version: 1',
      'variables:',
      '  DASHSCOPE_API_KEY:',
      '    type: string',
      '    required: false',
      '    secret: true',
      '    secret_ref: llm_api_default',
      '',
    ].join('\n'))

    const resolver = new SecretResolver({
      appEnv: 'staging',
      env: {},
      secretsFilePath,
      policyPath,
      contractPath,
    })

    expect(() => resolver.resolve('secret-ref:llm_api_default')).toThrow(
      'Bitwarden fallback is disabled for runtime in this environment',
    )
  })
})
