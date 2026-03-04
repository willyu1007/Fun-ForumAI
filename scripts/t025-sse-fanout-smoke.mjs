#!/usr/bin/env node
import {
  parseCliArgs,
  listRunningPods,
  waitForReadyPods,
  startPortForward,
  stopChildProcess,
  requestJson,
  createServiceToken,
  getSecretValue,
  resolveSmokeIds,
} from './k8s-smoke-utils.mjs'

function usage(exitCode = 0) {
  console.log(`
T-025 SSE Fanout Smoke

Usage:
  node scripts/t025-sse-fanout-smoke.mjs [options]

Options:
  --k8s-context <name>            Kubernetes context (default: kind-funforum)
  --k8s-namespace <name>          Namespace (default: funforum)
  --k8s-label-selector <selector> Pod selector (default: app.kubernetes.io/name=backend)
  --k8s-container-port <port>     Backend container port (default: 4000)
  --k8s-local-port1 <port>        Local port for node1 (default: 4301)
  --k8s-local-port2 <port>        Local port for node2 (default: 4302)
  --service-auth-secret <secret>  Service auth secret (default: read from K8s secret)
  --service-auth-secret-name <n>  Secret resource name (default: forum-app-secret)
  --community-id <id>             Community id (default: auto-resolve from Postgres)
  --actor-agent-id <id>           Agent id (default: auto-resolve from Postgres)
  --postgres-deployment <name>    Postgres deployment name (default: postgres)
  --postgres-user <name>          Postgres user (default: postgres)
  --postgres-database <name>      Postgres database (default: llm_forum)
  --event-timeout-ms <ms>         SSE receive timeout (default: 25000)
  --help                          Show help
`)
  process.exit(exitCode)
}

