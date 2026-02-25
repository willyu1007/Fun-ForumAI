#!/usr/bin/env node
import {
  parseCliArgs,
  listRunningPods,
  startPortForward,
  stopChildProcess,
  requestJson,
  pollUntil,
  runCommandCapture,
  kubectlArgs,
  createServiceToken,
  getSecretValue,
  resolveSmokeIds,
} from './k8s-smoke-utils.mjs'

function usage(exitCode = 0) {
  console.log(`
T-024 PG Consistency Smoke

Usage:
  node scripts/t024-consistency-smoke.mjs [options]

Options:
  --k8s-context <name>            Kubernetes context (default: kind-funforum)
  --k8s-namespace <name>          Namespace (default: funforum)
  --k8s-label-selector <selector> Pod selector (default: app.kubernetes.io/name=backend)
  --k8s-container-port <port>     Backend container port (default: 4000)
  --k8s-local-port1 <port>        Local port for node1 (default: 4201)
  --k8s-local-port2 <port>        Local port for node2 (default: 4202)
  --service-auth-secret <secret>  Service auth secret (default: read from K8s secret)
  --service-auth-secret-name <n>  Secret resource name (default: forum-app-secret)
  --community-id <id>             Community id (default: auto-resolve from Postgres)
  --actor-agent-id <id>           Agent id (default: auto-resolve from Postgres)
  --postgres-deployment <name>    Postgres deployment name (default: postgres)
  --postgres-user <name>          Postgres user (default: postgres)
  --postgres-database <name>      Postgres database (default: llm_forum)
  --restart-timeout-ms <ms>       Backend restart timeout (default: 180000)
  --help                          Show help
`)
  process.exit(exitCode)
}

async function main() {
  const args = parseCliArgs(process.argv, {
    k8sContext: 'kind-funforum',
    k8sNamespace: 'funforum',
    k8sLabelSelector: 'app.kubernetes.io/name=backend',
    k8sContainerPort: 4000,
    k8sLocalPort1: 4201,
    k8sLocalPort2: 4202,
    serviceAuthSecretName: 'forum-app-secret',
    postgresDeployment: 'postgres',
    postgresUser: 'postgres',
    postgresDatabase: 'llm_forum',
    restartTimeoutMs: 180_000,
  })

  if (args.help) usage(0)

  const managedChildren = []
  try {
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

    const postInput = {
      actor_agent_id: ids.actorAgentId,
      run_id: `t024-post-${Date.now()}`,
      community_id: ids.communityId,
      title: `[T024] consistency-${Date.now()}`,
      body: 't024 cross-instance consistency smoke',
      tags: ['t024', 'consistency'],
    }
    const postRaw = JSON.stringify(postInput)
    const postResp = await requestJson(`${node1}/v1/posts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': createServiceToken(postRaw, secret),
      },
      body: postRaw,
    })
    if (!postResp.ok) {
      throw new Error(`Create post failed (${postResp.status}): ${postResp.text}`)
    }

    const postId = postResp.json?.data?.id
    if (!postId) throw new Error('Post id missing in create response')

    await pollUntil(async () => {
      const read = await requestJson(`${node2}/v1/posts/${postId}`)
      return read.ok ? read : null
    }, { timeoutMs: 25_000, intervalMs: 1200 })

    const commentInput = {
      actor_agent_id: ids.actorAgentId,
      run_id: `t024-comment-${Date.now()}`,
      post_id: postId,
      body: 't024 comment consistency smoke',
    }
    const commentRaw = JSON.stringify(commentInput)
    const commentResp = await requestJson(`${node2}/v1/comments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': createServiceToken(commentRaw, secret),
      },
      body: commentRaw,
    })
    if (!commentResp.ok) {
      throw new Error(`Create comment failed (${commentResp.status}): ${commentResp.text}`)
    }

    const commentId = commentResp.json?.data?.id
    if (!commentId) throw new Error('Comment id missing in create response')

    await pollUntil(async () => {
      const read = await requestJson(`${node1}/v1/posts/${postId}/comments?limit=100`)
      if (!read.ok) return null
      const items = Array.isArray(read.json?.data) ? read.json.data : []
      return items.some((c) => c.id === commentId) ? read : null
    }, { timeoutMs: 25_000, intervalMs: 1200 })

    await runCommandCapture(
      'kubectl',
      kubectlArgs(args.k8sContext, [
        'delete',
        'pod',
        pod1,
        '-n',
        String(args.k8sNamespace),
      ]),
    )

    await runCommandCapture(
      'kubectl',
      kubectlArgs(args.k8sContext, [
        'wait',
        '--for=condition=ready',
        'pod',
        '-n',
        String(args.k8sNamespace),
        '-l',
        String(args.k8sLabelSelector),
        `--timeout=${Math.ceil(Number(args.restartTimeoutMs) / 1000)}s`,
      ]),
    )

    await stopChildProcess(forward1)
    await stopChildProcess(forward2)

    const postRestartPods = await listRunningPods({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      labelSelector: args.k8sLabelSelector,
    })
    if (postRestartPods.length < 2) {
      throw new Error('Need at least two running backend pods after restart')
    }

    const podA = postRestartPods[0]
    const podB = postRestartPods[1]

    const refwd1 = await startPortForward({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      podName: podA,
      localPort: Number(args.k8sLocalPort1),
      containerPort: Number(args.k8sContainerPort),
    })
    const refwd2 = await startPortForward({
      context: args.k8sContext,
      namespace: args.k8sNamespace,
      podName: podB,
      localPort: Number(args.k8sLocalPort2),
      containerPort: Number(args.k8sContainerPort),
    })
    managedChildren.push(refwd1, refwd2)

    const postN1 = await requestJson(`${node1}/v1/posts/${postId}`)
    const postN2 = await requestJson(`${node2}/v1/posts/${postId}`)
    if (!postN1.ok || !postN2.ok) {
      throw new Error(`Post read failed after restart: node1=${postN1.status}, node2=${postN2.status}`)
    }

    const title1 = postN1.json?.data?.title
    const title2 = postN2.json?.data?.title
    if (!title1 || title1 !== title2) {
      throw new Error(`Post title mismatch after restart: ${title1} vs ${title2}`)
    }

    const commentsN1 = await requestJson(`${node1}/v1/posts/${postId}/comments?limit=100`)
    const commentsN2 = await requestJson(`${node2}/v1/posts/${postId}/comments?limit=100`)
    if (!commentsN1.ok || !commentsN2.ok) {
      throw new Error(`Comment read failed after restart: node1=${commentsN1.status}, node2=${commentsN2.status}`)
    }

    const hasN1 = Array.isArray(commentsN1.json?.data) && commentsN1.json.data.some((c) => c.id === commentId)
    const hasN2 = Array.isArray(commentsN2.json?.data) && commentsN2.json.data.some((c) => c.id === commentId)
    if (!hasN1 || !hasN2) {
      throw new Error(`Comment visibility mismatch after restart: node1=${hasN1}, node2=${hasN2}`)
    }

    console.log('[t024-smoke] PASS')
    console.log(JSON.stringify({
      postId,
      commentId,
      podsBefore: [pod1, pod2],
      podsAfter: [podA, podB],
      title: title1,
      commentVisibleNode1: hasN1,
      commentVisibleNode2: hasN2,
    }, null, 2))
  } finally {
    for (const child of managedChildren.reverse()) {
      // eslint-disable-next-line no-await-in-loop
      await stopChildProcess(child)
    }
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[t024-smoke] FAIL:', message)
  process.exit(1)
})
