import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import type {
  WarmupVerifierArtifactPaths,
  WarmupVerifierDiagnosis,
  WarmupVerifierFailureLogEntry,
  WarmupVerifierGovernanceDrill,
  WarmupVerifierProbeManifest,
  WarmupVerifierRunDetail,
  WarmupVerifierRunSummary,
  WarmupVerifierSurfaceAudit,
  WarmupVerifierTerminalRunStatus,
} from '../../shared/warmup-verifier.js'

const DEFAULT_RUNS_ROOT = resolve(process.cwd(), '.ai/.tmp/warmup-runs')
const LATEST_RUN_PATH = (rootDir: string) => resolve(rootDir, 'latest-run.json')

async function safeReadJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

export class WarmupRunArtifactService {
  constructor(private readonly rootDir = DEFAULT_RUNS_ROOT) {}

  async createRun(input?: {
    triggered_by_user_id?: string | null
  }): Promise<WarmupVerifierRunSummary> {
    await mkdir(this.rootDir, { recursive: true })
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
    const artifactDir = resolve(this.rootDir, runId)
    const artifacts = this.buildArtifacts(runId)
    await mkdir(artifactDir, { recursive: true })

    const summary: WarmupVerifierRunSummary = {
      run_id: runId,
      status: 'running',
      triggered_by_user_id: input?.triggered_by_user_id ?? null,
      kickoff_baseline_id: null,
      kickoff_baseline_label: null,
      kickoff_batch_id: null,
      warmup_batch_id: null,
      probe_token: null,
      probe_post_id: null,
      failed_phase: null,
      top_diagnosis_code: null,
      top_diagnosis_summary_zh: null,
      surface_matrix: {
        feed: null,
        home: null,
        highlights: null,
        search: null,
      },
      governance_drill: {
        quarantine_ok: null,
        restore_ok: null,
        cleanup_ok: null,
      },
      artifact_dir: artifactDir,
      started_at: new Date().toISOString(),
      completed_at: null,
    }
    await this.writeJson(artifacts.run_summary_path, summary)
    await this.writeJson(artifacts.kickoff_snapshot_before_path, null)
    await this.writeJson(artifacts.kickoff_snapshot_after_path, null)
    await this.writeJson(artifacts.baseline_admission_before_path, null)
    await this.writeJson(artifacts.baseline_admission_after_path, null)
    await this.writeJson(artifacts.probe_manifest_path, null)
    await this.writeJson(artifacts.surface_audit_path, null)
    await this.writeJson(artifacts.governance_drill_path, null)
    await this.writeJson(artifacts.diagnosis_path, [])
    await this.writeJson(artifacts.failure_log_path, [])
    await writeFile(
      artifacts.result_summary_path,
      '# Warm-up Closure Verifier\n\nstatus: running\n',
      'utf8',
    )
    await this.writeJson(LATEST_RUN_PATH(this.rootDir), { run_id: runId })
    return summary
  }

  buildArtifacts(runId: string): WarmupVerifierArtifactPaths {
    const artifactDir = resolve(this.rootDir, runId)
    return {
      artifact_dir: artifactDir,
      run_summary_path: resolve(artifactDir, 'run-summary.json'),
      kickoff_snapshot_before_path: resolve(artifactDir, 'kickoff-snapshot-before.json'),
      kickoff_snapshot_after_path: resolve(artifactDir, 'kickoff-snapshot-after.json'),
      baseline_admission_before_path: resolve(artifactDir, 'baseline-admission-before.json'),
      baseline_admission_after_path: resolve(artifactDir, 'baseline-admission-after.json'),
      probe_manifest_path: resolve(artifactDir, 'probe-manifest.json'),
      surface_audit_path: resolve(artifactDir, 'surface-audit.json'),
      governance_drill_path: resolve(artifactDir, 'governance-drill.json'),
      diagnosis_path: resolve(artifactDir, 'diagnosis.json'),
      failure_log_path: resolve(artifactDir, 'failure-log.json'),
      result_summary_path: resolve(artifactDir, 'result-summary.md'),
    }
  }

  async writeKickoffSnapshotBefore(runId: string, payload: unknown): Promise<string> {
    const path = this.buildArtifacts(runId).kickoff_snapshot_before_path
    await this.writeJson(path, payload)
    return path
  }

  async writeKickoffSnapshotAfter(runId: string, payload: unknown): Promise<string> {
    const path = this.buildArtifacts(runId).kickoff_snapshot_after_path
    await this.writeJson(path, payload)
    return path
  }

  async writeBaselineAdmissionBefore(runId: string, payload: unknown): Promise<string> {
    const path = this.buildArtifacts(runId).baseline_admission_before_path
    await this.writeJson(path, payload)
    return path
  }

  async writeBaselineAdmissionAfter(runId: string, payload: unknown): Promise<string> {
    const path = this.buildArtifacts(runId).baseline_admission_after_path
    await this.writeJson(path, payload)
    return path
  }

  async writeProbeManifest(
    runId: string,
    payload: WarmupVerifierProbeManifest | null,
  ): Promise<string> {
    const path = this.buildArtifacts(runId).probe_manifest_path
    await this.writeJson(path, payload)
    return path
  }

  async writeSurfaceAudit(
    runId: string,
    payload: WarmupVerifierSurfaceAudit | null,
  ): Promise<string> {
    const path = this.buildArtifacts(runId).surface_audit_path
    await this.writeJson(path, payload)
    return path
  }

