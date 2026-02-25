#!/usr/bin/env node
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

export function parseCliArgs(argv, defaults = {}) {
  const out = { ...defaults }
  const args = argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === '--help' || token === '-h') {
      out.help = true
      continue
    }
    if (!token.startsWith('--')) continue
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const next = args[i + 1]
    if (!next || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i++
  }
  return out
}

export async function runCommandCapture(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: opts.env ?? process.env,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.once('error', reject)
    child.once('close', (code) => {
      const exitCode = Number(code ?? 1)
      if (exitCode === 0) {
        resolve({ code: 0, stdout, stderr })
        return
      }
      reject(new Error(`${cmd} ${args.join(' ')} failed (${exitCode}): ${stderr || stdout}`))
    })
  })
}

export function kubectlArgs(context, args) {
  if (!context) return args
  return ['--context', String(context), ...args]
}

export async function listRunningPods({ context, namespace, labelSelector }) {
  const res = await runCommandCapture(
    'kubectl',
    kubectlArgs(context, [
      'get',
      'pods',
      '-n',
      String(namespace),
      '-l',
      String(labelSelector),
      '--field-selector=status.phase=Running',
      '-o',
      'json',
    ]),
  )

  const payload = JSON.parse(res.stdout)
  return (Array.isArray(payload?.items) ? payload.items : [])
    .map((x) => x?.metadata?.name)
    .filter((x) => typeof x === 'string')
    .sort()
}

async function waitPortForwardReady(child, name, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    let output = ''
    let settled = false

    const finish = (fn) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    const onData = (chunk) => {
      const text = chunk.toString()
      output += text
      if (text.includes('Forwarding from')) {
        finish(resolve)
      }
    }

    const onExit = (code) => {
      finish(() => reject(new Error(`port-forward ${name} exited early (${code ?? 'null'}): ${output}`)))
    }

    const timer = setTimeout(() => {
      finish(() => reject(new Error(`timeout waiting for port-forward ${name}`)))
    }, timeoutMs)

    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.once('error', (err) => finish(() => reject(err)))
    child.once('exit', onExit)
  })
}

export async function startPortForward({ context, namespace, podName, localPort, containerPort }) {
  const child = spawn(
    'kubectl',
    kubectlArgs(context, [
      'port-forward',
      '-n',
      String(namespace),
      `pod/${podName}`,
      `${Number(localPort)}:${Number(containerPort)}`,
    ]),
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await waitPortForwardReady(child, podName)
  return child
}

export async function stopChildProcess(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(1500),
  ])
  if (child.exitCode === null) {
    child.kill('SIGKILL')
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      sleep(1000),
    ])
  }
}

export async function requestJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { ok: res.ok, status: res.status, text, json }
}

export async function pollUntil(fn, { timeoutMs = 20_000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const result = await fn()
      if (result) return result
    } catch (err) {
      lastError = err
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs)
  }
  throw lastError ?? new Error('poll timeout')
}

export function createServiceToken(bodyRaw, secret) {
  const identity = 'agent-runtime'
  const timestamp = Date.now().toString()
  const nonce = crypto.randomUUID()
  const bodyHash = crypto.createHash('sha256').update(bodyRaw || '').digest('hex')
  const payload = `${identity}:${timestamp}:${nonce}:${bodyHash}`
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${identity}:${timestamp}:${nonce}:${signature}`
}

export async function getSecretValue({ context, namespace, secretName, key }) {
  const res = await runCommandCapture(
    'kubectl',
    kubectlArgs(context, [
      'get',
      'secret',
      String(secretName),
      '-n',
      String(namespace),
      '-o',
      `jsonpath={.data.${String(key)}}`,
    ]),
  )
  const encoded = res.stdout.trim()
  if (!encoded) return ''
  return Buffer.from(encoded, 'base64').toString('utf-8')
}

export async function queryPostgresScalar({
  context,
  namespace,
  deployment = 'postgres',
  user = 'postgres',
  database = 'llm_forum',
  sql,
}) {
  const res = await runCommandCapture(
    'kubectl',
    kubectlArgs(context, [
      'exec',
      '-n',
      String(namespace),
      `deploy/${String(deployment)}`,
      '--',
      'psql',
      '-U',
      String(user),
      '-d',
      String(database),
      '-At',
      '-c',
      String(sql),
    ]),
  )
  return res.stdout.trim().split('\n').map((x) => x.trim()).find(Boolean) ?? ''
}

export async function resolveSmokeIds({
  context,
  namespace,
  postgresDeployment,
  postgresUser,
  postgresDatabase,
  communityId,
  actorAgentId,
}) {
  const resolvedCommunityId = communityId || await queryPostgresScalar({
    context,
    namespace,
    deployment: postgresDeployment,
    user: postgresUser,
    database: postgresDatabase,
    sql: 'select id from communities order by created_at asc limit 1;',
  })

  const resolvedAgentId = actorAgentId || await queryPostgresScalar({
    context,
    namespace,
    deployment: postgresDeployment,
    user: postgresUser,
    database: postgresDatabase,
    sql: 'select id from agents order by created_at asc limit 1;',
  })

  if (!resolvedCommunityId) {
    throw new Error('Cannot resolve community id; provide --community-id')
  }
  if (!resolvedAgentId) {
    throw new Error('Cannot resolve actor agent id; provide --actor-agent-id')
  }

  return {
    communityId: resolvedCommunityId,
    actorAgentId: resolvedAgentId,
  }
}
