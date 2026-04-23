import { useEffect, useState } from 'react'
import {
  useAdminKickoffStatus,
  useAdminWarmupRunDetail,
  useAdminWarmupRuns,
  useAdminWarmupVerifierLatestRun,
  useRollbackAdminWarmupRun,
  useRunAdminWarmupVerifier,
  useStartAdminWarmupRun,
} from '@/api/hooks'

export function useWarmupController() {
  const { data: kickoffStatus } = useAdminKickoffStatus()
  const { data: warmupRuns } = useAdminWarmupRuns()
  const { data: warmupVerifierLatestRun } = useAdminWarmupVerifierLatestRun()
  const startMutation = useStartAdminWarmupRun()
  const rollbackMutation = useRollbackAdminWarmupRun()
  const runVerifierMutation = useRunAdminWarmupVerifier()

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [targetPosts, setTargetPosts] = useState('4')
  const [maxAttempts, setMaxAttempts] = useState('8')
  const { data: warmupRunDetail } = useAdminWarmupRunDetail(selectedRunId)

  useEffect(() => {
    if (selectedRunId || !warmupRuns?.data?.length) return
    setSelectedRunId(warmupRuns.data[0]!.id)
  }, [selectedRunId, warmupRuns])

  const handleStartWarmupRun = async () => {
    const response = await startMutation.mutateAsync({
      target_posts: Number.parseInt(targetPosts, 10) || 1,
      max_attempts: Number.parseInt(maxAttempts, 10) || 1,
    })
    setSelectedRunId(response.data.id)
  }

  const handleRollbackWarmupRun = async () => {
    if (!selectedRunId) return
    await rollbackMutation.mutateAsync(selectedRunId)
  }

  const handleRunVerifier = async () => {
    await runVerifierMutation.mutateAsync()
  }

  return {
    kickoff: kickoffStatus?.data ?? null,
    runs: warmupRuns?.data ?? [],
    selectedRunId,
    setSelectedRunId,
    detail: warmupRunDetail?.data ?? null,
    latestVerifierRun: warmupVerifierLatestRun?.data ?? null,
    startMutation,
    rollbackMutation,
    runVerifierMutation,
    targetPosts,
    setTargetPosts,
    maxAttempts,
    setMaxAttempts,
    handleStartWarmupRun,
    handleRollbackWarmupRun,
    handleRunVerifier,
  }
}
