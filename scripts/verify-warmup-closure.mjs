#!/usr/bin/env node

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')

function readArg(name) {
  const index = argv.indexOf(`--${name}`)
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1]
  }
  return null
}

function normalizeBaseUrl(value) {
  return value ? value.replace(/\/+$/, '') : ''
}

async function main() {
  const webBaseUrl = normalizeBaseUrl(
    readArg('web-base-url') || process.env.LAUNCH_WEB_BASE_URL || '',
  )
  const adminToken = readArg('admin-token') || process.env.LAUNCH_ADMIN_TOKEN || ''

  if (!webBaseUrl || !adminToken) {
    const payload = {
      ok: false,
      message: 'require --web-base-url and --admin-token (or LAUNCH_WEB_BASE_URL / LAUNCH_ADMIN_TOKEN)',
    }
    if (jsonMode) {
      console.log(JSON.stringify(payload, null, 2))
    } else {
      console.error(payload.message)
    }
    process.exit(1)
  }

  const response = await fetch(`${webBaseUrl}/v1/admin/warm-start/verifier/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  const bodyText = await response.text()
  const body = (() => {
    try {
      return bodyText ? JSON.parse(bodyText) : null
    } catch {
      return bodyText
    }
  })()

  if (response.status !== 201 && response.status !== 200) {
    const payload = {
      ok: false,
      status: response.status,
      error: body?.error ?? body,
    }
    if (jsonMode) {
      console.log(JSON.stringify(payload, null, 2))
    } else {
      console.error(`warm-up closure verifier request failed: status=${response.status}`)
      if (payload.error) {
        console.error(JSON.stringify(payload.error, null, 2))
      }
    }
    process.exit(1)
  }

  const detail = body?.data ?? null
  const summary = detail?.summary ?? null
  const ok = summary?.status === 'passed'
  const output = {
    ok,
    run_id: summary?.run_id ?? null,
    status: summary?.status ?? 'failed',
    failed_phase: summary?.failed_phase ?? null,
    top_diagnosis_code: detail?.top_diagnosis?.code ?? null,
    top_diagnosis_summary_zh: detail?.top_diagnosis?.summary_zh ?? null,
    surface_matrix: summary?.surface_matrix ?? null,
    governance_drill: summary?.governance_drill ?? null,
    artifact_dir: summary?.artifact_dir ?? null,
  }

  if (jsonMode) {
    console.log(JSON.stringify(output, null, 2))
  } else {
    console.log(`run_id=${output.run_id ?? 'unknown'}`)
    console.log(`status=${output.status}`)
    console.log(`failed_phase=${output.failed_phase ?? 'none'}`)
    console.log(`top_diagnosis=${output.top_diagnosis_code ?? 'none'}`)
    if (output.top_diagnosis_summary_zh) {
      console.log(`summary=${output.top_diagnosis_summary_zh}`)
    }
    console.log(`surfaces=${JSON.stringify(output.surface_matrix)}`)
    console.log(`governance=${JSON.stringify(output.governance_drill)}`)
    console.log(`artifact_dir=${output.artifact_dir ?? 'none'}`)
  }

  process.exit(ok ? 0 : 1)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  if (jsonMode) {
    console.log(JSON.stringify({ ok: false, message }, null, 2))
  } else {
    console.error(`warm-up closure verifier failed: ${message}`)
  }
  process.exit(1)
})