  async writeGovernanceDrill(
    runId: string,
    payload: WarmupVerifierGovernanceDrill | null,
  ): Promise<string> {
    const path = this.buildArtifacts(runId).governance_drill_path
    await this.writeJson(path, payload)
    return path
  }

  async writeDiagnosis(runId: string, payload: WarmupVerifierDiagnosis[]): Promise<string> {
    const path = this.buildArtifacts(runId).diagnosis_path
    await this.writeJson(path, payload)
    return path
  }

  async appendFailure(runId: string, entry: WarmupVerifierFailureLogEntry): Promise<string> {
    const path = this.buildArtifacts(runId).failure_log_path
    const current = (await safeReadJson<WarmupVerifierFailureLogEntry[]>(path)) ?? []
    current.push(entry)
    await this.writeJson(path, current)
    return path
  }

  async writeResultSummary(runId: string, content: string): Promise<string> {
    const path = this.buildArtifacts(runId).result_summary_path
    await mkdir(resolve(path, '..'), { recursive: true })
    await writeFile(path, content, 'utf8')
    return path
  }

  async completeRun(
    runId: string,
    input: {
      status: WarmupVerifierTerminalRunStatus
      failed_phase?: WarmupVerifierRunSummary['failed_phase']
      kickoff_baseline_id?: string | null
      kickoff_baseline_label?: string | null
      kickoff_batch_id?: string | null
      warmup_batch_id?: string | null
      probe_token?: string | null
      probe_post_id?: string | null
      diagnoses?: WarmupVerifierDiagnosis[]
      surface_matrix?: WarmupVerifierRunSummary['surface_matrix']
      governance_drill?: WarmupVerifierRunSummary['governance_drill']
    },
  ): Promise<WarmupVerifierRunSummary> {
    const summaryPath = this.buildArtifacts(runId).run_summary_path
    const current = (await safeReadJson<WarmupVerifierRunSummary>(summaryPath))!
    const topDiagnosis = input.diagnoses?.[0] ?? null
    const next: WarmupVerifierRunSummary = {
      ...current,
      status: input.status,
      failed_phase: input.failed_phase ?? null,
      kickoff_baseline_id: input.kickoff_baseline_id ?? current.kickoff_baseline_id,
      kickoff_baseline_label:
        input.kickoff_baseline_label ?? current.kickoff_baseline_label,
      kickoff_batch_id: input.kickoff_batch_id ?? current.kickoff_batch_id,
      warmup_batch_id: input.warmup_batch_id ?? current.warmup_batch_id,
      probe_token: input.probe_token ?? current.probe_token,
      probe_post_id: input.probe_post_id ?? current.probe_post_id,
      top_diagnosis_code: topDiagnosis?.code ?? null,
      top_diagnosis_summary_zh: topDiagnosis?.summary_zh ?? null,
      surface_matrix: input.surface_matrix ?? current.surface_matrix,
      governance_drill: input.governance_drill ?? current.governance_drill,
      completed_at: new Date().toISOString(),
    }
    await this.writeJson(summaryPath, next)
    await this.writeJson(LATEST_RUN_PATH(this.rootDir), { run_id: runId })
    return next
  }

  async readLatestRun(): Promise<WarmupVerifierRunDetail | null> {
    const latest = await safeReadJson<{ run_id: string }>(LATEST_RUN_PATH(this.rootDir))
    if (!latest?.run_id) return null
    return this.readRun(latest.run_id)
  }

  async readRun(runId: string): Promise<WarmupVerifierRunDetail | null> {
    const artifacts = this.buildArtifacts(runId)
    const summary = await safeReadJson<WarmupVerifierRunSummary>(artifacts.run_summary_path)
    if (!summary) return null
    const diagnoses =
      (await safeReadJson<WarmupVerifierDiagnosis[]>(artifacts.diagnosis_path)) ?? []
    return {
      summary,
      artifacts,
      diagnoses,
      top_diagnosis: diagnoses[0] ?? null,
      surface_audit: await safeReadJson<WarmupVerifierSurfaceAudit>(artifacts.surface_audit_path),
      governance_drill: await safeReadJson<WarmupVerifierGovernanceDrill>(
        artifacts.governance_drill_path,
      ),
      probe_manifest: await safeReadJson<WarmupVerifierProbeManifest>(
        artifacts.probe_manifest_path,
      ),
    }
  }

  async listRecentRuns(limit = 10): Promise<WarmupVerifierRunSummary[]> {
    let entries: string[]
    try {
      entries = await readdir(this.rootDir)
    } catch {
      return []
    }
    const runDirs = entries
      .filter((entry) => !entry.endsWith('.json'))
      .sort()
      .reverse()
    const summaries: WarmupVerifierRunSummary[] = []
    for (const dir of runDirs.slice(0, limit)) {
      const summary = await safeReadJson<WarmupVerifierRunSummary>(
        resolve(this.rootDir, dir, 'run-summary.json'),
      )
      if (summary) summaries.push(summary)
    }
    return summaries
  }

  private async writeJson(path: string, payload: unknown): Promise<void> {
    await mkdir(resolve(path, '..'), { recursive: true })
    await writeFile(path, JSON.stringify(payload, null, 2), 'utf8')
  }
}
