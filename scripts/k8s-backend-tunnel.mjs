#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { kubectlArgs, parseCliArgs, stopChildProcess } from './k8s-smoke-utils.mjs'

function usage(exitCode = 0) {
  console.log(`
k8s-backend-tunnel.mjs

Keep a local kubectl port-forward to the backend service alive across rollouts.

Usage:
  node scripts/k8s-backend-tunnel.mjs [options]

Options:
  --k8s-context <name>      Kubernetes context (default: kind-funforum)
  --k8s-namespace <name>    Namespace (default: funforum)
  --service <name>          Service name (default: backend)
  --local-port <port>       Local port to bind (default: 4000)
  --remote-port <port>      Service port to forward to (default: 80)
  --restart-delay-ms <ms>   Delay before restart after disconnect (default: 1500)
  --help
`)
  process.exit(exitCode)
}

function asPositiveInt(value, fallback, label) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive number`)
  }
  return parsed
}

function waitForForwarding(child, label, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (fn) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    const onData = (chunk) => {
      const text = chunk.toString()
      process.stderr.write(`[backend-tunnel] ${text}`)
      if (text.includes('address already in use')) {
        finish(() => reject(new Error(`local port is already in use for ${label}`)))
        return
      }
      if (text.includes('Forwarding from')) {
        finish(resolve)
      }
    }

    const onExit = (code) => {
      finish(() => reject(new Error(`port-forward ${label} exited before ready (${code ?? 'null'})`)))
    }

    const timer = setTimeout(() => {
      finish(() => reject(new Error(`timeout waiting for ${label} to become ready`)))
    }, timeoutMs)

    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.once('error', (error) => finish(() => reject(error)))
    child.once('exit', onExit)
  })
}

async function startServiceTunnel({
  context,
  namespace,
  service,
  localPort,
  remotePort,
}) {
  const child = spawn(
    'kubectl',
    kubectlArgs(context, [
      'port-forward',
      '-n',
      String(namespace),
      `svc/${String(service)}`,
      `${Number(localPort)}:${Number(remotePort)}`,
    ]),
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await waitForForwarding(child, `svc/${service}`)
  return child
}

async function main() {
  const args = parseCliArgs(process.argv, {
    k8sContext: 'kind-funforum',
    k8sNamespace: 'funforum',
    service: 'backend',
    localPort: '4000',
    remotePort: '80',
    restartDelayMs: '1500',
  })

  if (args.help) usage(0)

  const localPort = asPositiveInt(args.localPort, 4000, '--local-port')
  const remotePort = asPositiveInt(args.remotePort, 80, '--remote-port')
  const restartDelayMs = asPositiveInt(args.restartDelayMs, 1500, '--restart-delay-ms')

  let currentChild = null
  let shuttingDown = false

  const shutdown = async (signal, exitCode) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[backend-tunnel] Shutting down on ${signal}...`)
    await stopChildProcess(currentChild)
    process.exit(exitCode)
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT', 130)
  })
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM', 143)
  })

  console.log(
    `[backend-tunnel] Keeping http://127.0.0.1:${localPort} -> svc/${args.service}:${remotePort} alive (context=${args.k8sContext}, namespace=${args.k8sNamespace})`,
  )

  while (!shuttingDown) {
    try {
      currentChild = await startServiceTunnel({
        context: args.k8sContext,
        namespace: args.k8sNamespace,
        service: args.service,
        localPort,
        remotePort,
      })

      console.log(`[backend-tunnel] Tunnel ready on http://127.0.0.1:${localPort}`)

      await new Promise((resolve) => {
        currentChild.once('exit', resolve)
      })

      if (shuttingDown) break
      console.warn(`[backend-tunnel] Tunnel disconnected. Restarting in ${restartDelayMs}ms...`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[backend-tunnel] ${message}`)
      if (/already in use/i.test(message)) {
        process.exit(1)
      }
      if (shuttingDown) break
      console.warn(`[backend-tunnel] Retry in ${restartDelayMs}ms...`)
    } finally {
      await stopChildProcess(currentChild)
      currentChild = null
    }

    await sleep(restartDelayMs)
  }
}

main().catch((error) => {
  console.error(`[backend-tunnel] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
  process.exit(1)
})
