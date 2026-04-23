import { useState } from 'react'
import {
  useIdentityReviews,
  useModerationCase,
  useModerationEvidenceExport,
  useModerationQueue,
  useAssignModerationCase,
  useClaimModerationTask,
  useReleaseModerationCase,
  useReopenModerationCase,
  useResolveIdentityReview,
  useResolveModerationCase,
  useTransferModerationCase,
} from '@/api/hooks'
import type { EvidenceExportRedaction } from './constants'

export function useReviewController() {
  const { data: queueData } = useModerationQueue()
  const { data: identityReviews } = useIdentityReviews({ limit: 20 })
  const assignCase = useAssignModerationCase()
  const claimTask = useClaimModerationTask()
  const transferCase = useTransferModerationCase()
  const releaseCase = useReleaseModerationCase()
  const resolveCase = useResolveModerationCase()
  const reopenCase = useReopenModerationCase()
  const resolveIdentity = useResolveIdentityReview()

  const [transferUserId, setTransferUserId] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [evidenceExportRedaction, setEvidenceExportRedaction] =
    useState<EvidenceExportRedaction>('operator')
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)

  const { data: caseDetail } = useModerationCase(selectedCaseId)
  const { data: evidenceExport, refetch: refetchEvidenceExport } = useModerationEvidenceExport(
    selectedCaseId,
    evidenceExportRedaction,
  )

  return {
    queueData,
    identityReviews,
    caseDetail,
    evidenceExport,
    refetchEvidenceExport,
    assignCase,
    claimTask,
    transferCase,
    releaseCase,
    resolveCase,
    reopenCase,
    resolveIdentity,
    transferUserId,
    setTransferUserId,
    transferNote,
    setTransferNote,
    evidenceExportRedaction,
    setEvidenceExportRedaction,
    selectedCaseId,
    setSelectedCaseId,
  }
}