function createSseWatcher(baseUrl, label, timeoutMs) {
  const controller = new AbortController()
  let readyResolved = false
  let readyResolve
  let readyReject
  let failed = null
  let targetPostId = null
  let targetResolve
  let targetReject
  let timeoutHandle = null
  const seenPostIds = new Set()
  const eventsByPostId = new Map()

  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve
    readyReject = reject
  })

  const streamTask = (async () => {
    try {
      const res = await fetch(`${baseUrl}/v1/events/stream`, {
        headers: {
          Accept: 'text/event-stream',
          // SSE parsing in Node fetch can be delayed when response is compressed.
          'accept-encoding': 'identity',
        },
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`${label} SSE connect failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)

          const dataLine = frame
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line.startsWith('data:'))

          if (!dataLine) continue

          const raw = dataLine.slice(5).trim()
          let parsed = null
          try {
            parsed = JSON.parse(raw)
          } catch {
            continue
          }

          if (parsed?.type === 'connected' && !readyResolved) {
            readyResolved = true
            readyResolve(parsed)
          }

          if (parsed?.type !== 'POST_CREATED') continue
          const postId = parsed?.payload?.post_id
          if (typeof postId !== 'string' || !postId) continue

          seenPostIds.add(postId)
          eventsByPostId.set(postId, parsed)
          if (targetPostId && postId === targetPostId && targetResolve) {
            clearTimeout(timeoutHandle)
            const resolve = targetResolve
            targetResolve = undefined
            targetReject = undefined
            resolve(parsed)
          }
        }
      }

      throw new Error(`${label} SSE stream ended before matching event`)
    } catch (err) {
      failed = err
      if (!readyResolved) {
        readyResolved = true
        readyReject(err)
      }
      if (targetReject) {
        const reject = targetReject
        targetResolve = undefined
        targetReject = undefined
        reject(err)
      }
    } finally {
      clearTimeout(timeoutHandle)
    }
  })()

  return {
    ready,
    async waitForPost(postId) {
      if (failed) throw failed
      targetPostId = postId
      if (seenPostIds.has(postId)) {
        return eventsByPostId.get(postId)
      }
      return new Promise((resolve, reject) => {
        targetResolve = resolve
        targetReject = reject
        timeoutHandle = setTimeout(() => {
          targetResolve = undefined
          targetReject = undefined
          reject(new Error(`${label} timeout waiting SSE event for post ${postId}`))
        }, Number(timeoutMs))
      })
    },
    streamTask,
    abort: () => controller.abort(),
  }
}

async function main() {
  const args = parseCliArgs(process.argv, {
    k8sContext: 'kind-funforum',
    k8sNamespace: 'funforum',
    k8sLabelSelector: 'app.kubernetes.io/name=backend',
    k8sContainerPort: 4000,
    k8sLocalPort1: 4301,
    k8sLocalPort2: 4302,
    serviceAuthSecretName: 'forum-app-secret',
    postgresDeployment: 'postgres',
    postgresUser: 'postgres',
    postgresDatabase: 'llm_forum',
    eventTimeoutMs: 25_000,
  })

  if (args.help) usage(0)

  const managedChildren = []
  const watchers = []

  try {
    await waitForReadyPods({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      labelSelector: args.k8sLabelSelector,
      minReady: 2,
      timeoutMs: 90_000,
      intervalMs: 2_000,
    })

    const pods = await listRunningPods({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      labelSelector: args.k8sLabelSelector,
    })
    if (pods.length < 2) {
      throw new Error('Need at least two running backend pods')
    }

    const pod1 = pods[0]
    const pod2 = pods[1]

    const secret = args.serviceAuthSecret || await getSecretValue({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      secretName: args.serviceAuthSecretName,
      key: 'SERVICE_AUTH_SECRET',
    })
    if (!secret) {
      throw new Error('Cannot resolve service auth secret; provide --service-auth-secret')
    }

    const ids = await resolveSmokeIds({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      postgresDeployment: args.postgresDeployment,
      postgresUser: args.postgresUser,
      postgresDatabase: args.postgresDatabase,
      communityId: args.communityId,
      actorAgentId: args.actorAgentId,
    })

    const forward1 = await startPortForward({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      podName: pod1,
      localPort: Number(args.k8sLocalPort1),
      containerPort: Number(args.k8sContainerPort),
    })
    const forward2 = await startPortForward({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      podName: pod2,
      localPort: Number(args.k8sLocalPort2),
      containerPort: Number(args.k8sContainerPort),
    })
    managedChildren.push(forward1, forward2)

    const node1 = `http://127.0.0.1:${Number(args.k8sLocalPort1)}`
    const node2 = `http://127.0.0.1:${Number(args.k8sLocalPort2)}`

    const watcher1 = createSseWatcher(node1, 'node1', Number(args.eventTimeoutMs))
    const watcher2 = createSseWatcher(node2, 'node2', Number(args.eventTimeoutMs))
    watchers.push(watcher1, watcher2)

    await Promise.all([watcher1.ready, watcher2.ready])

    const input = {
      actor_agent_id: ids.actorAgentId,
      run_id: `t025-post-${Date.now()}`,
      community_id: ids.communityId,
      title: `[T025] sse-fanout-${Date.now()}`,
      body: 't025 sse cross-instance fanout smoke',
      tags: ['t025', 'sse'],
    }

    const raw = JSON.stringify(input)
    const created = await requestJson(`${node1}/v1/posts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': createServiceToken(raw, secret),
      },
      body: raw,
    })

    if (!created.ok) {
      throw new Error(`Create post failed (${created.status}): ${created.text}`)
    }

    const postId = created.json?.data?.id
    if (!postId) {
      throw new Error('Post id missing in create response')
    }

    const [event1, event2] = await Promise.all([
      watcher1.waitForPost(postId),
      watcher2.waitForPost(postId),
    ])

    const payload1 = event1?.payload?.post_id
    const payload2 = event2?.payload?.post_id
    if (payload1 !== postId || payload2 !== postId) {
      throw new Error(`Fanout payload mismatch: post=${postId}, node1=${payload1}, node2=${payload2}`)
    }

    console.log('[t025-smoke] PASS')
    console.log(JSON.stringify({
      pods: [pod1, pod2],
      postId,
      node1EventType: event1?.type,
      node2EventType: event2?.type,
      node1PayloadPostId: payload1,
      node2PayloadPostId: payload2,
    }, null, 2))
  } finally {
    for (const watcher of watchers) {
      try {
        watcher.abort()
      } catch {
        // noop
      }
    }
    await Promise.allSettled(watchers.map((watcher) => watcher.streamTask))

    for (const child of managedChildren.reverse()) {
      // eslint-disable-next-line no-await-in-loop
      await stopChildProcess(child)
    }
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[t025-smoke] FAIL:', message)
  process.exit(1)
})
